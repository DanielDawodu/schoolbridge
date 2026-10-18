// @ts-nocheck - Migration script works with legacy data structures, disable strict checking
import mongoose from 'mongoose';
import Session from '../models/Session';
import Term from '../models/Term';
import Period from '../models/Period';
import AcademicSession from '../models/AcademicSession';
import School from '../models/School';
import ClassGroup from '../models/ClassGroup';
import ClassLevel from '../models/ClassLevel';
import StudentResult from '../models/StudentResult';
import SubjectRegistration from '../models/SubjectRegistration';
import Attendance from '../models/Attendance';
import FeeInvoice from '../models/FeeInvoice';

// Ensure all models are registered by importing them
import '../models/Student';
import '../models/Subject';
import '../models/User';
import '../models/BillTemplate';
import '../models/MigrationBatch';


// Temporary interfaces for old data structure before migration
interface OldAcademicSession {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  year: string;
  currentTerm: string;
  daysOpen?: number;
}

interface OldClassGroup {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  name: string;
  arm: string;
  sessionId: mongoose.Types.ObjectId;
}

interface OldStudentResult {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
}

interface OldSubjectRegistration {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
}

interface OldAttendance {
  _id: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
}

interface OldFeeInvoice {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
}

// Type assertion for old AcademicSession
const oldAcademicSessionModel = mongoose.model('AcademicSession') as any;
const oldClassGroupModel = mongoose.model('ClassGroup') as any;
const oldStudentResultModel = mongoose.model('StudentResult') as any;
const oldSubjectRegistrationModel = mongoose.model('SubjectRegistration') as any;
const oldAttendanceModel = mongoose.model('Attendance') as any;
const oldFeeInvoiceModel = mongoose.model('FeeInvoice') as any;

