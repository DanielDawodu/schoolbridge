import { Response } from 'express';
import mongoose from 'mongoose';
import AcademicSession from '../models/AcademicSession';
import School from '../models/School';
import Session from '../models/Session';
import Period from '../models/Period';
import Term from '../models/Term';
import ClassGroup from '../models/ClassGroup';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { year, currentTerm, carryOverClasses } = req.body;

    if (!year || !currentTerm) {
      res.status(400).json({ error: 'Year and currentTerm are required' });
      return;
    }

    const session = new AcademicSession({
      schoolId: req.user?.schoolId,
      year,
      currentTerm,
    });
    await session.save();

    // Carry-over functionality temporarily disabled due to ClassGroup model changes
    // Will be replaced with Period-based class carry-over in new structure
    let copiedClasses: any[] = [];
    /*
    if (carryOverClasses === true) {
      // Get all existing classes for the school
      const existingClasses = await ClassGroup.find({
        schoolId: req.user?.schoolId,
      });

      // Create new classes based on existing structure
      copiedClasses = await Promise.all(
        existingClasses.map(async (existingClass) => {
          const newClass = new ClassGroup({
            schoolId: req.user?.schoolId,
            sessionId: session._id,
            name: existingClass.name,
            arm: existingClass.arm,
          });
          await newClass.save();
          return newClass;
        })
      );
    }
    */

    res.status(201).json({
      session,
      copiedClasses,
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = addSchoolFilter(req);
    const sessions = await AcademicSession.find(filter).sort({ createdAt: -1 });

    // Get school's active period to mark which session is active
    const school = await School.findById(req.user?.schoolId);
    const activePeriodId = school?.activePeriodId?.toString();

    // Get the active Period to find which AcademicSession corresponds to it
    let activeSessionId = null;
    if (activePeriodId) {
      const activePeriod = await Period.findById(activePeriodId).populate('sessionId').populate('termId');
      if (activePeriod) {
        const year = (activePeriod as any).sessionId?.year;
        const termName = (activePeriod as any).termId?.name;

        // Map term name back to legacy format
        let currentTerm = 'first';
        if (termName === '2nd Term') currentTerm = 'second';
        else if (termName === '3rd Term') currentTerm = 'third';

        // Find the corresponding AcademicSession
        const matchingSession = await AcademicSession.findOne({
          schoolId: new mongoose.Types.ObjectId(req.user?.schoolId),
          year,
          currentTerm: currentTerm as any,
        });
        if (matchingSession && matchingSession._id) {
          activeSessionId = matchingSession._id.toString();
        }
      }
    }

    // Add isActive flag to each session
    const sessionsWithStatus = sessions.map((session) => ({
      ...session.toObject(),
      isActive: session._id.toString() === activeSessionId,
    }));

    res.json(sessionsWithStatus);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const session = await AcademicSession.findOne(filter);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json(session);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { year, currentTerm, daysOpen, finalTerm } = req.body;

    const filter = addSchoolFilter(req, { _id: id });
    const session = await AcademicSession.findOneAndUpdate(
      filter,
      { year, currentTerm, daysOpen, finalTerm },
      { new: true }
    );

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Also update the corresponding Period record if it exists
    // Map legacy term to new term name
    let termName = '1st Term';
    if (currentTerm === 'second') termName = '2nd Term';
    else if (currentTerm === 'third') termName = '3rd Term';

    // Find Session and Term for this year and school
    const sessionRecord = await Session.findOne({
      schoolId: new mongoose.Types.ObjectId(req.user?.schoolId),
      year,
    });

    const termRecord = await Term.findOne({
      schoolId: new mongoose.Types.ObjectId(req.user?.schoolId),
      name: termName,
    });

    if (sessionRecord && termRecord) {
      // Update the Period
      await Period.findOneAndUpdate(
        {
          schoolId: new mongoose.Types.ObjectId(req.user?.schoolId),
          sessionId: sessionRecord._id,
          termId: termRecord._id,
        },
        { daysOpen: daysOpen || 0 },
        { new: true }
      );
    }

    res.json(session);
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const session = await AcademicSession.findOneAndDelete(filter);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Handle setting active term - now maps to activePeriodId
export const setActiveTerm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { termId } = req.body;

    if (!termId) {
      res.status(400).json({ error: 'termId is required' });
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
      schoolId: req.user?.schoolId,
      sessionId: sessionRecord._id,
      termId: termRecord._id,
    });

    if (!period) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    // Update school's activePeriodId
    await School.findByIdAndUpdate(req.user?.schoolId, {
      activePeriodId: period._id,
    });

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

    res.json({ message: 'Active term set successfully' });
  } catch (error) {
    console.error('Set active term error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
