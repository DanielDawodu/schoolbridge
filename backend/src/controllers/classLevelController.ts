import { Response } from 'express';
import ClassLevel from '../models/ClassLevel';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const createClassLevel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, levelOrder } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Class level name is required' });
      return;
    }

    const classLevel = new ClassLevel({
      schoolId: req.user?.schoolId,
      name,
      levelOrder: levelOrder || 0,
    });
    await classLevel.save();

    res.status(201).json(classLevel);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Class level with this name already exists' });
      return;
    }
    console.error('Create class level error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClassLevels = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = addSchoolFilter(req);
    const classLevels = await ClassLevel.find(filter).sort({ levelOrder: 1, name: 1 });
    res.json(classLevels);
  } catch (error) {
    console.error('Get class levels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateClassLevel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, levelOrder } = req.body;

    const filter = addSchoolFilter(req, { _id: id });
    const classLevel = await ClassLevel.findOneAndUpdate(
      filter,
      { name, levelOrder },
      { new: true }
    );

    if (!classLevel) {
      res.status(404).json({ error: 'Class level not found' });
      return;
    }

    res.json(classLevel);
  } catch (error) {
    console.error('Update class level error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteClassLevel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const classLevel = await ClassLevel.findOneAndDelete(filter);

    if (!classLevel) {
      res.status(404).json({ error: 'Class level not found' });
      return;
    }

    res.json({ message: 'Class level deleted successfully' });
  } catch (error) {
    console.error('Delete class level error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
