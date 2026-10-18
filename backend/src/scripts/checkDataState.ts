import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function checkDataState() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    if (!mongoose.connection.db) {
      console.error('Database connection not established');
      process.exit(1);
    }

    const db = mongoose.connection.db;

    console.log('=== 1. AcademicSession Collection ===\n');
    const academicSessions = await db.collection('academicsessions').find({}).toArray();
    console.log(`Total AcademicSessions: ${academicSessions.length}`);
    academicSessions.forEach((as: any) => {
      console.log(`  ID: ${as._id}, School: ${as.schoolId}, Year: ${as.year}, CurrentTerm: ${as.currentTerm}`);
    });

    console.log('\n=== 2. Session Collection ===\n');
    const sessions = await db.collection('sessions').find({}).toArray();
    console.log(`Total Sessions: ${sessions.length}`);
    sessions.forEach((s: any) => {
      console.log(`  ID: ${s._id}, School: ${s.schoolId}, Year: ${s.year}`);
    });

    console.log('\n=== 3. Period Collection ===\n');
    const periods = await db.collection('periods').find({}).toArray();
    console.log(`Total Periods: ${periods.length}`);
    periods.forEach((p: any) => {
      console.log(`  ID: ${p._id}, School: ${p.schoolId}, Session: ${p.sessionId}, Term: ${p.termId}, Active: ${p.isActive}`);
    });

    console.log('\n=== 4. Term Collection ===\n');
    const terms = await db.collection('terms').find({}).toArray();
    console.log(`Total Terms: ${terms.length}`);
    terms.forEach((t: any) => {
      console.log(`  ID: ${t._id}, School: ${t.schoolId}, Name: ${t.name}`);
    });

    console.log('\n=== 5. School Document (Ijebu-Ode) ===\n');
    const ijebuOdeSchoolId = '6ab7023b356724906c40d4fa';
    const school = await db.collection('schools').findOne({ _id: new mongoose.Types.ObjectId(ijebuOdeSchoolId) });
    if (school) {
      console.log(`School: ${school.name}`);
      console.log(`  activeTermId (legacy): ${school.activeTermId || 'not set'}`);
      console.log(`  activePeriodId (new): ${school.activePeriodId || 'not set'}`);
    } else {
      console.log('School not found');
    }

    console.log('\n=== 6. Backup Files ===\n');
    const backupDir = path.join(__dirname, '../../backups');
    try {
      const files = fs.readdirSync(backupDir);
      console.log('Backup files present:');
      files.forEach((file: string) => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        console.log(`  ${file} (${stats.size} bytes)`);
      });

      // Check academicsessions.json specifically
      const academicSessionsBackup = JSON.parse(fs.readFileSync(path.join(backupDir, 'academicsessions.json'), 'utf-8'));
      console.log(`\nAcademicSessions in backup: ${academicSessionsBackup.length}`);
      academicSessionsBackup.forEach((as: any) => {
        console.log(`  ID: ${as._id}, School: ${as.schoolId}, Year: ${as.year}, CurrentTerm: ${as.currentTerm}`);
      });
    } catch (error) {
      console.log('Error reading backup directory:', error);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDataState();
