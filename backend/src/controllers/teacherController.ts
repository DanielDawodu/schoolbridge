import { Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const createTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, assignedClasses } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: 'Name and email are required' });
      return;
    }

    const existingUser = await User.findOne({
      schoolId: req.user?.schoolId,
      email,
    });

    if (existingUser) {
      res.status(400).json({ error: 'Email already exists in this school' });
      return;
    }

    const finalPassword = password || Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(finalPassword, 10);

    const teacher = new User({
      schoolId: req.user?.schoolId,
      name,
      email,
      passwordHash,
      role: 'teacher',
      assignedClasses: assignedClasses || [],
      temporaryPassword: finalPassword,
      status: 'active',
    });
    await teacher.save();

    const savedTeacher = await User.findById(teacher._id).populate('assignedClasses');

    res.status(201).json({
      teacher: savedTeacher,
      credentials: {
        email: teacher.email,
        password: finalPassword,
      },
    });
  } catch (error) {
    console.error('Create teacher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = addSchoolFilter(req, { role: 'teacher' });
    const teachers = await User.find(filter).populate('assignedClasses').sort({ name: 1 });
    res.json(teachers);
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id, role: 'teacher' });
    const teacher = await User.findOne(filter).populate('assignedClasses');

    if (!teacher) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }

    res.json(teacher);
  } catch (error) {
    console.error('Get teacher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, assignedClasses, status } = req.body;

    const filter = addSchoolFilter(req, { _id: id, role: 'teacher' });

    if (email) {
      const existingUser = await User.findOne({
        schoolId: req.user?.schoolId,
        email,
        _id: { $ne: id },
      });

      if (existingUser) {
        res.status(400).json({ error: 'Email already exists in this school' });
        return;
      }
    }

    const teacher = await User.findOneAndUpdate(
      filter,
      {
        name,
        email,
        assignedClasses,
        status,
      },
      { new: true }
    ).populate('assignedClasses');

    if (!teacher) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }

    res.json(teacher);
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deactivateTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id, role: 'teacher' });
    const teacher = await User.findOneAndUpdate(
      filter,
      { status: 'inactive' },
      { new: true }
    );

    if (!teacher) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }

    res.json({ message: 'Teacher deactivated successfully' });
  } catch (error) {
    console.error('Deactivate teacher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const assignClassesToTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { assignedClasses } = req.body;

    const filter = addSchoolFilter(req, { _id: id, role: 'teacher' });
    const teacher = await User.findOneAndUpdate(
      filter,
      { assignedClasses },
      { new: true }
    ).populate('assignedClasses');

    if (!teacher) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }

    res.json(teacher);
  } catch (error) {
    console.error('Assign classes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
