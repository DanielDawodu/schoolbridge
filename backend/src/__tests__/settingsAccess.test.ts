import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../index';
import School from '../models/School';
import User from '../models/User';
import ClassGroup from '../models/ClassGroup';
import AcademicSession from '../models/AcademicSession';

describe('Settings Access Control Tests', () => {
  let adminToken: string;
  let teacherToken: string;
  let sessionId: string;

  beforeAll(async () => {
    const mongoURI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/schoolbridge_test';
    await mongoose.connect(mongoURI);
  });

  beforeEach(async () => {
    await School.deleteMany({});
    await User.deleteMany({});
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

    // Create academic session
    const session = await request(app)
      .post('/api/academic-sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: '2026/2027', currentTerm: 'first' });
    sessionId = session.body._id;

    // Create teacher
    const teacher = await request(app)
      .post('/api/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Teacher',
        email: 'teacher@test.com',
        password: 'teacher123',
      });

    // Login as teacher
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'teacher@test.com',
      password: 'teacher123',
    });
    teacherToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Teacher cannot access academic session endpoints', () => {
    it('teacher GET /api/academic-sessions returns 403', async () => {
      const response = await request(app)
        .get('/api/academic-sessions')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('teacher GET /api/academic-sessions/:id returns 403', async () => {
      const response = await request(app)
        .get(`/api/academic-sessions/${sessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('teacher POST /api/academic-sessions returns 403', async () => {
      const response = await request(app)
        .post('/api/academic-sessions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ year: '2027/2028', currentTerm: 'first' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('teacher PUT /api/academic-sessions/:id returns 403', async () => {
      const response = await request(app)
        .put(`/api/academic-sessions/${sessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ year: '2027/2028', currentTerm: 'second' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('teacher DELETE /api/academic-sessions/:id returns 403', async () => {
      const response = await request(app)
        .delete(`/api/academic-sessions/${sessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('Admin still has full access to settings', () => {
    it('admin GET /api/academic-sessions returns 200', async () => {
      const response = await request(app)
        .get('/api/academic-sessions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('admin GET /api/academic-sessions/:id returns 200', async () => {
      const response = await request(app)
        .get(`/api/academic-sessions/${sessionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(sessionId);
    });

    it('admin PUT /api/academic-sessions/:id returns 200', async () => {
      const response = await request(app)
        .put(`/api/academic-sessions/${sessionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ year: '2027/2028', currentTerm: 'second' });

      expect(response.status).toBe(200);
      expect(response.body.year).toBe('2027/2028');
    });
  });
});
