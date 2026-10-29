import { Response } from 'express';
import Period from '../models/Period';
import Session from '../models/Session';
import Term from '../models/Term';
import School from '../models/School';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const createPeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, termId, daysOpen, closeDate, nextTermBeginDate } = req.body;

    if (!sessionId || !termId) {
      res.status(400).json({ error: 'Session ID and Term ID are required' });
      return;
    }

    // Verify session and term exist and belong to the user's school
    const session = await Session.findOne({ _id: sessionId, schoolId: req.user?.schoolId });
    const term = await Term.findOne({ _id: termId, schoolId: req.user?.schoolId });

    if (!session || !term) {
      res.status(404).json({ error: 'Session or Term not found' });
      return;
    }

    // Check if period already exists
    const existing = await Period.findOne({
      schoolId: req.user?.schoolId,
      sessionId,
      termId,
    });

    if (existing) {
      res.status(400).json({ error: 'Period for this session and term already exists' });
      return;
    }

    const period = new Period({
      schoolId: req.user?.schoolId,
      sessionId,
      termId,
      daysOpen: daysOpen || 0,
      closeDate,
      nextTermBeginDate,
      isActive: false,
    });
    await period.save();

    const populated = await Period.findById(period._id)
      .populate('sessionId')
      .populate('termId');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Create period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPeriods = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = addSchoolFilter(req);
    const periods = await Period.find(filter)
      .populate('sessionId')
      .populate('termId')
      .sort({ 'sessionId.year': -1, 'termId.order': 1 });
    res.json(periods);
  } catch (error) {
    console.error('Get periods error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { daysOpen, closeDate, nextTermBeginDate, isActive } = req.body;

    const filter = addSchoolFilter(req, { _id: id });
    const period = await Period.findOneAndUpdate(
      filter,
      { daysOpen, closeDate, nextTermBeginDate, isActive },
      { new: true }
    );

    if (!period) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    // If setting as active, deactivate all other periods
    if (isActive) {
      await Period.updateMany(
        { schoolId: req.user?.schoolId, _id: { $ne: id } },
        { isActive: false }
      );
    }

    const populated = await Period.findById(period._id)
      .populate('sessionId')
      .populate('termId');

    res.json(populated);
  } catch (error) {
    console.error('Update period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const period = await Period.findOneAndDelete(filter);

    if (!period) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    res.json({ message: 'Period deleted successfully' });
  } catch (error) {
    console.error('Delete period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setActivePeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { periodId } = req.body;

    if (!periodId) {
      res.status(400).json({ error: 'Period ID is required' });
      return;
    }

    // Deactivate all periods for this school
    await Period.updateMany(
      { schoolId: req.user?.schoolId },
      { isActive: false }
    );

    // Set the requested period as active
    const period = await Period.findOneAndUpdate(
      { _id: periodId, schoolId: req.user?.schoolId },
      { isActive: true },
      { new: true }
    );

    if (!period) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    // Update school's active period
    await School.findByIdAndUpdate(req.user?.schoolId, {
      activePeriodId: periodId,
    });

    res.json({ message: 'Active period updated successfully', activePeriodId: periodId });
  } catch (error) {
    console.error('Set active period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
