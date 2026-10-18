import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../index';
import School from '../models/School';
import User from '../models/User';
import ClassGroup from '../models/ClassGroup';
import AcademicSession from '../models/AcademicSession';
import Student from '../models/Student';

describe('Teacher Management Tests', () => {
  let adminToken: string;
  let schoolId: string;
  let sessionId: string;
  let classAId: string;
  let classBId: string;
  let teacherId: string;
  let teacherToken: string;

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

    // Create school and admin
    const schoolResponse = await request(app).post('/api/auth/signup').send({
      schoolName: 'Test School',
      schoolAddress: '123 Test Street',
      adminName: 'Test Admin',
      adminEmail: 'admin@test.com',
      adminPassword: 'password123',
    });
    adminToken = schoolResponse.body.token;
    schoolId = schoolResponse.body.school.id;

    // Create academic session
    const session = await request(app)
      .post('/api/academic-sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: '2026/2027', currentTerm: 'first' });
    sessionId = session.body._id;

    // Create classes
    const classA = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'JSS 1', arm: 'A', sessionId });
    classAId = classA.body._id;

    const classB = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'JSS 1', arm: 'B', sessionId });
    classBId = classB.body._id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Admin creates teacher', () => {
    it('should create a teacher account', async () => {
      const response = await request(app)
        .post('/api/teachers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Teacher',
          email: 'teacher@test.com',
          password: 'teacher123',
          assignedClasses: [classAId],
        });

      expect(response.status).toBe(201);
      expect(response.body.teacher.name).toBe('Test Teacher');
      expect(response.body.teacher.role).toBe('teacher');
      expect(response.body.credentials.email).toBe('teacher@test.com');
      expect(response.body.credentials.password).toBe('teacher123');
      teacherId = response.body.teacher._id;
    });

    it('should generate password if not provided', async () => {
      const response = await request(app)
        .post('/api/teachers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Auto Teacher',
          email: 'autoteacher@test.com',
        });

      expect(response.status).toBe(201);
      expect(response.body.credentials.password).toBeDefined();
      expect(response.body.credentials.password.length).toBeGreaterThan(0);
    });
  });

  describe('Teacher login and scoped access', () => {
    beforeEach(async () => {
      // Create a teacher
      const teacher = await request(app)
        .post('/api/teachers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Teacher',
          email: 'teacher@test.com',
          password: 'teacher123',
          assignedClasses: [classAId],
        });
      teacherId = teacher.body.teacher._id;

      // Login as teacher
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'teacher@test.com',
        password: 'teacher123',
      });
      teacherToken = loginResponse.body.token;
    });

    it('teacher can log in', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'teacher@test.com',
        password: 'teacher123',
      });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('teacher');
    });

    it('teacher sees only assigned classes', async () => {
      const response = await request(app)
        .get('/api/classes')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0]._id).toBe(classAId);
    });

    it('teacher cannot access unassigned class by ID', async () => {
      const response = await request(app)
        .get(`/api/classes/${classBId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Access denied');
    });

    it('teacher sees only students in assigned classes', async () => {
      // Create students in both classes
      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
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

      await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
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

      const response = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].fullName).toBe('Student A');
    });

    it('teacher cannot access student from unassigned class', async () => {
      // Create student in class B
      const student = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
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

      const response = await request(app)
        .get(`/api/students/${student.body._id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Access denied');
    });
  });

  describe('Class assignment and reassignment', () => {
    beforeEach(async () => {
      const teacher = await request(app)
        .post('/api/teachers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Teacher',
          email: 'teacher@test.com',
          password: 'teacher123',
          assignedClasses: [classAId],
        });
      teacherId = teacher.body.teacher._id;

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'teacher@test.com',
        password: 'teacher123',
      });
      teacherToken = loginResponse.body.token;
    });

    it('admin can reassign teacher to different class', async () => {
      const response = await request(app)
        .patch(`/api/teachers/${teacherId}/assign-classes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedClasses: [classBId] });

      expect(response.status).toBe(200);
      expect(response.body.assignedClasses).toHaveLength(1);
      expect(response.body.assignedClasses[0]._id).toBe(classBId);
    });

    it('teacher access updates after reassignment', async () => {
      // Reassign to class B
      await request(app)
        .patch(`/api/teachers/${teacherId}/assign-classes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedClasses: [classBId] });

      // Get new token
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'teacher@test.com',
        password: 'teacher123',
      });
      const newToken = loginResponse.body.token;

      // Teacher should now see class B
      const response = await request(app)
        .get('/api/classes')
        .set('Authorization', `Bearer ${newToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0]._id).toBe(classBId);
    });
  });

  describe('Teacher deactivation', () => {
    beforeEach(async () => {
      const teacher = await request(app)
        .post('/api/teachers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Teacher',
          email: 'teacher@test.com',
          password: 'teacher123',
        });
      teacherId = teacher.body.teacher._id;
    });

    it('deactivated teacher cannot log in', async () => {
      await request(app)
        .patch(`/api/teachers/${teacherId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const response = await request(app).post('/api/auth/login').send({
        email: 'teacher@test.com',
        password: 'teacher123',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Account is inactive');
    });
  });
});
