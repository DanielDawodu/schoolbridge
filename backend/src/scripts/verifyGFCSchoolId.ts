import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function verifyGFCSchoolId() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    if (!mongoose.connection.db) {
      console.error('Database connection not established');
      process.exit(1);
    }

    const db = mongoose.connection.db;

    const gfcSchoolId = '6ab702d6c091fe5a7b3f88a5';

    console.log('=== Check 2: GFC Session/Period schoolId Verification ===\n');
    console.log(`GFC School ID: ${gfcSchoolId}\n`);

    // Get GFC Sessions
    const sessions = await db.collection('sessions').find({ schoolId: new mongoose.Types.ObjectId(gfcSchoolId) }).toArray();
    console.log(`GFC Sessions: ${sessions.length}`);
    sessions.forEach((s: any) => {
      console.log(`  Session ID: ${s._id}`);
      console.log(`  Year: ${s.year}`);
      console.log(`  schoolId: ${s.schoolId}`);
      console.log(`  Match: ${s.schoolId.toString() === gfcSchoolId ? '✅' : '❌'}`);
      console.log('');
    });

    // Get GFC Periods
    const periods = await db.collection('periods').find({ schoolId: new mongoose.Types.ObjectId(gfcSchoolId) }).toArray();
    console.log(`GFC Periods: ${periods.length}`);
    periods.forEach((p: any) => {
      console.log(`  Period ID: ${p._id}`);
      console.log(`  schoolId: ${p.schoolId}`);
      console.log(`  sessionId: ${p.sessionId}`);
      console.log(`  termId: ${p.termId}`);
      console.log(`  Match: ${p.schoolId.toString() === gfcSchoolId ? '✅' : '❌'}`);
      console.log('');
    });

    // Get GFC Terms
    const terms = await db.collection('terms').find({ schoolId: new mongoose.Types.ObjectId(gfcSchoolId) }).toArray();
    console.log(`GFC Terms: ${terms.length}`);
    terms.forEach((t: any) => {
      console.log(`  Term ID: ${t._id}`);
      console.log(`  Name: ${t.name}`);
      console.log(`  schoolId: ${t.schoolId}`);
      console.log(`  Match: ${t.schoolId.toString() === gfcSchoolId ? '✅' : '❌'}`);
      console.log('');
    });

    // Get GFC ClassLevels
    const classLevels = await db.collection('classlevels').find({ schoolId: new mongoose.Types.ObjectId(gfcSchoolId) }).toArray();
    console.log(`GFC ClassLevels: ${classLevels.length}`);
    classLevels.forEach((cl: any) => {
      console.log(`  ClassLevel ID: ${cl._id}`);
      console.log(`  Name: ${cl.name}`);
      console.log(`  schoolId: ${cl.schoolId}`);
      console.log(`  Match: ${cl.schoolId.toString() === gfcSchoolId ? '✅' : '❌'}`);
      console.log('');
    });

    // Verify no cross-contamination
    console.log('=== Cross-Contamination Check ===\n');
    const ijebuOdeSchoolId = '6ab7023b356724906c40d4fa';

    const ijebuOdeSessions = await db.collection('sessions').find({ schoolId: new mongoose.Types.ObjectId(ijebuOdeSchoolId) }).toArray();
    const gfcSessionsInIjebuOde = ijebuOdeSessions.filter((s: any) => s.schoolId.toString() === gfcSchoolId);
    console.log(`Ijebu-Ode Sessions incorrectly marked as GFC: ${gfcSessionsInIjebuOde.length}`);

    const ijebuOdePeriods = await db.collection('periods').find({ schoolId: new mongoose.Types.ObjectId(ijebuOdeSchoolId) }).toArray();
    const gfcPeriodsInIjebuOde = ijebuOdePeriods.filter((p: any) => p.schoolId.toString() === gfcSchoolId);
    console.log(`Ijebu-Ode Periods incorrectly marked as GFC: ${gfcPeriodsInIjebuOde.length}`);

    if (gfcSessionsInIjebuOde.length === 0 && gfcPeriodsInIjebuOde.length === 0) {
      console.log('✅ No cross-contamination detected');
    } else {
      console.log('❌ Cross-contamination detected!');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyGFCSchoolId();
