import { Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';
import { StaffRole } from '../models/User';

export const createStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, assignedClasses, photoUrl } = req.body;

    if (!name || !email || !role) {
      res.status(400).json({ error: 'Name, email, and role are required' });
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

    const staff = new User({
      schoolId: req.user?.schoolId,
      name,
      email,
      passwordHash,
      role,
      assignedClasses: (role === 'teacher' ? assignedClasses : []) || [],
      temporaryPassword: finalPassword,
      status: 'active',
      photoUrl,
    });
    await staff.save();

    const savedStaff = await User.findById(staff._id).populate('assignedClasses');

    res.status(201).json({
      staff: savedStaff,
      credentials: {
        email: staff.email,
        password: finalPassword,
      },
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.query;
    const filter = addSchoolFilter(req);
    
    if (role) {
      filter.role = role;
    }
    
    const staff = await User.find(filter).populate('assignedClasses').sort({ name: 1 });
    res.json(staff);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStaffMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const staff = await User.findOne(filter).populate('assignedClasses');

    if (!staff) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    res.json(staff);
  } catch (error) {
    console.error('Get staff member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, assignedClasses, status, photoUrl } = req.body;

    const filter = addSchoolFilter(req, { _id: id });

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

    const staff = await User.findOne(filter);
    if (!staff) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    // Only teachers can have assigned classes
    const updateData: any = { name, email, status, photoUrl };
    if (staff.role === 'teacher') {
      updateData.assignedClasses = assignedClasses;
    }

    const updatedStaff = await User.findOneAndUpdate(
      filter,
      updateData,
      { new: true }
    ).populate('assignedClasses');

    res.json(updatedStaff);
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deactivateStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const staff = await User.findOneAndUpdate(
      filter,
      { status: 'inactive' },
      { new: true }
    );

    if (!staff) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    res.json({ message: 'Staff member deactivated successfully' });
  } catch (error) {
    console.error('Deactivate staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const assignClassesToStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { assignedClasses } = req.body;

    const filter = addSchoolFilter(req, { _id: id });
    const staff = await User.findOne(filter);

    if (!staff) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    if (staff.role !== 'teacher') {
      res.status(400).json({ error: 'Only teachers can be assigned classes' });
      return;
    }

    const updatedStaff = await User.findOneAndUpdate(
      filter,
      { assignedClasses },
      { new: true }
    ).populate('assignedClasses');

    res.json(updatedStaff);
  } catch (error) {
    console.error('Assign classes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
