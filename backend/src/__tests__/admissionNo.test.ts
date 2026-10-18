import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../index';
import School from '../models/School';
import User from '../models/User';
import Student from '../models/Student';
import ClassGroup from '../models/ClassGroup';
import AcademicSession from '../models/AcademicSession';

describe('Admission Number Uniqueness Tests', () => {
  let schoolAToken: string;
  let schoolBToken: string;
  let classAId: string;
  let classBId: string;

  beforeAll(async () => {
    const mongoURI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/schoolbridge_test';
    await mongoose.connect(mongoURI);
  });

  beforeEach(async () => {
    await School.deleteMany({});
    await User.deleteMany({});
    await Student.deleteMany({});
    await ClassGroup.deleteMany({});
    await AcademicSession.deleteMany({});

    // Create School A
    const schoolAResponse = await request(app).post('/api/auth/signup').send({
      schoolName: 'School A',
      schoolAddress: '123 Street A',
      adminName: 'Admin A',
      adminEmail: 'admin@schoola.com',
      adminPassword: 'password123',
    });
    schoolAToken = schoolAResponse.body.token;

    // Create School B
    const schoolBResponse = await request(app).post('/api/auth/signup').send({
      schoolName: 'School B',
      schoolAddress: '456 Street B',
      adminName: 'Admin B',
      adminEmail: 'admin@schoolb.com',
      adminPassword: 'password456',
    });
    schoolBToken = schoolBResponse.body.token;

    // Create academic sessions
    const sessionA = await request(app)
      .post('/api/academic-sessions')
      .set('Authorization', `Bearer ${schoolAToken}`)
      .send({ year: '2026/2027', currentTerm: 'first' });
    const sessionAId = sessionA.body._id;

    const sessionB = await request(app)
      .post('/api/academic-sessions')
      .set('Authorization', `Bearer ${schoolBToken}`)
      .send({ year: '2026/2027', currentTerm: 'first' });
    const sessionBId = sessionB.body._id;

    // Create classes
    const classA = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${schoolAToken}`)
      .send({ name: 'JSS 1', arm: 'A', sessionId: sessionAId });
    classAId = classA.body._id;

    const classB = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${schoolBToken}`)
      .send({ name: 'JSS 1', arm: 'A', sessionId: sessionBId });
    classBId = classB.body._id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Duplicate admissionNo within same school', () => {
    it('should reject duplicate admissionNo when creating student', async () => {
      // Create first student
      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${schoolAToken}`)
        .send({
          fullName: 'Student A1',
          admissionNo: 'A001',
          classId: classAId,
          gender: 'Male',
          dateOfBirth: '2010-01-01',
          guardianName: 'Guardian A1',
          guardianPhone: '08012345678',
          address: 'Address A1',
        });

      // Try to create second student with same admissionNo
      const response = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${schoolAToken}`)
        .send({
          fullName: 'Student A2',
          admissionNo: 'A001',
          classId: classAId,
          gender: 'Female',
          dateOfBirth: '2010-01-01',
          guardianName: 'Guardian A2',
          guardianPhone: '08087654321',
          address: 'Address A2',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Admission number already exists in this school');

      // Verify only one student exists
      const students = await Student.find({ admissionNo: 'A001' });
      expect(students.length).toBe(1);
    });

    it('should reject duplicate admissionNo when updating student', async () => {
      // Create first student
      const student1 = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${schoolAToken}`)
        .send({
          fullName: 'Student A1',
          admissionNo: 'A001',
          classId: classAId,
          gender: 'Male',
          dateOfBirth: '2010-01-01',
          guardianName: 'Guardian A1',
          guardianPhone: '08012345678',
          address: 'Address A1',
        });

      // Create second student with different admissionNo
      const student2 = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${schoolAToken}`)
        .send({
          fullName: 'Student A2',
          admissionNo: 'A002',
          classId: classAId,
          gender: 'Female',
          dateOfBirth: '2010-01-01',
          guardianName: 'Guardian A2',
          guardianPhone: '08087654321',
          address: 'Address A2',
        });

      // Try to update second student to use first student's admissionNo
      const response = await request(app)
        .put(`/api/students/${student2.body._id}`)
        .set('Authorization', `Bearer ${schoolAToken}`)
        .send({
          fullName: 'Student A2 Updated',
          admissionNo: 'A001',
          classId: classAId,
          gender: 'Female',
          dateOfBirth: '2010-01-01',
          guardianName: 'Guardian A2',
          guardianPhone: '08087654321',
          address: 'Address A2',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Admission number already exists in this school');

      // Verify admissionNo was not changed
      const student = await Student.findById(student2.body._id);
      expect(student?.admissionNo).toBe('A002');
    });
  });

  describe('Duplicate admissionNo across different schools', () => {
    it('should allow same admissionNo in different schools', async () => {
      // Create student in School A
      const responseA = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${schoolAToken}`)
        .send({
          fullName: 'Student A',
          admissionNo: 'SHARED001',
          classId: classAId,
          gender: 'Male',
          dateOfBirth: '2010-01-01',
          guardianName: 'Guardian A',
          guardianPhone: '08012345678',
          address: 'Address A',
        });

      expect(responseA.status).toBe(201);

      // Create student in School B with same admissionNo
      const responseB = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${schoolBToken}`)
        .send({
          fullName: 'Student B',
          admissionNo: 'SHARED001',
          classId: classBId,
          gender: 'Female',
          dateOfBirth: '2010-01-01',
          guardianName: 'Guardian B',
          guardianPhone: '08087654321',
          address: 'Address B',
        });

      expect(responseB.status).toBe(201);

      // Verify both students exist
      const students = await Student.find({ admissionNo: 'SHARED001' });
      expect(students.length).toBe(2);
    });
  });
});
