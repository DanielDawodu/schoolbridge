import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function check(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;
    if (!db) {
      console.error('Database not connected');
      process.exit(1);
    }

    // Check FeeInvoices
    const feeInvoices = await db.collection('feeinvoices').find({}).toArray();
    console.log(`=== FeeInvoices: ${feeInvoices.length} documents ===`);
    feeInvoices.forEach((fi: any) => {
      console.log(`  SessionId: ${fi.sessionId}, Student: ${fi.studentId}`);
    });

    // Check AcademicSessions for comparison
    const academicSessions = await db.collection('academicsessions').find({}).toArray();
    console.log(`\n=== AcademicSessions: ${academicSessions.length} documents ===`);
    academicSessions.forEach((as: any) => {
      console.log(`  _id: ${as._id}, School: ${as.schoolId}, Year: ${as.year}, Term: ${as.currentTerm}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Check failed:', error);
    process.exit(1);
  }
}

check();
