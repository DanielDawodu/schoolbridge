import { Response } from 'express';
import mongoose from 'mongoose';
import School from '../models/School';
import Session from '../models/Session';
import Period from '../models/Period';
import Term from '../models/Term';
import AcademicSession from '../models/AcademicSession';
import { AuthRequest } from '../middleware/auth';

export const getSchool = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const school = await School.findById(req.user?.schoolId);
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    res.json(school);
  } catch (error) {
    console.error('Get school error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setActiveTerm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { termId } = req.body;

    if (!termId) {
      res.status(400).json({ error: 'Term ID is required' });
      return;
    }

    // Find the AcademicSession
    const academicSession = await AcademicSession.findOne({
      _id: termId,
      schoolId: req.user?.schoolId,
    });

    if (!academicSession) {
      res.status(404).json({ error: 'Academic session not found' });
      return;
    }

    // Map to corresponding Period
    const year = academicSession.year;
    const currentTerm = academicSession.currentTerm;

    let termName = '1st Term';
    if (currentTerm === 'second') termName = '2nd Term';
    else if (currentTerm === 'third') termName = '3rd Term';

    const sessionRecord = await Session.findOne({
      schoolId: new mongoose.Types.ObjectId(req.user?.schoolId),
      year,
    });

    const termRecord = await Term.findOne({
      schoolId: new mongoose.Types.ObjectId(req.user?.schoolId),
      name: termName,
    });

    if (!sessionRecord || !termRecord) {
      res.status(404).json({ error: 'Corresponding Session or Period not found' });
      return;
    }

    const period = await Period.findOne({
      schoolId: new mongoose.Types.ObjectId(req.user?.schoolId),
      sessionId: sessionRecord._id,
      termId: termRecord._id,
    });

    if (!period) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    // Update school's activePeriodId
    const school = await School.findById(req.user?.schoolId);
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    school.activePeriodId = period._id;
    await school.save();

    // Set the Period as active
    await Period.findByIdAndUpdate(period._id, { isActive: true });

    // Deactivate all other periods for this school
    await Period.updateMany(
      {
        schoolId: new mongoose.Types.ObjectId(req.user?.schoolId),
        _id: { $ne: period._id },
      },
      { isActive: false }
    );

    res.json({ message: 'Active term updated successfully', activePeriodId: school.activePeriodId });
  } catch (error) {
    console.error('Set active term error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSchoolSignature = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { signatureUrl } = req.body;

    if (!signatureUrl) {
      res.status(400).json({ error: 'Signature URL is required' });
      return;
    }

    const school = await School.findById(req.user?.schoolId);
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    school.signatureUrl = signatureUrl;
    await school.save();

    res.json({ message: 'Signature updated successfully', signatureUrl: school.signatureUrl });
  } catch (error) {
    console.error('Update school signature error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSchool = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reportCardMode } = req.body;

    const school = await School.findById(req.user?.schoolId);
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    if (reportCardMode) {
      school.reportCardMode = reportCardMode;
    }

    await school.save();

    res.json(school);
  } catch (error) {
    console.error('Update school error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
