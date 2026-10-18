import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixFeeInvoices(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;
    if (!db) {
      console.error('Database not connected');
      process.exit(1);
    }

    // Get all data
    const periods = await db.collection('periods').find({}).toArray();
    const sessions = await db.collection('sessions').find({}).toArray();
    const terms = await db.collection('terms').find({}).toArray();
    const academicSessions = await db.collection('academicsessions').find({}).toArray();

    console.log(`Found ${periods.length} Periods, ${sessions.length} Sessions, ${terms.length} Terms, ${academicSessions.length} AcademicSessions`);

    // Build lookups
    const sessionMap = new Map(sessions.map((s: any) => [s._id.toString(), s]));
    const termMap = new Map(terms.map((t: any) => [t._id.toString(), t]));

    // Build mapping: AcademicSession ID -> Period ID
    const termNameMap: Record<string, string> = {
      'first': '1st Term',
      'second': '2nd Term',
      'third': '3rd Term',
    };

    const periodMapping = new Map<string, any>();
    for (const academicSession of academicSessions) {
      const termName = termNameMap[academicSession.currentTerm as string];
      const session = sessions.find((s: any) => s.schoolId.toString() === academicSession.schoolId.toString() && s.year === academicSession.year);
      const term = terms.find((t: any) => t.name === termName && t.schoolId.toString() === academicSession.schoolId.toString());

      if (session && term) {
        const period = periods.find((p: any) =>
          p.schoolId.toString() === academicSession.schoolId.toString() &&
          p.sessionId.toString() === session._id.toString() &&
          p.termId.toString() === term._id.toString()
        );
        if (period) {
          periodMapping.set(academicSession._id.toString(), period._id);
          console.log(`Mapped ${academicSession._id} → ${period._id} (${academicSession.year} - ${termName})`);
        }
      }
    }

    console.log(`\nPeriod mapping size: ${periodMapping.size}`);

    // Update FeeInvoices using raw collection
    const feeInvoices = await db.collection('feeinvoices').find({}).toArray();
    console.log(`\nFound ${feeInvoices.length} FeeInvoices to update`);

    let updated = 0;
    let skipped = 0;

    for (const invoice of feeInvoices) {
      const newPeriodId = periodMapping.get(invoice.termId?.toString());
      if (newPeriodId) {
        await db.collection('feeinvoices').updateOne(
          { _id: invoice._id },
          { $set: { termId: newPeriodId } }
        );
        updated++;
        console.log(`Updated FeeInvoice ${invoice._id}`);
      } else {
        skipped++;
        console.log(`Skipped FeeInvoice ${invoice._id} (no mapping for termId ${invoice.termId})`);
      }
    }

    console.log(`\nSummary: ${updated} updated, ${skipped} skipped`);
    process.exit(0);
  } catch (error) {
    console.error('Fix failed:', error);
    process.exit(1);
  }
}

fixFeeInvoices();
