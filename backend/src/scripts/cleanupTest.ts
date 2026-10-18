import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function cleanup(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB');

    console.log('Cleaning up test data...');

    // Drop and recreate collections to remove stale indexes
    const db = mongoose.connection.db;
    if (db) {
      await db.dropCollection('sessions').catch(() => {});
      await db.dropCollection('periods').catch(() => {});
      await db.dropCollection('classlevels').catch(() => {});
      await db.dropCollection('terms').catch(() => {});
    }

    console.log('✓ Cleanup complete (collections dropped to remove stale indexes)');

    process.exit(0);
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }
}

cleanup();
