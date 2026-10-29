import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import User from '../models/User';
import Student from '../models/Student';

export const uploadStaffPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { staffId } = req.params;
    const user = await User.findById(staffId);

    if (!user) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    // Convert image to base64 for storage
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    user.photoUrl = base64Image;
    await user.save();

    res.json({ photoUrl: user.photoUrl });
  } catch (error) {
    console.error('Upload staff photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadStudentPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { studentId } = req.params;
    const student = await Student.findById(studentId);

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Convert image to base64 for storage
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    student.photoUrl = base64Image;
    await student.save();

    res.json({ photoUrl: student.photoUrl });
  } catch (error) {
    console.error('Upload student photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
