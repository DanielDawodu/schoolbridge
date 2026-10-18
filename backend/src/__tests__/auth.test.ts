import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../index';
import School from '../models/School';
import User from '../models/User';

describe('Auth Tests', () => {
  beforeAll(async () => {
    const mongoURI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/schoolbridge_test';
    await mongoose.connect(mongoURI);
  });

  afterEach(async () => {
    await School.deleteMany({});
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/auth/signup', () => {
    it('should create exactly one School and one admin User', async () => {
      const response = await request(app).post('/api/auth/signup').send({
        schoolName: 'Test School',
        schoolAddress: '123 Test Street',
        adminName: 'Test Admin',
        adminEmail: 'admin@test.com',
        adminPassword: 'password123',
      });

      expect(response.status).toBe(201);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.role).toBe('admin');
      expect(response.body.school.name).toBe('Test School');

      const schools = await School.find({});
      const users = await User.find({});

      expect(schools.length).toBe(1);
      expect(users.length).toBe(1);
      expect(users[0].role).toBe('admin');
    });

    it('should reject duplicate email', async () => {
      await request(app).post('/api/auth/signup').send({
        schoolName: 'Test School',
        schoolAddress: '123 Test Street',
        adminName: 'Test Admin',
        adminEmail: 'admin@test.com',
        adminPassword: 'password123',
      });

      const response = await request(app).post('/api/auth/signup').send({
        schoolName: 'Another School',
        schoolAddress: '456 Another Street',
        adminName: 'Another Admin',
        adminEmail: 'admin@test.com',
        adminPassword: 'password456',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send({
        schoolName: 'Test School',
        schoolAddress: '123 Test Street',
        adminName: 'Test Admin',
        adminEmail: 'admin@test.com',
        adminPassword: 'password123',
      });
    });

    it('should succeed with correct credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'admin@test.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('admin@test.com');
    });

    it('should fail with wrong password', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'admin@test.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should fail with non-existent email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@test.com',
        password: 'password123',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });
  });
});
