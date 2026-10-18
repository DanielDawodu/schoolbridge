import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function verifySchoolActiveState() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    if (!mongoose.connection.db) {
      console.error('Database connection not established');
      process.exit(1);
    }

    const db = mongoose.connection.db;

    console.log('=== School Active Term/Period State ===\n');

    const schools = await db.collection('schools').find({}).toArray();

    for (const school of schools) {
      console.log(`School: ${school.name} (${school._id})`);
      console.log(`  activeTermId (legacy AcademicSession ref): ${school.activeTermId || 'not set'}`);
      console.log(`  activePeriodId (new Period ref): ${school.activePeriodId || 'not set'}`);

      // Check if activeTermId matches any AcademicSession
      if (school.activeTermId) {
        const academicSession = await db.collection('academicsessions').findOne({ _id: school.activeTermId });
        if (academicSession) {
          console.log(`  → activeTermId points to AcademicSession: ${academicSession.year} - ${academicSession.currentTerm}`);
        } else {
          console.log(`  → activeTermId does not match any AcademicSession (may be orphaned)`);
        }
      }

      // Check if activePeriodId matches any Period
      if (school.activePeriodId) {
        const period = await db.collection('periods').findOne({ _id: school.activePeriodId });
        if (period) {
          const session = await db.collection('sessions').findOne({ _id: period.sessionId });
          const term = await db.collection('terms').findOne({ _id: period.termId });
          console.log(`  → activePeriodId points to Period: ${session?.year} - ${term?.name} (isActive: ${period.isActive})`);
        } else {
          console.log(`  → activePeriodId does not match any Period (orphaned)`);
        }
      }

      console.log('');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifySchoolActiveState();
