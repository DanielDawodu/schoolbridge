import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function checkIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    if (!mongoose.connection.db) {
      console.error('Database connection not established');
      process.exit(1);
    }

    const db = mongoose.connection.db;

    console.log('=== Session Indexes ===');
    const sessionIndexes = await db.collection('sessions').indexes();
    console.log(JSON.stringify(sessionIndexes, null, 2));

    console.log('\n=== Period Indexes ===');
    const periodIndexes = await db.collection('periods').indexes();
    console.log(JSON.stringify(periodIndexes, null, 2));

    console.log('\n=== ClassLevel Indexes ===');
    const classLevelIndexes = await db.collection('classlevels').indexes();
    console.log(JSON.stringify(classLevelIndexes, null, 2));

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkIndexes();
