import { Response } from 'express';
import SubjectRegistration from '../models/SubjectRegistration';
import Subject from '../models/Subject';
import Period from '../models/Period';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const createRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, subjectId, classId, studentId, stream, assignedTeacherId } = req.body;

    if (!sessionId || !subjectId) {
      res.status(400).json({ error: 'Session ID and subject ID are required' });
      return;
    }

    if (!classId && !studentId) {
      res.status(400).json({ error: 'Either class ID or student ID must be provided' });
      return;
    }

    // Verify subject exists and belongs to school
    const subject = await Subject.findOne({
      _id: subjectId,
      schoolId: req.user?.schoolId,
    });

    if (!subject) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }

    const registration = new SubjectRegistration({
      schoolId: req.user?.schoolId,
      sessionId,
      subjectId,
      classId,
      studentId,
      stream,
      assignedTeacherId,
    });
    await registration.save();

    const populated = await SubjectRegistration.findById(registration._id)
      .populate('subjectId')
      .populate('classId')
      .populate('studentId')
      .populate('assignedTeacherId');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Create registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRegistrations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, classId, studentId, teacherId } = req.query;
    const filter = addSchoolFilter(req);

    if (sessionId) filter.sessionId = sessionId;
    if (classId) filter.classId = classId;
    if (studentId) filter.studentId = studentId;
    if (teacherId) filter.assignedTeacherId = teacherId;

    const registrations = await SubjectRegistration.find(filter)
      .populate('subjectId')
      .populate('classId')
      .populate('studentId')
      .populate('assignedTeacherId')
      .sort({ subjectId: 1 });

    res.json(registrations);
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const registration = await SubjectRegistration.findOneAndDelete(filter);

    if (!registration) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }

    res.json({ message: 'Registration deleted successfully' });
  } catch (error) {
    console.error('Delete registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStudentSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, studentId, classId } = req.query;

    if (!sessionId || !studentId) {
      res.status(400).json({ error: 'Session ID and student ID are required' });
      return;
    }

    const sessionStr = String(sessionId);
    const sessionIds: any[] = [sessionStr];
    try {
      const period: any = await Period.findOne({ _id: sessionStr } as any);
      if (period) {
        sessionIds.push(period.sessionId);
      } else {
        const periods: any[] = await Period.find({ sessionId: sessionStr } as any);
        periods.forEach((p) => sessionIds.push(p._id));
      }
    } catch {
      // In case sessionStr is not an ObjectId
    }

    const orConditions: any[] = [{ studentId }];
    if (classId) {
      orConditions.push({ classId });
    }

    const filter = addSchoolFilter(req, {
      sessionId: { $in: sessionIds },
      $or: orConditions,
    });

    let registrations = await SubjectRegistration.find(filter)
      .populate('subjectId')
      .populate('assignedTeacherId')
      .sort({ subjectId: 1 });

    // Fallback: If no registrations for specific session, check class level
    if (registrations.length === 0 && classId) {
      registrations = await SubjectRegistration.find(addSchoolFilter(req, {
        $or: [{ classId }, { studentId }],
      }))
        .populate('subjectId')
        .populate('assignedTeacherId')
        .sort({ subjectId: 1 });
    }

    // Secondary fallback: if no explicit registrations, load all active subjects for the school
    if (registrations.length === 0) {
      const allSubjects = await Subject.find(addSchoolFilter(req)).sort({ name: 1 });
      registrations = allSubjects.map((s) => ({
        _id: s._id,
        subjectId: s,
        assignedTeacherId: null,
      })) as any;
    }

    res.json(registrations);
  } catch (error) {
    console.error('Get student subjects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const bulkCreateRegistrations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, subjectId, classId, studentIds, stream, assignedTeacherId } = req.body;

    if (!sessionId || !subjectId) {
      res.status(400).json({ error: 'Session ID and subject ID are required' });
      return;
    }

    if (!classId && !studentIds) {
      res.status(400).json({ error: 'Either class ID or student IDs must be provided' });
      return;
    }

    // Verify subject exists
    const subject = await Subject.findOne({
      _id: subjectId,
      schoolId: req.user?.schoolId,
    });

    if (!subject) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }

    const registrations = [];

    if (classId) {
      // Class-level registration (Primary/JSS)
      const registration = new SubjectRegistration({
        schoolId: req.user?.schoolId,
        sessionId,
        subjectId,
        classId,
        stream,
        assignedTeacherId,
      });
      await registration.save();
      registrations.push(registration);
    } else if (studentIds && Array.isArray(studentIds)) {
      // Student-level registration (SSS electives)
      for (const studentId of studentIds) {
        const registration = new SubjectRegistration({
          schoolId: req.user?.schoolId,
          sessionId,
          subjectId,
          studentId,
          stream,
          assignedTeacherId,
        });
        await registration.save();
        registrations.push(registration);
      }
    }

    const populated = await SubjectRegistration.find({
      _id: { $in: registrations.map((r) => r._id) },
    })
      .populate('subjectId')
      .populate('classId')
      .populate('studentId')
      .populate('assignedTeacherId');

    res.status(201).json({
      message: `Created ${registrations.length} registrations`,
      registrations: populated,
    });
  } catch (error) {
    console.error('Bulk create registrations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
