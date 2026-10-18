import { Response } from 'express';
import ClassGroup from '../models/ClassGroup';
import ClassLevel from '../models/ClassLevel';
import Period from '../models/Period';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classLevelId, arm, periodId } = req.body;

    if (!classLevelId || !arm || !periodId) {
      res.status(400).json({ error: 'ClassLevel, arm, and periodId are required' });
      return;
    }

    const classGroup = new ClassGroup({
      schoolId: req.user?.schoolId,
      classLevelId,
      arm,
      periodId,
    });
    await classGroup.save();

    // Populate for response
    await classGroup.populate('classLevelId');
    await classGroup.populate('periodId');

    res.status(201).json(classGroup);
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClasses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { periodId } = req.query;
    let filter = addSchoolFilter(req);

    // If user is a teacher, filter by their assigned classes
    if (req.user?.role === 'teacher') {
      const teacher = await User.findById(req.user.userId);
      if (teacher && teacher.assignedClasses.length > 0) {
        filter._id = { $in: teacher.assignedClasses };
      } else {
        // Teacher with no assigned classes sees no classes
        filter._id = { $in: [] };
      }
    }

    if (periodId) {
      filter.periodId = periodId;
    }

    // Populate classLevel and period data
    const classes = await ClassGroup.find(filter)
      .populate('classLevelId')
      .populate('periodId')
      .sort({ classLevelId: 1, arm: 1 });

    res.json(classes);
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const classGroup = await ClassGroup.findOne(filter)
      .populate('classLevelId')
      .populate('periodId');

    if (!classGroup) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    res.json(classGroup);
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { classLevelId, arm, periodId } = req.body;

    const filter = addSchoolFilter(req, { _id: id });
    const classGroup = await ClassGroup.findOneAndUpdate(
      filter,
      { classLevelId, arm, periodId },
      { new: true }
    )
      .populate('classLevelId')
      .populate('periodId');

    if (!classGroup) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    res.json(classGroup);
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const classGroup = await ClassGroup.findOneAndDelete(filter);

    if (!classGroup) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
