import { Response } from 'express';
import SubjectRegistration from '../models/SubjectRegistration';
import Subject from '../models/Subject';
import Period from '../models/Period';
import Student from '../models/Student';
import ClassGroup from '../models/ClassGroup';
import School from '../models/School';
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

    if (!studentId && !classId) {
      res.status(400).json({ error: 'Either student ID or class ID must be provided' });
      return;
    }

    // Determine student context, class and faction
    let student: any = null;
    let targetClassId: string = (classId as string) || '';
    let studentFaction: string | null = null;

    if (studentId) {
      student = await Student.findOne(addSchoolFilter(req, { _id: studentId })).populate('classId');
      if (student) {
        if (!targetClassId && student.classId) {
          targetClassId = (student.classId?._id || student.classId).toString();
        }
        studentFaction = student.stream || (student.classId as any)?.faction || null;
      }
    }

    if (!studentFaction && targetClassId) {
      const cls = await ClassGroup.findById(targetClassId);
      if (cls?.faction) {
        studentFaction = cls.faction;
      }
    }

    let sessionIds: any[] = [];
    if (sessionId) {
      const sessionStr = String(sessionId);
      sessionIds.push(sessionStr);
      try {
        const period: any = await Period.findOne({ _id: sessionStr } as any);
        if (period) {
          sessionIds.push(period.sessionId);
        } else {
          const periods: any[] = await Period.find({ sessionId: sessionStr } as any);
          periods.forEach((p) => sessionIds.push(p._id));
        }
      } catch {
        // Ignore casting errors
      }
    } else {
      const school = await School.findById(req.user?.schoolId);
      if (school?.activePeriodId) {
        sessionIds.push(school.activePeriodId);
      }
    }

    const orConditions: any[] = [];
    if (studentId) orConditions.push({ studentId });
    if (targetClassId) orConditions.push({ classId: targetClassId });

    let filter: any = addSchoolFilter(req);
    if (sessionIds.length > 0) {
      filter.sessionId = { $in: sessionIds };
    }
    if (orConditions.length > 0) {
      filter.$or = orConditions;
    }

    let registrations = await SubjectRegistration.find(filter)
      .populate('subjectId')
      .populate('assignedTeacherId')
      .sort({ subjectId: 1 });

    // Fallback 1: check class or student across all sessions
    if (registrations.length === 0 && (targetClassId || studentId)) {
      registrations = await SubjectRegistration.find(
        addSchoolFilter(req, {
          $or: orConditions,
        })
      )
        .populate('subjectId')
        .populate('assignedTeacherId')
        .sort({ subjectId: 1 });
    }

    // Fallback 2: load active school subjects
    if (registrations.length === 0) {
      const allSubjects = await Subject.find(addSchoolFilter(req)).sort({ name: 1 });
      registrations = allSubjects.map((s) => ({
        _id: s._id,
        subjectId: s,
        assignedTeacherId: null,
      })) as any;
    }

    // Filter registrations by class assignment and faction/stream
    const filtered = registrations.filter((reg: any) => {
      const subj: any = reg.subjectId;
      if (!subj) return false;

      // 1. If subject specifies applicable classes, ensure targetClassId is included
      if (
        targetClassId &&
        subj.applicableClassIds &&
        Array.isArray(subj.applicableClassIds) &&
        subj.applicableClassIds.length > 0
      ) {
        const hasClass = subj.applicableClassIds.some(
          (cId: any) => cId.toString() === targetClassId.toString()
        );
        if (!hasClass) return false;
      }

      // 2. If subject has an academic faction/stream (Science, Arts, Commercial)
      if (subj.stream && subj.stream.trim()) {
        const subjStream = subj.stream.trim().toLowerCase();
        // If student/class has no faction (e.g. JSS or Primary), do not include SSS faction electives
        if (!studentFaction) {
          return false;
        }
        if (studentFaction.toLowerCase() !== subjStream) {
          return false;
        }
      }

      return true;
    });

    res.json(filtered);
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
