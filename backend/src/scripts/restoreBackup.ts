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

function reviveMongoTypes(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(reviveMongoTypes);
  }
  if (typeof obj === 'object') {
    if (obj.$oid && typeof obj.$oid === 'string') {
      return new mongoose.Types.ObjectId(obj.$oid);
    }
    if (obj.$date) {
      return new Date(obj.$date);
    }
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      if (key === '_id' && typeof obj[key] === 'string' && /^[0-9a-fA-F]{24}$/.test(obj[key])) {
        result[key] = new mongoose.Types.ObjectId(obj[key]);
      } else {
        result[key] = reviveMongoTypes(obj[key]);
      }
    }
    return result;
  }
  return obj;
}

async function runRestore(): Promise<void> {
  const args = process.argv.slice(2);
  const targetDirName = args[0] || 'latest';
  const targetDir = path.isAbsolute(targetDirName) ? targetDirName : path.join(BACKUP_DIR, targetDirName);
  const isClean = args.includes('--clean');

  console.log('--- SCHOOLBRIDGE DATABASE RESTORE UTILITY ---');
  console.log(`Source Snapshot: ${targetDir}`);
  console.log(`Mode: ${isClean ? 'Clean Overwrite (Drop & Replace)' : 'Safe Upsert (Preserves unreferenced records)'}`);

  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Snapshot directory does not exist: ${targetDir}`);
    process.exit(1);
  }

  if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI environment variable is not defined.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    let totalRestored = 0;
    for (const collectionName of COLLECTIONS) {
      const filePath = path.join(targetDir, `${collectionName}.json`);
      if (!fs.existsSync(filePath)) {
        console.log(`- Skipping ${collectionName} (no backup file found in snapshot)`);
        continue;
      }

      const raw = fs.readFileSync(filePath, 'utf8');
      const docs = JSON.parse(raw);
      if (!Array.isArray(docs) || docs.length === 0) {
        console.log(`- ${collectionName}: 0 records in snapshot`);
        continue;
      }

      const revivedDocs = docs.map(reviveMongoTypes);
      const collection = mongoose.connection.collection(collectionName);

      if (isClean) {
        await collection.deleteMany({});
        await collection.insertMany(revivedDocs);
        console.log(`✓ Restored ${collectionName}: ${revivedDocs.length} records (clean insert)`);
      } else {
        const operations = revivedDocs.map((doc) => ({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true,
          },
        }));
        const res = await collection.bulkWrite(operations);
        console.log(`✓ Restored ${collectionName}: ${revivedDocs.length} records (matched: ${res.matchedCount}, upserted: ${res.upsertedCount})`);
      }
      totalRestored += revivedDocs.length;
    }

    console.log(`\n✓ Database restoration complete! Total records processed: ${totalRestored}`);
  } catch (err) {
    console.error('Restoration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runRestore();
