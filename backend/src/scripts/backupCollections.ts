import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';
const BACKUP_DIR = path.join(__dirname, '../../backups');

const COLLECTIONS = [
  'academicsessions',
  'classgroups',
  'studentresults',
  'subjectregistrations',
  'attendances',
  'feeinvoices',
  'billtemplates',
  'schools',
  'users',
  'students',
];

async function backupCollection(collectionName: string): Promise<void> {
  try {
    const collection = mongoose.connection.collection(collectionName);
    const documents = await collection.find({}).toArray();

    const backupPath = path.join(BACKUP_DIR, `${collectionName}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(documents, null, 2));

    console.log(`✓ Backed up ${collectionName}: ${documents.length} documents`);
  } catch (error) {
    console.error(`✗ Failed to backup ${collectionName}:`, error);
    throw error;
  }
}

async function runBackup(): Promise<void> {
  try {
    console.log('Starting backup...');
    console.log(`MongoDB URI: ${MONGODB_URI.substring(0, 30)}...`);
    console.log(`Backup directory: ${BACKUP_DIR}`);

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Backup each collection
    for (const collection of COLLECTIONS) {
      await backupCollection(collection);
    }

    console.log('\n✓ Backup complete!');
    console.log(`Backup location: ${BACKUP_DIR}`);
  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runBackup();
