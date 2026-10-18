import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

async function verifyStudentRecords() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    if (!mongoose.connection.db) {
      console.error('Database connection not established');
      process.exit(1);
    }

    const db = mongoose.connection.db;

    const ijebuOdeSchoolId = '6ab7023b356724906c40d4fa';
    const studentId = '6ab7023c356724906c40d500'; // First Ijebu-Ode student

    console.log('=== Check 1: Ijebu-Ode Student Records ===\n');
    console.log(`Student ID: ${studentId}`);

    const student = await db.collection('students').findOne({ _id: new mongoose.Types.ObjectId(studentId) });
    console.log('Student document:', JSON.stringify(student, null, 2));

    if (!student) {
      console.log('❌ Student not found');
      await mongoose.disconnect();
      return;
    }

    console.log(`\nAdmission No: ${student.admissionNo}`);
    console.log(`Class ID: ${student.classId}\n`);

    // Get Attendance records for this student's class
    console.log('--- Attendance Records ---');
    const attendances = await db.collection('attendances').find({ classId: student.classId }).toArray();
    console.log(`Total Attendance records for class: ${attendances.length}`);
    attendances.forEach((att: any) => {
      console.log(`  Date: ${att.date}, Class: ${att.classId}`);
      if (att.records) {
        const studentRecord = att.records.find((r: any) => r.studentId.toString() === studentId);
        if (studentRecord) {
          console.log(`    Student status: ${studentRecord.status}`);
        }
      }
    });

    // Get FeeInvoice records for this student
    console.log('\n--- Fee Invoice Records ---');
    const feeInvoices = await db.collection('feeinvoices').find({ studentId: new mongoose.Types.ObjectId(studentId) }).toArray();
    console.log(`Total Fee Invoices for student: ${feeInvoices.length}`);
    feeInvoices.forEach((fi: any) => {
      console.log(`  Invoice ID: ${fi._id}`);
      console.log(`  TermId (now Period): ${fi.termId}`);
      console.log(`  Amount Due: ${fi.amountDue}`);
      console.log(`  Status: ${fi.status}`);
      console.log(`  Due Date: ${fi.dueDate}`);
    });

    // Compare with backup
    console.log('\n--- Comparison with Backup ---');
    const backupDir = path.join(__dirname, '../../backups');
    const studentsBackup = JSON.parse(fs.readFileSync(path.join(backupDir, 'students.json'), 'utf-8'));
    const studentBackup = studentsBackup.find((s: any) => s._id === studentId);
    if (studentBackup) {
      console.log('✅ Student found in backup');
      console.log(`  Backup Admission No: ${studentBackup.admissionNo}`);
      console.log(`  Current Admission No: ${student.admissionNo}`);
      console.log(`  Match: ${studentBackup.admissionNo === student.admissionNo ? '✅' : '❌'}`);
    } else {
      console.log('❌ Student not found in backup');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyStudentRecords();
