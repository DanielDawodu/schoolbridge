import { Response } from 'express';
import mongoose from 'mongoose';
import Session from '../models/Session';
import Term from '../models/Term';
import Period from '../models/Period';
import School from '../models/School';
import ClassGroup from '../models/ClassGroup';
import ClassLevel from '../models/ClassLevel';
import StudentResult from '../models/StudentResult';
import SubjectRegistration from '../models/SubjectRegistration';
import Attendance from '../models/Attendance';
import FeeInvoice from '../models/FeeInvoice';
import { AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';

export const runSessionTermPeriodMigration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dryRun = req.query.dryRun === 'true';

    console.log(dryRun ? 'DRY RUN (verification mode): Creating master data to test mapping...' : 'Starting migration to Session/Term/Period structure...');

    // In dry-run mode, we create master data (Terms, Sessions, Periods) to verify mapping
    // but skip actual data migration (ClassGroups, StudentResults, etc.)
    // This allows us to show the exact counts and mappings before touching real data

    // Step 1: Create default Terms for each school
    console.log('Step 1: Creating default Terms...');

    // Use raw collection to avoid type issues
    const schoolCollection = mongoose.connection.collection('schools');
    const schoolsRaw = await schoolCollection.find({}).toArray();
    console.log(`Found ${schoolsRaw.length} schools`);

    for (const school of schoolsRaw) {
      const existingTerms = await Term.find({ schoolId: school._id });
      if (existingTerms.length === 0) {
        // Always create terms in dry-run too, since they're reusable master data
        // and needed for mapping verification
        await Term.create([
          { schoolId: school._id, name: '1st Term', order: 1 },
          { schoolId: school._id, name: '2nd Term', order: 2 },
          { schoolId: school._id, name: '3rd Term', order: 3 },
        ]);
        console.log(`Created default terms for school: ${school.name}`);
      } else {
        console.log(`Terms already exist for school: ${school.name} (${existingTerms.length} terms)`);
      }
    }

    // Step 2: Migrate AcademicSessions to Sessions and Periods
    console.log('Step 2: Migrating AcademicSessions to Sessions and Periods...');

    // Use raw collection to access legacy data
    const academicSessionCollection = mongoose.connection.collection('academicsessions');
    const academicSessionsRaw = await academicSessionCollection.find({}).toArray();
    console.log(`Found ${academicSessionsRaw.length} AcademicSessions to migrate`);

    // Log sample data for verification
    if (academicSessionsRaw.length > 0) {
      console.log('Sample AcademicSession data:');
      console.log(JSON.stringify(academicSessionsRaw[0], null, 2));
    }

    let sessionsCreated = 0;
    let periodsCreated = 0;
    let periodsSetActive = 0;
    const periodMapping = new Map<string, any>(); // oldSessionId -> newPeriodId

    for (const academicSession of academicSessionsRaw) {
      console.log(`\nProcessing AcademicSession: ${academicSession._id}, year: ${academicSession.year}, currentTerm: ${academicSession.currentTerm}`);

      // Check if Session already exists for this year
      let session = await Session.findOne({
        schoolId: academicSession.schoolId,
        year: academicSession.year,
      });

      if (!session) {
        // Create sessions even in dry-run for mapping verification
        try {
          session = await Session.create({
            schoolId: academicSession.schoolId,
            year: academicSession.year,
          });
          sessionsCreated++;
          console.log(`Created Session: ${academicSession.year} for school: ${academicSession.schoolId}`);
        } catch (error: any) {
          if (error.code === 11000) {
            // Duplicate key - session already exists for this school+year combination
            session = await Session.findOne({
              schoolId: academicSession.schoolId,
              year: academicSession.year,
            });
            if (session) {
              console.log(`Session already exists for ${academicSession.year} (school: ${academicSession.schoolId})`);
            } else {
              console.error(`Duplicate key error but session not found for school ${academicSession.schoolId}, year ${academicSession.year}`);
              continue;
            }
          } else {
            throw error;
          }
        }
      }

      // Ensure session._id exists for Period lookup
      if (!session || !session._id) {
        console.error(`Session creation failed for year: ${academicSession.year}`);
        continue;
      }

      // Find corresponding Term
      const termName = academicSession.currentTerm === 'first' ? '1st Term' :
                       academicSession.currentTerm === 'second' ? '2nd Term' : '3rd Term';
      console.log(`Looking for Term: ${termName} for school: ${academicSession.schoolId}`);

      const term = await Term.findOne({
        schoolId: academicSession.schoolId,
        name: termName,
      });

      if (!term) {
        console.error(`Term not found: ${termName} for school ${academicSession.schoolId}`);
        continue;
      }

      console.log(`Found Term: ${term._id} (school: ${term.schoolId})`);

      // Check if Period already exists
      const existingPeriod = await Period.findOne({
        schoolId: academicSession.schoolId,
        sessionId: session._id,
        termId: term._id,
      });

      if (!existingPeriod) {
        // Create periods even in dry-run for mapping verification
        const period = await Period.create({
          schoolId: academicSession.schoolId,
          sessionId: session._id,
          termId: term._id,
          daysOpen: academicSession.daysOpen || 0,
          isActive: false,
        });
        periodsCreated++;
        console.log(`Created Period: ${academicSession.year} - ${termName} (school: ${academicSession.schoolId})`);

        // If this was the active term, mark period as active
        const schoolCollection = mongoose.connection.collection('schools');
        const schoolRaw = await schoolCollection.findOne({ _id: academicSession.schoolId });
        if (schoolRaw && schoolRaw.activeTermId && schoolRaw.activeTermId.toString() === academicSession._id.toString()) {
          period.isActive = true;
          await period.save();
          await schoolCollection.updateOne(
            { _id: academicSession.schoolId },
            { $set: { activePeriodId: period._id }, $unset: { activeTermId: 1 } }
          );
          periodsSetActive++;
          console.log(`Set Period as active: ${academicSession.year} - ${termName} (school: ${academicSession.schoolId})`);
        }

        periodMapping.set(academicSession._id.toString(), period._id);
      } else {
        periodMapping.set(academicSession._id.toString(), existingPeriod._id);
      }
    }

    console.log(`\nPeriod mapping size: ${periodMapping.size}`);
    console.log(`Step 2 Summary: ${sessionsCreated} Sessions created, ${periodsCreated} Periods created, ${periodsSetActive} Periods set active`);

    // Step 3: Migrate ClassGroups to use ClassLevel and Period
    console.log('Step 3: Migrating ClassGroups to use ClassLevel and Period...');

    // Use raw collection to access legacy data before model changes
    const classGroupCollection = mongoose.connection.collection('classgroups');
    const classGroupsRaw = await classGroupCollection.find({}).toArray();
    console.log(`Found ${classGroupsRaw.length} ClassGroups to migrate`);

    let classLevelsCreated = 0;
    let classGroupsUpdated = 0;
    let classGroupsSkipped = 0;

    for (const classGroup of classGroupsRaw) {
      // Extract class level from name (e.g., "JSS 1" from "JSS 1-A")
      const nameMatch = classGroup.name?.match(/^([A-Z]+ \d+)/);
      const levelName = nameMatch ? nameMatch[1] : classGroup.name;

      if (!levelName) {
        classGroupsSkipped++;
        console.log(`Skipped ClassGroup (no name): ${classGroup._id} (school: ${classGroup.schoolId})`);
        continue;
      }

      // Find or create ClassLevel
      let classLevel = await ClassLevel.findOne({
        schoolId: classGroup.schoolId,
        name: levelName,
      });

      if (!classLevel) {
        if (!dryRun) {
          classLevel = await ClassLevel.create({
            schoolId: classGroup.schoolId,
            name: levelName,
            levelOrder: 0,
          });
          classLevelsCreated++;
          console.log(`Created ClassLevel: ${levelName} (school: ${classGroup.schoolId})`);
        } else {
          console.log(`[DRY RUN] Would create ClassLevel: ${levelName} (school: ${classGroup.schoolId})`);
          classLevel = { _id: new mongoose.Types.ObjectId() } as any;
        }
      }

      // Find corresponding Period from sessionId
      const newPeriodId = periodMapping.get(classGroup.sessionId?.toString());
      if (newPeriodId && classLevel) {
        if (!dryRun) {
          await ClassGroup.findByIdAndUpdate(classGroup._id, {
            classLevelId: classLevel._id,
            periodId: newPeriodId,
            $unset: { name: 1, sessionId: 1 }
          });
          classGroupsUpdated++;
          console.log(`Updated ClassGroup: ${classGroup.name} -> ${levelName} (school: ${classGroup.schoolId})`);
        } else {
          console.log(`[DRY RUN] Would update ClassGroup: ${classGroup.name} -> ${levelName} (school: ${classGroup.schoolId})`);
          classGroupsUpdated++; // Count it even in dry-run to show what would happen
        }
      } else {
        classGroupsSkipped++;
        console.log(`Skipped ClassGroup (no period mapping): ${classGroup.name} (school: ${classGroup.schoolId}, sessionId: ${classGroup.sessionId})`);
      }
    }

    console.log(`Step 3 Summary: ${classLevelsCreated} ClassLevels created, ${classGroupsUpdated} ClassGroups updated, ${classGroupsSkipped} ClassGroups skipped`);

    // Step 4: Update StudentResult to use Period
    console.log('Step 4: Updating StudentResult to use Period...');

    // Use raw collection to access legacy data
    const studentResultCollection = mongoose.connection.collection('studentresults');
    const studentResultsRaw = await studentResultCollection.find({}).toArray();
    console.log(`Found ${studentResultsRaw.length} StudentResults to update`);

    let studentResultsUpdated = 0;
    let studentResultsSkipped = 0;

    for (const result of studentResultsRaw) {
      const newPeriodId = periodMapping.get(result.sessionId?.toString());
      if (newPeriodId) {
        if (!dryRun) {
          const verificationCode = `SR${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          await StudentResult.findByIdAndUpdate(result._id, {
            periodId: newPeriodId,
            verificationCode,
            $unset: { sessionId: 1 }
          });
          studentResultsUpdated++;
        } else {
          console.log(`[DRY RUN] Would update StudentResult: ${result._id}`);
          studentResultsUpdated++; // Count it in dry-run
        }
      } else {
        studentResultsSkipped++;
      }
    }

    console.log(`Step 4 Summary: ${studentResultsUpdated} StudentResults updated, ${studentResultsSkipped} skipped`);

    // Step 5: Update SubjectRegistration to use Period
    console.log('Step 5: Updating SubjectRegistration to use Period...');

    // Use raw collection to access legacy data
    const subjectRegistrationCollection = mongoose.connection.collection('subjectregistrations');
    const subjectRegistrationsRaw = await subjectRegistrationCollection.find({}).toArray();
    console.log(`Found ${subjectRegistrationsRaw.length} SubjectRegistrations to update`);

    let subjectRegistrationsUpdated = 0;
    let subjectRegistrationsSkipped = 0;

    for (const registration of subjectRegistrationsRaw) {
      const newPeriodId = periodMapping.get(registration.sessionId?.toString());
      if (newPeriodId) {
        if (!dryRun) {
          await SubjectRegistration.findByIdAndUpdate(registration._id, {
            sessionId: newPeriodId,
          });
          subjectRegistrationsUpdated++;
        } else {
          console.log(`[DRY RUN] Would update SubjectRegistration: ${registration._id}`);
          subjectRegistrationsUpdated++; // Count it in dry-run
        }
      } else {
        subjectRegistrationsSkipped++;
      }
    }

    console.log(`Step 5 Summary: ${subjectRegistrationsUpdated} SubjectRegistrations updated, ${subjectRegistrationsSkipped} skipped`);

    // Step 6: Attendance doesn't need migration - it's already scoped by classId and date
    // ClassGroup now has periodId, so attendance records are correctly associated
    console.log('Step 6: Attendance records are already correctly scoped by classId and date - no migration needed');

    const attendanceCollection = mongoose.connection.collection('attendances');
    const attendanceCount = await attendanceCollection.countDocuments();
    console.log(`Attendance records in database: ${attendanceCount}`);

    // Step 7: Update FeeInvoice to use Period
    console.log('Step 7: Updating FeeInvoice to use Period...');

    // Use raw collection to access legacy data
    const feeInvoiceCollection = mongoose.connection.collection('feeinvoices');
    const feeInvoicesRaw = await feeInvoiceCollection.find({}).toArray();
    console.log(`Found ${feeInvoicesRaw.length} FeeInvoices to update`);

    let feeInvoicesUpdated = 0;
    let feeInvoicesSkipped = 0;

    for (const invoice of feeInvoicesRaw) {
      // FeeInvoice uses termId (not sessionId) which references AcademicSession
      const newPeriodId = periodMapping.get(invoice.termId?.toString());
      if (newPeriodId) {
        if (!dryRun) {
          await FeeInvoice.findByIdAndUpdate(invoice._id, {
            termId: newPeriodId,
          });
          feeInvoicesUpdated++;
        } else {
          console.log(`[DRY RUN] Would update FeeInvoice: ${invoice._id}`);
          feeInvoicesUpdated++; // Count it in dry-run
        }
      } else {
        feeInvoicesSkipped++;
      }
    }

    console.log(`Step 7 Summary: ${feeInvoicesUpdated} FeeInvoices updated, ${feeInvoicesSkipped} skipped`);

    const summary = {
      sessionsCreated,
      periodsCreated,
      periodsSetActive,
      classLevelsCreated,
      classGroupsUpdated,
      classGroupsSkipped,
      studentResultsUpdated,
      studentResultsSkipped,
      subjectRegistrationsUpdated,
      subjectRegistrationsSkipped,
      attendanceRecords: attendanceCount,
      feeInvoicesUpdated,
      feeInvoicesSkipped,
    };

    if (dryRun) {
      console.log('\n=== DRY RUN COMPLETE ===');
      console.log('Master data (Terms, Sessions, Periods) was created to verify mapping.');
      console.log('Data migration (ClassGroups, StudentResults, etc.) was NOT executed.');
      console.log('Please review the summary and mapping above.');
      console.log('After review, you can run without dryRun=true to execute the actual migration.');
      console.log('Note: The created master data will be reused when you run the live migration.');
      res.json({ mode: 'dry-run', summary, note: 'Master data created for verification. Run without dryRun to execute actual migration.' });
    } else {
      console.log('\n=== MIGRATION COMPLETE ===');
      console.log('Summary:', summary);
      console.log('\nWARNING: After verification, you can drop the AcademicSession collection');
      res.json({ mode: 'live', summary });
    }
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};
