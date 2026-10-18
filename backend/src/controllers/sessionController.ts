import { Response } from 'express';
import Session from '../models/Session';
import Period from '../models/Period';
import Term from '../models/Term';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { year } = req.body;

    if (!year) {
      res.status(400).json({ error: 'Year is required' });
      return;
    }

    const session = new Session({
      schoolId: req.user?.schoolId,
      year,
    });
    await session.save();

    res.status(201).json(session);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Session with this year already exists' });
      return;
    }
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = addSchoolFilter(req);
    const sessions = await Session.find(filter).sort({ year: -1 });
    res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const session = await Session.findOneAndDelete(filter);

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

// Compatibility endpoint: Returns Session+Period data in AcademicSession-like format
export const getAcademicSessionsCompat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = addSchoolFilter(req);

    // Get all periods for this school
    const periods = await Period.find(filter)
      .populate('sessionId')
      .populate('termId')
      .sort({ createdAt: -1 });

    // Group by session and create AcademicSession-like objects
    const sessionMap = new Map();

    for (const period of periods as any[]) {
      const sessionId = period.sessionId._id.toString();
      const termName = period.termId.name;

      // Map term name to legacy format
      let currentTerm = 'first';
      if (termName === '2nd Term') currentTerm = 'second';
      else if (termName === '3rd Term') currentTerm = 'third';

      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          _id: sessionId,
          year: period.sessionId.year,
          currentTerm,
          schoolId: period.schoolId,
          createdAt: period.sessionId.createdAt,
          updatedAt: period.sessionId.updatedAt,
        });
      }
    }

    const academicSessions = Array.from(sessionMap.values());
    res.json(academicSessions);
  } catch (error) {
    console.error('Get academic sessions compat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
