import { Response } from 'express';
import { AuthRequest } from './auth';
import { StaffRole } from '../models/User';
import User from '../models/User';
import ClassGroup from '../models/ClassGroup';
import Student from '../models/Student';

export const requireClassAccess = async (req: AuthRequest, res: Response, next: any): Promise<void> => {
  if (req.user?.role === 'admin') {
    return next();
  }

  if (req.user?.role !== 'teacher') {
    res.status(403).json({ error: 'Teacher access required' });
    return;
  }

  try {
    const classId = req.params.id || req.params.classId || req.body.classId;
    
    if (!classId) {
      return next();
    }

    const teacher = await User.findById(req.user.userId);
    if (!teacher || !teacher.assignedClasses.includes(classId as any)) {
      res.status(403).json({ error: 'Access denied: You are not assigned to this class' });
      return;
    }

    next();
  } catch (error) {
    console.error('Class access check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requireStudentAccess = async (req: AuthRequest, res: Response, next: any): Promise<void> => {
  if (req.user?.role === 'admin') {
    return next();
  }

  if (req.user?.role !== 'teacher') {
    res.status(403).json({ error: 'Teacher access required' });
    return;
  }

  try {
    const studentId = req.params.id || req.params.studentId;

    if (!studentId) {
      return next();
    }

    const student = await Student.findById(studentId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const teacher = await User.findById(req.user.userId);
    if (!teacher || !teacher.assignedClasses.includes(student.classId as any)) {
      res.status(403).json({ error: 'Access denied: You are not assigned to this student\'s class' });
      return;
    }

    next();
  } catch (error) {
    console.error('Student access check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requireAdminOrTeacherForClass = async (req: AuthRequest, res: Response, next: any): Promise<void> => {
  if (req.user?.role === 'admin') {
    return next();
  }

  if (req.user?.role !== 'teacher') {
    res.status(403).json({ error: 'Teacher access required' });
    return;
  }

  try {
    const classId = req.params.classId || req.body.classId;

    if (!classId) {
      res.status(400).json({ error: 'Class ID required' });
      return;
    }

    const assigned = (req.user.assignedClasses || []).map((id: any) => id.toString());
    if (!assigned.includes(classId.toString())) {
      res.status(403).json({ error: 'You can only access your assigned classes' });
      return;
    }

    next();
  } catch (error) {
    console.error('Class access check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};