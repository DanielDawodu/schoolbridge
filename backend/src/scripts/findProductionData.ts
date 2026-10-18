import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function findProductionData(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB\n');
    console.log(`Database Name: ${mongoose.connection.name}`);

    const admin = mongoose.connection.client;
    const dbs = await admin.db().admin().listDatabases();
    console.log('\n=== All Databases ===');
    dbs.databases.forEach((d: any) => {
      console.log(`  ${d.name}`);
    });

    // Check for AcademicSessions in each database
    for (const dbInfo of dbs.databases) {
      if (dbInfo.name === 'admin' || dbInfo.name === 'local' || dbInfo.name === 'config') continue;
      
      const testDb = admin.db(dbInfo.name);
      const academicSessions = await testDb.collection('academicsessions').countDocuments();
      if (academicSessions > 0) {
        console.log(`\n${dbInfo.name}: ${academicSessions} AcademicSessions`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Check failed:', error);
    process.exit(1);
  }
}

findProductionData();
