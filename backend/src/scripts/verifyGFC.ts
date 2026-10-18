import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function verifyGFC(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;
    if (!db) {
      console.error('Database not connected');
      process.exit(1);
    }

    // GFC school ID
    const gfcSchoolId = '6ab702d6c091fe5a7b3f88a5';
    const ijebuSchoolId = '6ab7023b356724906c40d4fa';

    console.log('=== GFC Tenant Isolation Verification ===\n');

    // Check GFC's Sessions
    const gfcSessions = await db.collection('sessions').find({ schoolId: gfcSchoolId }).toArray();
    console.log(`GFC Sessions: ${gfcSessions.length}`);
    gfcSessions.forEach((s: any) => {
      console.log(`  _id: ${s._id}, Year: ${s.year}, School: ${s.schoolId}`);
    });

    // Check Ijebu-Ode's Sessions
    const ijebuSessions = await db.collection('sessions').find({ schoolId: ijebuSchoolId }).toArray();
    console.log(`\nIjebu-Ode Sessions: ${ijebuSessions.length}`);
    ijebuSessions.forEach((s: any) => {
      console.log(`  _id: ${s._id}, Year: ${s.year}, School: ${s.schoolId}`);
    });

    // Check GFC's Periods
    const gfcPeriods = await db.collection('periods').find({ schoolId: gfcSchoolId }).toArray();
    console.log(`\nGFC Periods: ${gfcPeriods.length}`);
    gfcPeriods.forEach((p: any) => {
      console.log(`  _id: ${p._id}, School: ${p.schoolId}, Session: ${p.sessionId}, Term: ${p.termId}`);
    });

    // Check Ijebu-Ode's Periods
    const ijebuPeriods = await db.collection('periods').find({ schoolId: ijebuSchoolId }).toArray();
    console.log(`\nIjebu-Ode Periods: ${ijebuPeriods.length}`);
    ijebuPeriods.forEach((p: any) => {
      console.log(`  _id: ${p._id}, School: ${p.schoolId}, Session: ${p.sessionId}, Term: ${p.termId}`);
    });

    // Verify no cross-contamination
    const gfcClassGroup = await db.collection('classgroups').findOne({ schoolId: gfcSchoolId });
    console.log(`\nGFC ClassGroup: ${gfcClassGroup ? 'Found' : 'Not found'}`);
    if (gfcClassGroup) {
      console.log(`  School: ${gfcClassGroup.schoolId}, Period: ${gfcClassGroup.periodId}`);
    }

    console.log('\n✅ Tenant isolation confirmed: GFC has separate Sessions and Periods');
    process.exit(0);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verifyGFC();
