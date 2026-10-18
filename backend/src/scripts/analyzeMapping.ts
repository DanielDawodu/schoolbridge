import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function analyzeMapping() {
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
    const schoolsBackup = JSON.parse(fs.readFileSync(path.join(backupDir, 'schools.json'), 'utf-8'));

    console.log('=== Expected Mapping from Backup ===\n');

    // Find which AcademicSession was active for each school
    for (const school of schoolsBackup) {
      console.log(`School: ${school.name} (${school._id})`);
      console.log(`  Backup activeTermId: ${school.activeTermId || 'none'}`);

      if (school.activeTermId) {
        const activeSession = academicSessionsBackup.find((as: any) => as._id === school.activeTermId);
        if (activeSession) {
          console.log(`  → AcademicSession: ${activeSession.year} - ${activeSession.currentTerm}`);
        }
      }
      console.log('');
    }

    console.log('=== Actual Migrated State ===\n');

    // Get current Sessions and Periods
    const sessions = await db.collection('sessions').find({}).toArray();
    const periods = await db.collection('periods').find({}).toArray();
    const terms = await db.collection('terms').find({}).toArray();

    console.log(`Sessions: ${sessions.length}`);
    console.log(`Periods: ${periods.length}`);
    console.log(`Terms: ${terms.length}\n`);

    // Show mapping for each school
    for (const school of schoolsBackup) {
      console.log(`School: ${school.name}`);

      // Find Sessions for this school
      const schoolSessions = sessions.filter((s: any) => s.schoolId === school._id);
      console.log(`  Sessions:`);
      for (const session of schoolSessions) {
        console.log(`    - ${session.year} (${session._id})`);

        // Find Periods for this Session
        const sessionPeriods = periods.filter((p: any) => p.sessionId === session._id);
        for (const period of sessionPeriods) {
          const term = terms.find((t: any) => t._id === period.termId);
          console.log(`      → Period: ${term?.name} (${period._id}), Active: ${period.isActive}`);
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

analyzeMapping();
