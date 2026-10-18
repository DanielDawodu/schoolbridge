import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function verify(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;
    if (!db) {
      console.error('Database not connected');
      process.exit(1);
    }

    // Check Sessions
    const sessions = await db.collection('sessions').find({}).toArray();
    console.log(`=== Sessions: ${sessions.length} documents ===`);
    sessions.forEach((s: any) => {
      console.log(`  Year: ${s.year}, School: ${s.schoolId}`);
    });

    // Check Periods
    const periods = await db.collection('periods').find({}).toArray();
    console.log(`\n=== Periods: ${periods.length} documents ===`);
    periods.forEach((p: any) => {
      console.log(`  School: ${p.schoolId}, Session: ${p.sessionId}, Term: ${p.termId}, Active: ${p.isActive}`);
    });

    // Check ClassLevels
    const classLevels = await db.collection('classlevels').find({}).toArray();
    console.log(`\n=== ClassLevels: ${classLevels.length} documents ===`);
    classLevels.forEach((cl: any) => {
      console.log(`  Name: ${cl.name}, School: ${cl.schoolId}`);
    });

    // Check ClassGroups
    const classGroups = await db.collection('classgroups').find({}).toArray();
    console.log(`\n=== ClassGroups: ${classGroups.length} documents ===`);
    classGroups.forEach((cg: any) => {
      console.log(`  School: ${cg.schoolId}, ClassLevel: ${cg.classLevelId}, Period: ${cg.periodId}, Arm: ${cg.arm}`);
    });

    // Check Attendance
    const attendance = await db.collection('attendances').find({}).toArray();
    console.log(`\n=== Attendance: ${attendance.length} documents ===`);
    attendance.forEach((a: any) => {
      console.log(`  SessionId (now Period): ${a.sessionId}, Student: ${a.studentId}, Date: ${a.date}`);
    });

    // Check FeeInvoices
    const feeInvoices = await db.collection('feeinvoices').find({}).limit(3).toArray();
    console.log(`\n=== FeeInvoices (first 3 of 31) ===`);
    feeInvoices.forEach((fi: any) => {
      console.log(`  TermId (now Period): ${fi.termId}, Student: ${fi.studentId}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verify();
