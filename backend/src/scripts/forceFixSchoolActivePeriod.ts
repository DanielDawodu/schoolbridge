import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function forceFixSchoolActivePeriod() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    if (!mongoose.connection.db) {
      console.error('Database connection not established');
      process.exit(1);
    }

    const db = mongoose.connection.db;

    // Get current School documents
    const schools = await db.collection('schools').find({}).toArray();
    console.log('=== Current School Documents ===\n');
    schools.forEach((s: any) => {
      console.log(`School: ${s.name}`);
      console.log(`  _id: ${s._id}`);
      console.log(`  activeTermId: ${s.activeTermId || 'not set'}`);
      console.log(`  activePeriodId: ${s.activePeriodId || 'not set'}`);
      console.log('');
    });

    // The correct Period ID for Ijebu-Ode's 2026/2027 - first term
    const correctPeriodId = '6ac1fd00b55fe9017fbff3ef';
    const ijebuOdeSchoolId = '6ab7023b356724906c40d4fa';

    console.log('=== Force Updating Ijebu-Ode School ===\n');
    console.log(`Setting activePeriodId to: ${correctPeriodId}`);

    const result = await db.collection('schools').updateOne(
      { _id: new mongoose.Types.ObjectId(ijebuOdeSchoolId) },
      { $set: { activePeriodId: new mongoose.Types.ObjectId(correctPeriodId) } }
    );

    console.log(`Update result: ${result.modifiedCount} document(s) modified\n`);

    // Verify
    const updatedSchool = await db.collection('schools').findOne({ _id: new mongoose.Types.ObjectId(ijebuOdeSchoolId) });
    console.log('=== Verification ===\n');
    console.log(`School: ${updatedSchool?.name}`);
    console.log(`  activePeriodId: ${updatedSchool?.activePeriodId}`);

    const period = await db.collection('periods').findOne({ _id: new mongoose.Types.ObjectId(correctPeriodId) });
    if (period) {
      const session = await db.collection('sessions').findOne({ _id: period.sessionId });
      const term = await db.collection('terms').findOne({ _id: period.termId });
      console.log(`  → ${session?.year} - ${term?.name} (isActive: ${period.isActive})`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

forceFixSchoolActivePeriod();
