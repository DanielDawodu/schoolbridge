import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function checkStudents() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    if (!mongoose.connection.db) {
      console.error('Database connection not established');
      process.exit(1);
    }

    const db = mongoose.connection.db;

    const students = await db.collection('students').find({}).limit(5).toArray();
    console.log('=== Sample Students ===\n');
    students.forEach((s: any) => {
      console.log(`Student: ${s.firstName || 'N/A'} ${s.lastName || 'N/A'}`);
      console.log(`  _id: ${s._id}`);
      console.log(`  schoolId: ${s.schoolId}`);
      console.log(`  admissionNo: ${s.admissionNo}`);
      console.log('');
    });
    console.log('=== Sample Students ===\n');
    students.forEach((s: any) => {
      console.log(`Student: ${s.firstName} ${s.lastName}`);
      console.log(`  _id: ${s._id}`);
      console.log(`  schoolId: ${s.schoolId}`);
      console.log(`  admissionNo: ${s.admissionNo}`);
      console.log('');
    });

    const ijebuOdeSchoolId = '6ab7023b356724906c40d4fa';
    const ijebuOdeStudents = await db.collection('students').find({ schoolId: new mongoose.Types.ObjectId(ijebuOdeSchoolId) }).limit(3).toArray();
    console.log(`=== Ijebu-Ode Students (schoolId: ${ijebuOdeSchoolId}) ===\n`);
    console.log(`Count: ${ijebuOdeStudents.length}`);
    ijebuOdeStudents.forEach((s: any) => {
      console.log(`  ${s.firstName} ${s.lastName} (${s._id})`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkStudents();
