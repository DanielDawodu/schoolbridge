import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function validatePeriodMapping() {
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
    const academicSessionsBackup = JSON.parse(fs.readFileSync(path.join(backupDir, 'academicsessions.json'), 'utf-8'));

    console.log('=== AcademicSession to Period Mapping Validation ===\n');

    const sessions = await db.collection('sessions').find({}).toArray();
    const periods = await db.collection('periods').find({}).toArray();
    const terms = await db.collection('terms').find({}).toArray();

    // Build maps
    const sessionMap = new Map(sessions.map((s: any) => [s.year + '|' + s.schoolId, s]));
    const termMap = new Map(terms.map((t: any) => [t.name + '|' + t.schoolId, t]));

    console.log(`Legacy AcademicSessions: ${academicSessionsBackup.length}`);
    console.log(`Migrated Sessions: ${sessions.length}`);
    console.log(`Migrated Periods: ${periods.length}\n`);

    let expectedPeriods = 0;
    let missingPeriods = 0;

    // Debug: print all periods with their components
    console.log('--- All Periods with Component IDs ---');
    periods.forEach((p: any) => {
      console.log(`Period ${p._id}: schoolId=${p.schoolId}, sessionId=${p.sessionId}, termId=${p.termId}`);
    });
    console.log('');

    for (const as of academicSessionsBackup) {
      expectedPeriods++;
      const sessionKey = as.year + '|' + as.schoolId;
      const session = sessionMap.get(sessionKey);

      if (!session) {
        console.log(`❌ No Session found for AcademicSession ${as._id}: ${as.year} (school ${as.schoolId})`);
        missingPeriods++;
        continue;
      }

      // Map legacy term to new term name
      let termName = '1st Term';
      if (as.currentTerm === 'second') termName = '2nd Term';
      else if (as.currentTerm === 'third') termName = '3rd Term';

      const termKey = termName + '|' + as.schoolId;
      const term = termMap.get(termKey);

      if (!term) {
        console.log(`❌ No Term found for ${termName} (school ${as.schoolId})`);
        missingPeriods++;
        continue;
      }

      // Check if Period exists
      const period = periods.find((p: any) =>
        p.sessionId.toString() === session._id.toString() &&
        p.termId.toString() === term._id.toString() &&
        p.schoolId.toString() === as.schoolId.toString()
      );

      if (period) {
        console.log(`✅ AcademicSession ${as._id} → Period ${period._id}`);
        console.log(`   ${as.year} - ${as.currentTerm} → ${term.name} (Active: ${period.isActive})`);
      } else {
        console.log(`❌ No Period found for AcademicSession ${as._id}`);
        console.log(`   Expected: Session ${session._id} + Term ${term._id} + School ${as.schoolId}`);
        console.log(`   Looking for match among ${periods.length} periods`);
        missingPeriods++;
      }
      console.log('');
    }

    console.log(`\n=== Summary ===`);
    console.log(`Expected Periods: ${expectedPeriods}`);
    console.log(`Actual Periods: ${periods.length}`);
    console.log(`Missing Periods: ${missingPeriods}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

validatePeriodMapping();
