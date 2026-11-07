import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';
const BACKUP_DIR = path.join(__dirname, '../../backups');

const COLLECTIONS = [
  'schools',
  'users',
  'students',
  'classlevels',
  'classgroups',
  'subjects',
  'subjectregistrations',
  'studentresults',
  'periods',
  'sessions',
  'terms',
  'academicsessions',
  'attendances',
  'billtemplates',
  'feeinvoices',
  'feepayments',
  'paymentvouchers',
  'auditlogs',
];

async function backupCollection(collectionName: string, timestampDir: string): Promise<number> {
  try {
    const collection = mongoose.connection.collection(collectionName);
    const documents = await collection.find({}).toArray();

    const backupPath = path.join(timestampDir, `${collectionName}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(documents, null, 2));

    // Also update the 'latest' snapshot for quick access
    const latestPath = path.join(BACKUP_DIR, 'latest', `${collectionName}.json`);
    fs.writeFileSync(latestPath, JSON.stringify(documents, null, 2));

    console.log(`✓ Backed up ${collectionName}: ${documents.length} records`);
    return documents.length;
  } catch (error) {
    console.error(`✗ Failed to backup ${collectionName}:`, error);
    throw error;
  }
}

async function runBackup(): Promise<void> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const timestampDir = path.join(BACKUP_DIR, `snapshot-${timestamp}`);
    const latestDir = path.join(BACKUP_DIR, 'latest');

    console.log('--- SCHOOLBRIDGE AUTOMATED BACKUP ---');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Backup Destination: ${timestampDir}`);

    if (!fs.existsSync(timestampDir)) {
      fs.mkdirSync(timestampDir, { recursive: true });
    }
    if (!fs.existsSync(latestDir)) {
      fs.mkdirSync(latestDir, { recursive: true });
    }

    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined.');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✓ Database connection established');

    const manifest: Record<string, any> = {
      backupTimestamp: new Date().toISOString(),
      collections: {},
    };

    let totalRecords = 0;
    for (const collection of COLLECTIONS) {
      const count = await backupCollection(collection, timestampDir);
      manifest.collections[collection] = count;
      totalRecords += count;
    }

    manifest.totalRecords = totalRecords;
    fs.writeFileSync(path.join(timestampDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(latestDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    console.log(`\n✓ Backup completed successfully! Total records backed up: ${totalRecords}`);
    console.log(`Manifest written to: ${path.join(timestampDir, 'manifest.json')}`);
  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runBackup();
