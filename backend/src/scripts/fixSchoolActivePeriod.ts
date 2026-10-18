import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function fixSchoolActivePeriod() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    if (!mongoose.connection.db) {
      console.error('Database connection not established');
      process.exit(1);
    }

    const db = mongoose.connection.db;

    // Load backup data
    const backupDir = path.join(__dirname, '../../backups');
    const schoolsBackup = JSON.parse(fs.readFileSync(path.join(backupDir, 'schools.json'), 'utf-8'));
    const academicSessionsBackup = JSON.parse(fs.readFileSync(path.join(backupDir, 'academicsessions.json'), 'utf-8'));

    console.log('=== Fixing School Active Periods ===\n');

    // Get current Periods
    const periods = await db.collection('periods').find({}).toArray();
    const sessions = await db.collection('sessions').find({}).toArray();
    const terms = await db.collection('terms').find({}).toArray();

    for (const schoolBackup of schoolsBackup) {
      console.log(`School: ${schoolBackup.name} (${schoolBackup._id})`);

      if (!schoolBackup.activeTermId) {
        console.log(`  No activeTermId in backup - skipping\n`);
        continue;
      }

      // Find the AcademicSession in backup
      const activeSession = academicSessionsBackup.find((as: any) => as._id === schoolBackup.activeTermId);
      if (!activeSession) {
        console.log(`  activeTermId ${schoolBackup.activeTermId} not found in backup - skipping\n`);
        continue;
      }

      console.log(`  Backup activeTermId: ${schoolBackup.activeTermId}`);
      console.log(`  → AcademicSession: ${activeSession.year} - ${activeSession.currentTerm}`);

      // Find corresponding Session
      const session = sessions.find((s: any) =>
        s.schoolId.toString() === schoolBackup._id.toString() &&
        s.year === activeSession.year
      );

      if (!session) {
        console.log(`  ❌ No Session found for ${activeSession.year}\n`);
        continue;
      }

      // Map legacy term to new term name
      let termName = '1st Term';
      if (activeSession.currentTerm === 'second') termName = '2nd Term';
      else if (activeSession.currentTerm === 'third') termName = '3rd Term';

      // Find corresponding Term
      const term = terms.find((t: any) =>
        t.schoolId.toString() === schoolBackup._id.toString() &&
        t.name === termName
      );

      if (!term) {
        console.log(`  ❌ No Term found for ${termName}\n`);
        continue;
      }

      // Find corresponding Period
      const period = periods.find((p: any) =>
        p.sessionId.toString() === session._id.toString() &&
        p.termId.toString() === term._id.toString() &&
        p.schoolId.toString() === schoolBackup._id.toString()
      );

      if (!period) {
        console.log(`  ❌ No Period found for Session ${session._id} + Term ${term._id}\n`);
        continue;
      }

      console.log(`  ✅ Found Period: ${period._id}`);
      console.log(`     Session: ${session.year}, Term: ${term.name}`);

      // Update School's activePeriodId
      const result = await db.collection('schools').updateOne(
        { _id: schoolBackup._id },
        { $set: { activePeriodId: period._id } }
      );

      console.log(`  Updated School: ${result.modifiedCount} document(s) modified`);

      // Set Period isActive to true
      const periodResult = await db.collection('periods').updateOne(
        { _id: period._id },
        { $set: { isActive: true } }
      );

      console.log(`  Set Period active: ${periodResult.modifiedCount} document(s) modified\n`);
    }

    console.log('=== Verification ===\n');

    const schools = await db.collection('schools').find({}).toArray();
    for (const school of schools) {
      console.log(`School: ${school.name}`);
      console.log(`  activePeriodId: ${school.activePeriodId || 'not set'}`);

      if (school.activePeriodId) {
        const period = await db.collection('periods').findOne({ _id: school.activePeriodId });
        if (period) {
          const session = await db.collection('sessions').findOne({ _id: period.sessionId });
          const term = await db.collection('terms').findOne({ _id: period.termId });
          console.log(`  → ${session?.year} - ${term?.name} (isActive: ${period.isActive})`);
        } else {
          console.log(`  → orphaned (no matching Period)`);
        }
      }
      console.log('');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixSchoolActivePeriod();
