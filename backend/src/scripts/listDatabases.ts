import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function listDatabases() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    if (!mongoose.connection.db) {
      console.error('Database connection not established');
      process.exit(1);
    }

    const admin = mongoose.connection.db.admin();
    const databases = await admin.listDatabases();

    console.log('=== All Databases on Cluster ===\n');
    databases.databases.forEach((db: any) => {
      console.log(`- ${db.name} (size: ${Math.round(db.sizeOnDisk / 1024)} KB)`);
    });

    console.log('\n=== Current Connection Database ===\n');
    console.log(`Database Name: ${mongoose.connection.db.databaseName}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listDatabases();
