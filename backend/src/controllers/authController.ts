import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import School from '../models/School';
import User, { IUser } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { getJWTSecret } from '../config/env';

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { schoolName, schoolAddress, adminName, adminEmail, adminPassword } = req.body;

    if (!schoolName || !schoolAddress || !adminName || !adminEmail || !adminPassword) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const session = await User.startSession();
    session.startTransaction();

    try {
      const school = new School({
        name: schoolName,
        address: schoolAddress,
      });
      await school.save({ session });

      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const user = new User({
        schoolId: school._id,
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: 'admin',
      });
      await user.save({ session });

      await session.commitTransaction();
      session.endSession();

      const token = jwt.sign(
        { userId: user._id, schoolId: school._id, role: user.role },
        getJWTSecret(),
        { expiresIn: '7d' }
      );

      res.status(201).json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        school: {
          id: school._id.toString(),
          name: school.name,
          address: school.address,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email }).populate('schoolId');
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (user.status === 'inactive') {
      res.status(401).json({ error: 'Account is inactive' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const rawSchoolId = (user.schoolId as any)?._id?.toString() || user.schoolId?.toString();
    const schoolName = (user.schoolId as any)?.name || '';
    const schoolAddress = (user.schoolId as any)?.address || '';

    const token = jwt.sign(
      { userId: user._id, schoolId: rawSchoolId, role: user.role },
      getJWTSecret(),
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      school: {
        id: rawSchoolId,
        name: schoolName,
        address: schoolAddress,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.userId).populate('schoolId');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      school: {
        id: (user.schoolId as any)._id,
        name: (user.schoolId as any).name,
        address: (user.schoolId as any).address,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
