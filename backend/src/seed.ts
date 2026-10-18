import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import School from './models/School';
import User from './models/User';
import AcademicSession from './models/AcademicSession';
import ClassGroup from './models/ClassGroup';
import Student from './models/Student';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbridge';

const nigerianNames = [
  { fullName: 'Chinedu Okafor', gender: 'Male' },
  { fullName: 'Adewale Adeyemi', gender: 'Male' },
  { fullName: 'Ngozi Eze', gender: 'Female' },
  { fullName: 'Emeka Nwosu', gender: 'Male' },
  { fullName: 'Fatima Ibrahim', gender: 'Female' },
  { fullName: 'Oluwaseun Bakare', gender: 'Male' },
  { fullName: 'Chioma Okonkwo', gender: 'Female' },
  { fullName: 'Ifeanyi Obi', gender: 'Male' },
  { fullName: 'Aisha Mohammed', gender: 'Female' },
  { fullName: 'Tunde Balogun', gender: 'Male' },
  { fullName: 'Grace Nnamdi', gender: 'Female' },
  { fullName: 'Kehinde Ojo', gender: 'Male' },
  { fullName: 'Blessing Enyinna', gender: 'Female' },
  { fullName: 'Chukwuemeka Okoro', gender: 'Male' },
  { fullName: 'Olamide Adeyinka', gender: 'Male' },
  { fullName: 'Peace Adebanjo', gender: 'Female' },
  { fullName: 'Uchechukwu Madu', gender: 'Male' },
  { fullName: 'Esther Chukwuma', gender: 'Female' },
  { fullName: 'David Oladipo', gender: 'Male' },
  { fullName: 'Ruth Akinwale', gender: 'Female' },
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await School.deleteMany({});
    await User.deleteMany({});
    await AcademicSession.deleteMany({});
    await ClassGroup.deleteMany({});
    await Student.deleteMany({});
    console.log('Cleared existing data');

    // Create demo school
    const school = new School({
      name: 'Ijebu-Ode Comprehensive College',
      address: '15, Adeola Odutola Street, Ijebu-Ode, Ogun State',
    });
    await school.save();
    console.log('Created demo school:', school.name);

    // Create admin user
    const passwordHash = await bcrypt.hash('admin123', 10);
    const admin = new User({
      schoolId: school._id,
      name: 'Principal Adeyemi',
      email: 'admin@ijebuodecollege.com',
      passwordHash,
      role: 'admin',
    });
    await admin.save();
    console.log('Created admin user:', admin.email);

    // Create academic session
    const session = new AcademicSession({
      schoolId: school._id,
      year: '2026/2027',
      currentTerm: 'first',
    });
    await session.save();
    console.log('Created academic session:', session.year);

    // Create classes
    const classGroups = [
      { name: 'JSS 1', arm: 'A' },
      { name: 'JSS 1', arm: 'B' },
      { name: 'JSS 2', arm: 'A' },
    ];

    const createdClasses = [];
    for (const classData of classGroups) {
      const classGroup = new ClassGroup({
        schoolId: school._id,
        name: classData.name,
        arm: classData.arm,
        sessionId: session._id,
      });
      await classGroup.save();
      createdClasses.push(classGroup);
      console.log(`Created class: ${classData.name} - ${classData.arm}`);
    }

    // Create students
    const students = [];
    for (let i = 0; i < nigerianNames.length; i++) {
      const nameData = nigerianNames[i];
      const classIndex = i % createdClasses.length;
      const year = 2010 + Math.floor(Math.random() * 3);
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');

      const student = new Student({
        schoolId: school._id,
        fullName: nameData.fullName,
        admissionNo: `2026${String(i + 1).padStart(3, '0')}`,
        classId: createdClasses[classIndex]._id,
        gender: nameData.gender,
        dateOfBirth: `${year}-${month}-${day}`,
        guardianName: `${nameData.fullName.split(' ')[0]}'s Parent`,
        guardianPhone: `080${Math.floor(Math.random() * 900000000 + 100000000)}`,
        address: `${Math.floor(Math.random() * 100) + 1}, ${['Itele', 'Igbeba', 'Sagamu', 'Ago-Iwoye'][Math.floor(Math.random() * 4)]} Road, Ijebu-Ode`,
        status: 'active',
      });
      await student.save();
      students.push(student);
    }
    console.log(`Created ${students.length} students`);

    console.log('\n✅ Database seeded successfully!');
    console.log('\nLogin credentials:');
    console.log('Email: admin@ijebuodecollege.com');
    console.log('Password: admin123');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

seedDatabase();
