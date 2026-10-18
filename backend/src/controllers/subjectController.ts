import { Response } from 'express';
import Subject from '../models/Subject';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, category, stream, isCompulsory, ca1Weight, ca2Weight, examWeight } = req.body;

    if (!name || !code) {
      res.status(400).json({ error: 'Name and code are required' });
      return;
    }

    const subject = new Subject({
      schoolId: req.user?.schoolId,
      name,
      code,
      category: category || 'core',
      stream,
      isCompulsory: isCompulsory !== undefined ? isCompulsory : true,
      ca1Weight: ca1Weight || 20,
      ca2Weight: ca2Weight || 20,
      examWeight: examWeight || 60,
    });
    await subject.save();

    res.status(201).json(subject);
  } catch (error: any) {
    console.error('Create subject error:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Subject code already exists' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = addSchoolFilter(req);
    const subjects = await Subject.find(filter).sort({ name: 1 });
    res.json(subjects);
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const subject = await Subject.findOne(filter);

    if (!subject) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }

    res.json(subject);
  } catch (error) {
    console.error('Get subject error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, category, stream, isCompulsory, ca1Weight, ca2Weight, examWeight } = req.body;

    const filter = addSchoolFilter(req, { _id: id });
    const subject = await Subject.findOneAndUpdate(
      filter,
      { name, code, category, stream, isCompulsory, ca1Weight, ca2Weight, examWeight },
      { new: true }
    );

    if (!subject) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }

    res.json(subject);
  } catch (error) {
    console.error('Update subject error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const subject = await Subject.findOneAndDelete(filter);

    if (!subject) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }

    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
