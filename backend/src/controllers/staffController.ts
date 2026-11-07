import { Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';
import { StaffRole } from '../models/User';
import { logActivity } from '../models/AuditLog';

export const createStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, assignedClasses, photoUrl } = req.body;

    if (!name || !email || !role) {
      res.status(400).json({ error: 'Name, email, and role are required' });
      return;
    }

    const existingUser = await User.findOne({
      schoolId: req.user?.schoolId,
      email: email.trim().toLowerCase(),
    });

    if (existingUser) {
      res.status(400).json({ error: 'Email already exists in this school' });
      return;
    }

    const finalPassword = password || Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(finalPassword, 10);

    const staff = new User({
      schoolId: req.user?.schoolId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role,
      assignedClasses: (role === 'teacher' ? assignedClasses : []) || [],
      temporaryPassword: finalPassword,
      status: 'active',
      photoUrl: photoUrl && photoUrl.trim() ? photoUrl.trim() : undefined,
    });
    await staff.save();

    await logActivity(
      req,
      'create',
      'staff',
      staff._id.toString(),
      { name: staff.name, email: staff.email, role: staff.role }
    );

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
    const { name, email, role, assignedClasses, status, photoUrl } = req.body;

    const filter = addSchoolFilter(req, { _id: id });

    if (email) {
      const existingUser = await User.findOne({
        schoolId: req.user?.schoolId,
        email: email.trim().toLowerCase(),
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

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.trim().toLowerCase();
    if (role && ['admin', 'teacher', 'accountant'].includes(role)) {
      updateData.role = role;
    }
    if (status && ['active', 'inactive', 'suspended'].includes(status)) {
      updateData.status = status;
    }
    if (photoUrl !== undefined) {
      updateData.photoUrl = photoUrl;
    }

    const effectiveRole = updateData.role || staff.role;
    if (effectiveRole === 'teacher') {
      if (assignedClasses !== undefined) {
        updateData.assignedClasses = assignedClasses;
      }
    } else {
      updateData.assignedClasses = [];
    }

    const updatedStaff = await User.findOneAndUpdate(
      filter,
      updateData,
      { new: true }
    ).populate('assignedClasses');

    await logActivity(
      req,
      'update',
      'staff',
      staff._id.toString(),
      { name: updatedStaff?.name, email: updatedStaff?.email, role: updatedStaff?.role, status: updatedStaff?.status }
    );

    res.json(updatedStaff);
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateStaffStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      res.status(400).json({ error: 'Valid status (active or inactive) is required' });
      return;
    }

    // Prevent user from deactivating themselves
    if (req.user?.userId === id && status === 'inactive') {
      res.status(400).json({ error: 'You cannot deactivate your own account' });
      return;
    }

    const filter = addSchoolFilter(req, { _id: id });
    const staff = await User.findOneAndUpdate(
      filter,
      { status },
      { new: true }
    ).populate('assignedClasses');

    if (!staff) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    await logActivity(
      req,
      'status_change',
      'staff',
      staff._id.toString(),
      { name: staff.name, email: staff.email, newStatus: status }
    );

    res.json({ message: `Staff member account marked as ${status}`, staff });
  } catch (error) {
    console.error('Update staff status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetStaffPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const filter = addSchoolFilter(req, { _id: id });
    const staff = await User.findOne(filter);

    if (!staff) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    const generatedPassword = newPassword && newPassword.trim() ? newPassword.trim() : Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(generatedPassword, 10);

    staff.passwordHash = passwordHash;
    staff.temporaryPassword = generatedPassword;
    staff.mustChangePassword = true;
    await staff.save();

    await logActivity(
      req,
      'password_reset',
      'staff',
      staff._id.toString(),
      { name: staff.name, email: staff.email }
    );

    res.json({
      message: 'Password reset successfully',
      temporaryPassword: generatedPassword,
    });
  } catch (error) {
    console.error('Reset staff password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deactivateStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (req.user?.userId === id) {
      res.status(400).json({ error: 'You cannot deactivate your own account' });
      return;
    }

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

    await logActivity(
      req,
      'deactivate',
      'staff',
      staff._id.toString(),
      { name: staff.name, email: staff.email }
    );

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

    await logActivity(
      req,
      'assign_classes',
      'staff',
      staff._id.toString(),
      { name: staff.name, assignedClassesCount: assignedClasses?.length || 0 }
    );

    res.json(updatedStaff);
  } catch (error) {
    console.error('Assign classes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportStaffCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = addSchoolFilter(req);
    const staffList = await User.find(filter)
      .populate({
        path: 'assignedClasses',
        populate: { path: 'classLevelId', select: 'name' },
      })
      .sort({ name: 1 });

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const headers = ['Name', 'Email', 'Role', 'Status', 'Assigned Classes', 'Date Created'];
    const rows = staffList.map((s: any) => {
      const classNames = (s.assignedClasses || [])
        .map((c: any) => `${c.classLevelId?.name || 'Class'} ${c.arm || ''}`.trim())
        .join('; ');
      const createdAt = s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '';
      return [
        escapeCsv(s.name),
        escapeCsv(s.email),
        escapeCsv(s.role),
        escapeCsv(s.status || 'active'),
        escapeCsv(classNames),
        escapeCsv(createdAt),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="staff-export.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Export staff CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
