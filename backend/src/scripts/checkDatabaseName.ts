import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function check(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB\n');
    console.log(`Database Name: ${mongoose.connection.name}`);

    const db = mongoose.connection.db;
    if (!db) {
      console.error('Database not connected');
      process.exit(1);
    }

    // Check actual documents in sessions from Cluster0
    const sessions = await db.collection('sessions').find({}).toArray();
    console.log(`\nSessions in ${mongoose.connection.name}: ${sessions.length}`);
    sessions.forEach((s: any) => {
      console.log(`  Year: ${s.year}, School: ${s.schoolId}`);
    });

    const periods = await db.collection('periods').find({}).toArray();
    console.log(`\nPeriods in ${mongoose.connection.name}: ${periods.length}`);
    periods.forEach((p: any) => {
      console.log(`  School: ${p.schoolId}, Session: ${p.sessionId}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Check failed:', error);
    process.exit(1);
  }
}

check();