export const migrateToSessionTermPeriod = async (dryRun: boolean = false) => {
  console.log(dryRun ? 'DRY RUN: Migration to Session/Term/Period structure...' : 'Starting migration to Session/Term/Period structure...');

  try {
    // Step 1: Create default Terms for each school
    console.log('Step 1: Creating default Terms...');
    const schools = await School.find({});
    console.log(`Found ${schools.length} schools`);

    for (const school of schools) {
      const existingTerms = await Term.find({ schoolId: school._id });
      if (existingTerms.length === 0) {
        if (!dryRun) {
          await Term.create([
            { schoolId: school._id, name: '1st Term', order: 1 },
            { schoolId: school._id, name: '2nd Term', order: 2 },
            { schoolId: school._id, name: '3rd Term', order: 3 },
          ]);
          console.log(`Created default terms for school: ${school.name}`);
        } else {
          console.log(`[DRY RUN] Would create default terms for school: ${school.name}`);
        }
      } else {
        console.log(`Terms already exist for school: ${school.name} (${existingTerms.length} terms)`);
      }
    }

    // Step 2: Migrate AcademicSessions to Sessions and Periods
    console.log('Step 2: Migrating AcademicSessions to Sessions and Periods...');
    const academicSessions = await oldAcademicSessionModel.find({}) as OldAcademicSession[];
    console.log(`Found ${academicSessions.length} AcademicSessions to migrate`);

    let sessionsCreated = 0;
    let periodsCreated = 0;
    let periodsSetActive = 0;
    const periodMapping = new Map<string, mongoose.Types.ObjectId>(); // oldSessionId -> newPeriodId

    for (const academicSession of academicSessions) {
      // Check if Session already exists for this year
      let session = await Session.findOne({
        schoolId: academicSession.schoolId,
        year: academicSession.year,
      });

      if (!session) {
        if (!dryRun) {
          session = await Session.create({
            schoolId: academicSession.schoolId,
            year: academicSession.year,
          });
          sessionsCreated++;
          console.log(`Created Session: ${academicSession.year}`);
        } else {
          console.log(`[DRY RUN] Would create Session: ${academicSession.year}`);
          session = { _id: new mongoose.Types.ObjectId() } as any;
        }
      } else if (dryRun) {
        // For dry run, we still need a session object reference
        session = { _id: session._id } as any;
      }

      // Find corresponding Term
      const termName = academicSession.currentTerm === 'first' ? '1st Term' :
                       academicSession.currentTerm === 'second' ? '2nd Term' : '3rd Term';
      const term = await Term.findOne({
        schoolId: academicSession.schoolId,
        name: termName,
      });

      if (!term) {
        console.error(`Term not found: ${termName} for school ${academicSession.schoolId}`);
        continue;
      }

      // Check if Period already exists
      const existingPeriod = await Period.findOne({
        schoolId: academicSession.schoolId,
        sessionId: session._id,
        termId: term._id,
      });

      if (!existingPeriod) {
        if (!dryRun) {
          // @ts-ignore - session cannot be null here due to the logic above
          const period = await Period.create({
            schoolId: academicSession.schoolId,
            // @ts-ignore
            sessionId: session._id,
            termId: term._id,
            daysOpen: academicSession.daysOpen || 0,
            isActive: false,
          });
          periodsCreated++;
          console.log(`Created Period: ${academicSession.year} - ${termName}`);

          // If this was the active term, mark period as active
          const school = await School.findById(academicSession.schoolId);
          if (school && (school as any).activeTermId && (school as any).activeTermId.toString() === academicSession._id.toString()) {
            period.isActive = true;
            await period.save();
            (school as any).activePeriodId = period._id;
            (school as any).activeTermId = undefined;
            await school.save();
            periodsSetActive++;
            console.log(`Set Period as active: ${academicSession.year} - ${termName}`);
          }

          periodMapping.set(academicSession._id.toString(), period._id);
        } else {
          console.log(`[DRY RUN] Would create Period: ${academicSession.year} - ${termName} (daysOpen: ${academicSession.daysOpen || 0})`);
          // @ts-ignore
          periodMapping.set(academicSession._id.toString(), new mongoose.Types.ObjectId());
        }
      } else {
        periodMapping.set(academicSession._id.toString(), existingPeriod._id);
      }
    }

    console.log(`Step 2 Summary: ${sessionsCreated} Sessions created, ${periodsCreated} Periods created, ${periodsSetActive} Periods set active`);

    // Step 3: Migrate ClassGroups to use ClassLevel and Period
    console.log('Step 3: Migrating ClassGroups to use ClassLevel and Period...');
    const classGroups = await oldClassGroupModel.find({}) as OldClassGroup[];
    console.log(`Found ${classGroups.length} ClassGroups to migrate`);

    let classLevelsCreated = 0;
    let classGroupsUpdated = 0;
    let classGroupsSkipped = 0;

    for (const classGroup of classGroups) {
      // Extract class level from name (e.g., "JSS 1" from "JSS 1-A")
      const nameMatch = classGroup.name.match(/^([A-Z]+ \d+)/);
      const levelName = nameMatch ? nameMatch[1] : classGroup.name;

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
          console.log(`Created ClassLevel: ${levelName}`);
        } else {
          console.log(`[DRY RUN] Would create ClassLevel: ${levelName}`);
          classLevel = { _id: new mongoose.Types.ObjectId() } as any;
        }
      }

      // Find corresponding Period from sessionId
      const newPeriodId = periodMapping.get(classGroup.sessionId.toString());
      if (newPeriodId && classLevel) {
        if (!dryRun) {
          await oldClassGroupModel.findByIdAndUpdate(classGroup._id, {
            classLevelId: classLevel._id,
            periodId: newPeriodId,
            $unset: { name: 1, sessionId: 1 }
          });
          classGroupsUpdated++;
          console.log(`Updated ClassGroup: ${classGroup.name} -> ${levelName}`);
        } else {
          console.log(`[DRY RUN] Would update ClassGroup: ${classGroup.name} -> ${levelName}`);
        }
      } else {
        classGroupsSkipped++;
        console.log(`Skipped ClassGroup (no period mapping): ${classGroup.name}`);
      }
    }

    console.log(`Step 3 Summary: ${classLevelsCreated} ClassLevels created, ${classGroupsUpdated} ClassGroups updated, ${classGroupsSkipped} ClassGroups skipped`);

    // Step 4: Update StudentResult to use Period
    console.log('Step 4: Updating StudentResult to use Period...');
    const studentResults = await oldStudentResultModel.find({}) as OldStudentResult[];
    console.log(`Found ${studentResults.length} StudentResults to update`);

    let studentResultsUpdated = 0;
    let studentResultsSkipped = 0;

    for (const result of studentResults) {
      const newPeriodId = periodMapping.get(result.sessionId.toString());
      if (newPeriodId) {
        if (!dryRun) {
          await oldStudentResultModel.findByIdAndUpdate(result._id, {
            periodId: newPeriodId,
            verificationCode: `SR${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            $unset: { sessionId: 1 }
          });
          studentResultsUpdated++;
        } else {
          console.log(`[DRY RUN] Would update StudentResult: ${result._id}`);
        }
      } else {
        studentResultsSkipped++;
      }
    }

    console.log(`Step 4 Summary: ${studentResultsUpdated} StudentResults updated, ${studentResultsSkipped} skipped`);

    // Step 5: Update SubjectRegistration to use Period
    console.log('Step 5: Updating SubjectRegistration to use Period...');
    const subjectRegistrations = await oldSubjectRegistrationModel.find({}) as OldSubjectRegistration[];
    console.log(`Found ${subjectRegistrations.length} SubjectRegistrations to update`);

    let subjectRegistrationsUpdated = 0;
    let subjectRegistrationsSkipped = 0;

    for (const registration of subjectRegistrations) {
      const newPeriodId = periodMapping.get(registration.sessionId.toString());
      if (newPeriodId) {
        if (!dryRun) {
          await oldSubjectRegistrationModel.findByIdAndUpdate(registration._id, {
            sessionId: newPeriodId,
          });
          subjectRegistrationsUpdated++;
        } else {
          console.log(`[DRY RUN] Would update SubjectRegistration: ${registration._id}`);
        }
      } else {
        subjectRegistrationsSkipped++;
      }
    }

    console.log(`Step 5 Summary: ${subjectRegistrationsUpdated} SubjectRegistrations updated, ${subjectRegistrationsSkipped} skipped`);

    // Step 6: Update Attendance to use Period
    console.log('Step 6: Updating Attendance to use Period...');
    const attendances = await oldAttendanceModel.find({}) as OldAttendance[];
    console.log(`Found ${attendances.length} Attendance records to update`);

    let attendancesUpdated = 0;
    let attendancesSkipped = 0;

    for (const attendance of attendances) {
      // Get the class to find its periodId
      const classGroup = await oldClassGroupModel.findById(attendance.classId) as any;
      if (classGroup && classGroup.periodId) {
        if (!dryRun) {
          await oldAttendanceModel.findByIdAndUpdate(attendance._id, {
            sessionId: classGroup.periodId,
          });
          attendancesUpdated++;
        } else {
          console.log(`[DRY RUN] Would update Attendance: ${attendance._id}`);
        }
      } else {
        attendancesSkipped++;
      }
    }

    console.log(`Step 6 Summary: ${attendancesUpdated} Attendance records updated, ${attendancesSkipped} skipped`);

    // Step 7: Update FeeInvoice to use Period
    console.log('Step 7: Updating FeeInvoice to use Period...');
    const feeInvoices = await oldFeeInvoiceModel.find({}) as OldFeeInvoice[];
    console.log(`Found ${feeInvoices.length} FeeInvoices to update`);

    let feeInvoicesUpdated = 0;
    let feeInvoicesSkipped = 0;

    for (const invoice of feeInvoices) {
      const newPeriodId = periodMapping.get(invoice.sessionId.toString());
      if (newPeriodId) {
        if (!dryRun) {
          await oldFeeInvoiceModel.findByIdAndUpdate(invoice._id, {
            sessionId: newPeriodId,
          });
          feeInvoicesUpdated++;
        } else {
          console.log(`[DRY RUN] Would update FeeInvoice: ${invoice._id}`);
        }
      } else {
        feeInvoicesSkipped++;
      }
    }

    console.log(`Step 7 Summary: ${feeInvoicesUpdated} FeeInvoices updated, ${feeInvoicesSkipped} skipped`);

    if (dryRun) {
      console.log('\n=== DRY RUN COMPLETE ===');
      console.log('No changes were made to the database.');
      console.log('Review the summary above to verify the migration plan.');
    } else {
      console.log('\n=== MIGRATION COMPLETE ===');
      console.log('Summary:');
      console.log(`- ${sessionsCreated} Sessions created`);
      console.log(`- ${periodsCreated} Periods created`);
      console.log(`- ${periodsSetActive} Periods set active`);
      console.log(`- ${classLevelsCreated} ClassLevels created`);
      console.log(`- ${classGroupsUpdated} ClassGroups updated`);
      console.log(`- ${studentResultsUpdated} StudentResults updated`);
      console.log(`- ${subjectRegistrationsUpdated} SubjectRegistrations updated`);
      console.log(`- ${attendancesUpdated} Attendance records updated`);
      console.log(`- ${feeInvoicesUpdated} FeeInvoices updated`);
      console.log('\nWARNING: After verification, you can drop the AcademicSession collection');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

// Run if executed directly
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  console.log(`Database: ${connectionString}`);
  console.log('');

  if (!dryRun) {
    console.log('⚠️  WARNING: This will modify your live database!');
    console.log('⚠️  Make sure you have a backup before proceeding.');
    console.log('');
    console.log('To do a dry run first, use: npm run migrate -- --dry-run');
    console.log('');
  }

  mongoose.connect(connectionString)
    .then(() => {
      console.log('Connected to MongoDB');
      return migrateToSessionTermPeriod(dryRun);
    })
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}
