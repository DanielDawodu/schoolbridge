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

    const collections = await db.listCollections().toArray();
    console.log('=== All Collections ===');
    collections.forEach((c: any) => {
      console.log(`  ${c.name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Check failed:', error);
    process.exit(1);
  }
}

check();
