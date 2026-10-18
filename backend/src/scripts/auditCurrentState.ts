import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function auditCurrentState() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    if (!mongoose.connection.db) {
      console.error('Database connection not established');
      process.exit(1);
    }

    console.log(`Database: ${mongoose.connection.db.databaseName}\n`);

    const db = mongoose.connection.db;

    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('=== Collections and Counts ===\n');

    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(`${coll.name}: ${count}`);
    }

    console.log('\n=== Critical Collection Details ===\n');

    // AcademicSessions (legacy - should still exist)
    const academicSessions = await db.collection('academicsessions').find({}).toArray();
    console.log(`AcademicSessions (legacy): ${academicSessions.length}`);
    academicSessions.forEach((as: any) => {
      console.log(`  - ID: ${as._id}, School: ${as.schoolId}, Year: ${as.year}, CurrentTerm: ${as.currentTerm}`);
    });

    // Sessions (new)
    const sessions = await db.collection('sessions').find({}).toArray();
    console.log(`\nSessions (new): ${sessions.length}`);
    sessions.forEach((s: any) => {
      console.log(`  - ID: ${s._id}, School: ${s.schoolId}, Year: ${s.year}`);
    });

    // Periods (new)
    const periods = await db.collection('periods').find({}).toArray();
    console.log(`\nPeriods (new): ${periods.length}`);
    periods.forEach((p: any) => {
      console.log(`  - ID: ${p._id}, School: ${p.schoolId}, Session: ${p.sessionId}, Term: ${p.termId}, Active: ${p.isActive}`);
    });

    // ClassGroups
    const classGroups = await db.collection('classgroups').find({}).toArray();
    console.log(`\nClassGroups: ${classGroups.length}`);
    classGroups.forEach((cg: any) => {
      console.log(`  - ID: ${cg._id}, School: ${cg.schoolId}, ClassLevel: ${cg.classLevelId}, Arm: ${cg.arm}, Period: ${cg.periodId}`);
    });

    // FeeInvoices
    const feeInvoices = await db.collection('feeinvoices').find({}).limit(3).toArray();
    console.log(`\nFeeInvoices (first 3 of total): ${await db.collection('feeinvoices').countDocuments()}`);
    feeInvoices.forEach((fi: any) => {
      console.log(`  - ID: ${fi._id}, Student: ${fi.studentId}, TermId (now Period): ${fi.termId}, Amount: ${fi.amountDue}`);
    });

    // Attendance
    const attendances = await db.collection('attendances').find({}).toArray();
    console.log(`\nAttendance: ${attendances.length}`);
    attendances.forEach((att: any) => {
      console.log(`  - ID: ${att._id}, Date: ${att.date}, Class: ${att.classId}`);
      // Check for unexpected fields
      if (att.sessionId || att.periodId) {
        console.log(`    WARNING: Has sessionId: ${att.sessionId} or periodId: ${att.periodId}`);
      }
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

auditCurrentState();
