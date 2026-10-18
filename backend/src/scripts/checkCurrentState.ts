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

    console.log('=== Current Document Counts ===');
    const collections = ['sessions', 'periods', 'terms', 'classlevels', 'classgroups', 'academicsessions', 'attendances', 'feeinvoices'];
    
    for (const coll of collections) {
      const count = await db.collection(coll).countDocuments();
      console.log(`${coll}: ${count}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Check failed:', error);
    process.exit(1);
  }
}

check();
