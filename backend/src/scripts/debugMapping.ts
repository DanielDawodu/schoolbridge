import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function debugMapping() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    if (!mongoose.connection.db) {
      console.error('Database connection not established');
      process.exit(1);
    }

    const db = mongoose.connection.db;

    const sessions = await db.collection('sessions').find({}).toArray();
    const periods = await db.collection('periods').find({}).toArray();
    const terms = await db.collection('terms').find({}).toArray();

    console.log('=== All Sessions ===');
    sessions.forEach((s: any) => {
      console.log(`ID: ${s._id}, School: ${s.schoolId}, Year: ${s.year}`);
    });

    console.log('\n=== All Periods ===');
    periods.forEach((p: any) => {
      console.log(`ID: ${p._id}, School: ${p.schoolId}, Session: ${p.sessionId}, Term: ${p.termId}, Active: ${p.isActive}`);
    });

    console.log('\n=== All Terms ===');
    terms.forEach((t: any) => {
      console.log(`ID: ${t._id}, School: ${t.schoolId}, Name: ${t.name}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugMapping();
