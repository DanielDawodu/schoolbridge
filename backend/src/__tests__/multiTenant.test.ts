import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../index';
import School from '../models/School';
import User from '../models/User';
import Student from '../models/Student';
import ClassGroup from '../models/ClassGroup';
import AcademicSession from '../models/AcademicSession';

describe('Multi-Tenant Isolation Tests', () => {
  let schoolAToken: string;
  let schoolBToken: string;
  let schoolAId: string;
  let schoolBId: string;
  let sessionAId: string;
  let sessionBId: string;
  let classAId: string;
  let classBId: string;
  let studentAId: string;
  let studentBId: string;

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
    schoolAId = schoolAResponse.body.school.id;

    // Create School B
    const schoolBResponse = await request(app).post('/api/auth/signup').send({
      schoolName: 'School B',
      schoolAddress: '456 Street B',
      adminName: 'Admin B',
      adminEmail: 'admin@schoolb.com',
      adminPassword: 'password456',
    });
    schoolBToken = schoolBResponse.body.token;
    schoolBId = schoolBResponse.body.school.id;

    // Create academic sessions
    const sessionA = await request(app)
      .post('/api/academic-sessions')
      .set('Authorization', `Bearer ${schoolAToken}`)
      .send({ year: '2026/2027', currentTerm: 'first' });
    sessionAId = sessionA.body._id;

    const sessionB = await request(app)
      .post('/api/academic-sessions')
      .set('Authorization', `Bearer ${schoolBToken}`)
      .send({ year: '2026/2027', currentTerm: 'first' });
    sessionBId = sessionB.body._id;

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

    // Create students
    const studentA = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${schoolAToken}`)
      .send({
        fullName: 'Student A',
        admissionNo: 'A001',
        classId: classAId,
        gender: 'Male',
        dateOfBirth: '2010-01-01',
        guardianName: 'Guardian A',
        guardianPhone: '08012345678',
        address: 'Address A',
      });
    studentAId = studentA.body._id;

    const studentB = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${schoolBToken}`)
      .send({
        fullName: 'Student B',
        admissionNo: 'B001',
        classId: classBId,
        gender: 'Female',
        dateOfBirth: '2010-01-01',
        guardianName: 'Guardian B',
        guardianPhone: '08087654321',
        address: 'Address B',
      });
    studentBId = studentB.body._id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('School A cannot access School B data', () => {
    it('should not allow School A to fetch School B students', async () => {
      const response = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${schoolAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].fullName).toBe('Student A');
      expect(response.body[0].admissionNo).toBe('A001');
    });

    it('should not allow School A to fetch School B classes', async () => {
      const response = await request(app)
        .get('/api/classes')
        .set('Authorization', `Bearer ${schoolAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('JSS 1');
      expect(response.body[0].sessionId).toBe(sessionAId);
    });

    it('should not allow School A to fetch School B sessions', async () => {
      const response = await request(app)
        .get('/api/academic-sessions')
        .set('Authorization', `Bearer ${schoolAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].schoolId).toBe(schoolAId);
    });

    it('should not allow School A to access School B student by ID', async () => {
      const response = await request(app)
        .get(`/api/students/${studentBId}`)
        .set('Authorization', `Bearer ${schoolAToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Student not found');
    });

    it('should not allow School A to access School B class by ID', async () => {
      const response = await request(app)
        .get(`/api/classes/${classBId}`)
        .set('Authorization', `Bearer ${schoolAToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Class not found');
    });

    it('should not allow School A to delete School B student', async () => {
      const response = await request(app)
        .delete(`/api/students/${studentBId}`)
        .set('Authorization', `Bearer ${schoolAToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Student not found');

      // Verify student still exists
      const student = await Student.findById(studentBId);
      expect(student).not.toBeNull();
    });

    it('should not allow School A to update School B student', async () => {
      const response = await request(app)
        .put(`/api/students/${studentBId}`)
        .set('Authorization', `Bearer ${schoolAToken}`)
        .send({ fullName: 'Hacked Name' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Student not found');

      // Verify student was not updated
      const student = await Student.findById(studentBId);
      expect(student?.fullName).toBe('Student B');
    });
  });

  describe('School B cannot access School A data', () => {
    it('should not allow School B to fetch School A students', async () => {
      const response = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${schoolBToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].fullName).toBe('Student B');
      expect(response.body[0].admissionNo).toBe('B001');
    });

    it('should not allow School B to fetch School A classes', async () => {
      const response = await request(app)
        .get('/api/classes')
        .set('Authorization', `Bearer ${schoolBToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].sessionId).toBe(sessionBId);
    });
  });
});
