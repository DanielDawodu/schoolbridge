import Student from '../models/Student';
import SubjectRegistration from '../models/SubjectRegistration';
import mongoose from 'mongoose';
import { Response } from 'express';
import ClassGroup from '../models/ClassGroup';
import ClassLevel from '../models/ClassLevel';
import Period from '../models/Period';
import Session from '../models/Session';
import Term from '../models/Term';
import School from '../models/School';
import AcademicSession from '../models/AcademicSession';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';
import { logActivity } from '../models/AuditLog';

/**
 * Resolves a ClassLevel ID from either explicit ID or class name.
 * If name is given and doesn't exist, automatically creates the ClassLevel.
 */
async function resolveClassLevel(
  req: AuthRequest,
  classLevelId?: string,
  name?: string
): Promise<mongoose.Types.ObjectId | null> {
  const schoolId = req.user?.schoolId;
  if (!schoolId) return null;

  // 1. If explicit classLevelId provided, verify it exists
  if (classLevelId && mongoose.isValidObjectId(classLevelId)) {
    const existing = await ClassLevel.findOne(
      addSchoolFilter(req, { _id: classLevelId })
    );
    if (existing) {
      return existing._id as mongoose.Types.ObjectId;
    }
  }

  // 2. If name provided, lookup by case-insensitive name
  const trimmedName = (name || '').trim();
  if (trimmedName) {
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let classLevel = await ClassLevel.findOne(
      addSchoolFilter(req, {
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      })
    );
    if (classLevel) {
      return classLevel._id as mongoose.Types.ObjectId;
    }

    // Auto-create new ClassLevel
    classLevel = new ClassLevel({
      schoolId,
      name: trimmedName,
      levelOrder: 0,
    });
    await classLevel.save();
    return classLevel._id as mongoose.Types.ObjectId;
  }

  return null;
}

/**
 * Maps an AcademicSession (year, currentTerm) to its corresponding Period.
 * Can optionally create Session, Term, Period if they don't exist yet.
 */
async function findPeriodForAcademicSession(
  req: AuthRequest,
  academicSession: any,
  autoCreate = false
): Promise<mongoose.Types.ObjectId | null> {
  const schoolId = req.user?.schoolId;
  if (!schoolId || !academicSession) return null;

  const termVariants: Record<string, string[]> = {
    first: ['1st Term', 'First Term', 'first', '1st term'],
    second: ['2nd Term', 'Second Term', 'second', '2nd term'],
    third: ['3rd Term', 'Third Term', 'third', '3rd term'],
  };
  const targetTerms = termVariants[academicSession.currentTerm] || ['1st Term', 'First Term', 'first'];

  let sessionDoc = await Session.findOne(
    addSchoolFilter(req, { year: academicSession.year })
  );

  if (!sessionDoc && autoCreate) {
    sessionDoc = new Session({
      schoolId,
      year: academicSession.year,
    });
    await sessionDoc.save();
  }

  if (sessionDoc) {
    let termDoc = await Term.findOne(
      addSchoolFilter(req, { name: { $in: targetTerms } })
    );

    if (!termDoc && autoCreate) {
      const termName = academicSession.currentTerm === 'second' ? '2nd Term' : academicSession.currentTerm === 'third' ? '3rd Term' : '1st Term';
      const termOrder = academicSession.currentTerm === 'second' ? 2 : academicSession.currentTerm === 'third' ? 3 : 1;
      termDoc = new Term({
        schoolId,
        name: termName,
        order: termOrder,
      });
      await termDoc.save();
    }

    if (termDoc) {
      let period = await Period.findOne(
        addSchoolFilter(req, {
          sessionId: sessionDoc._id,
          termId: termDoc._id,
        })
      );

      if (!period && autoCreate) {
        period = new Period({
          schoolId,
          sessionId: sessionDoc._id,
          termId: termDoc._id,
          daysOpen: 0,
          isActive: true,
        });
        await period.save();
      }

      if (period) {
        return period._id as mongoose.Types.ObjectId;
      }
    }

    // Fallback: any period for this session
    const anySessionPeriod = await Period.findOne(
      addSchoolFilter(req, { sessionId: sessionDoc._id })
    );
    if (anySessionPeriod) {
      return anySessionPeriod._id as mongoose.Types.ObjectId;
    }
  }

  return null;
}

/**
 * Resolves a Period ID from periodId, sessionId, or school active period.
 */
async function resolvePeriod(
  req: AuthRequest,
  periodId?: string,
  sessionId?: string
): Promise<mongoose.Types.ObjectId | null> {
  const schoolId = req.user?.schoolId;
  if (!schoolId) return null;

  // 1. Check direct periodId
  if (periodId && mongoose.isValidObjectId(periodId)) {
    const directPeriod = await Period.findOne(
      addSchoolFilter(req, { _id: periodId })
    );
    if (directPeriod) {
      return directPeriod._id as mongoose.Types.ObjectId;
    }

    // Check if periodId is actually an AcademicSession._id
    const sessionDoc = await AcademicSession.findOne(
      addSchoolFilter(req, { _id: periodId })
    );
    if (sessionDoc) {
      const mapped = await findPeriodForAcademicSession(req, sessionDoc);
      if (mapped) return mapped;
    }
  }

  // 2. Check sessionId
  if (sessionId && mongoose.isValidObjectId(sessionId)) {
    // A) Is sessionId a Period ID?
    const periodFromSessionId = await Period.findOne(
      addSchoolFilter(req, { _id: sessionId })
    );
    if (periodFromSessionId) {
      return periodFromSessionId._id as mongoose.Types.ObjectId;
    }

    // B) Is sessionId an AcademicSession ID?
    const academicSession = await AcademicSession.findOne(
      addSchoolFilter(req, { _id: sessionId })
    );
    if (academicSession) {
      const mapped = await findPeriodForAcademicSession(req, academicSession);
      if (mapped) return mapped;
    }

    // C) Is sessionId a Period.sessionId (referencing Session model)?
    const periodBySessionRef = await Period.findOne(
      addSchoolFilter(req, { sessionId })
    );
    if (periodBySessionRef) {
      return periodBySessionRef._id as mongoose.Types.ObjectId;
    }
  }

  // 3. Fallback to School activePeriodId
  const school = await School.findById(schoolId);
  if (school?.activePeriodId) {
    const activePeriod = await Period.findOne(
      addSchoolFilter(req, { _id: school.activePeriodId })
    );
    if (activePeriod) {
      return activePeriod._id as mongoose.Types.ObjectId;
    }
  }

  // 4. Fallback to Period with isActive: true
  const activePeriod = await Period.findOne(
    addSchoolFilter(req, { isActive: true })
  );
  if (activePeriod) {
    return activePeriod._id as mongoose.Types.ObjectId;
  }

  // 5. Fallback to latest Period for school
  const latestPeriod = await Period.findOne(
    addSchoolFilter(req)
  ).sort({ createdAt: -1 });
  if (latestPeriod) {
    return latestPeriod._id as mongoose.Types.ObjectId;
  }

  // 6. If no Period exists at all, but school has an AcademicSession, create matching Session, Term, and Period
  const anyAcademicSession = await AcademicSession.findOne(
    addSchoolFilter(req)
  ).sort({ createdAt: -1 });
  if (anyAcademicSession) {
    const createdPeriod = await findPeriodForAcademicSession(req, anyAcademicSession, true);
    if (createdPeriod) return createdPeriod;
  }

  return null;
}

export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      classLevelId,
      name,
      className,
      classLevel,
      arm,
      periodId,
      sessionId,
      faction,
    } = req.body;

    const trimmedArm = (arm || '').trim();
    if (!trimmedArm) {
      res.status(400).json({ error: 'Arm / Section is required' });
      return;
    }

    const inputName = (name || className || classLevel || '').trim();
    if (!classLevelId && !inputName) {
      res.status(400).json({ error: 'Class name or class level is required' });
      return;
    }

    const resolvedClassLevelId = await resolveClassLevel(req, classLevelId, inputName);
    if (!resolvedClassLevelId) {
      res.status(400).json({ error: 'Failed to resolve or create class level' });
      return;
    }

    const resolvedPeriodId = await resolvePeriod(req, periodId, sessionId);
    if (!resolvedPeriodId) {
      res.status(400).json({
        error: 'Active academic period or session is required. Please configure an academic session or period first.',
      });
      return;
    }

    // Check for duplicate class in the same period
    const escapedArm = trimmedArm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingClass = await ClassGroup.findOne(
      addSchoolFilter(req, {
        classLevelId: resolvedClassLevelId,
        arm: { $regex: new RegExp(`^${escapedArm}$`, 'i') },
        periodId: resolvedPeriodId,
      })
    );

    if (existingClass) {
      res.status(400).json({
        error: 'A class with this level and arm already exists for the selected academic period',
      });
      return;
    }

    const classGroup = new ClassGroup({
      schoolId: req.user?.schoolId,
      classLevelId: resolvedClassLevelId,
      arm: trimmedArm,
      periodId: resolvedPeriodId,
      faction: faction || null,
    });
    await classGroup.save();

    // Populate for response
    await classGroup.populate('classLevelId');
    await classGroup.populate({
      path: 'periodId',
      populate: [{ path: 'sessionId' }, { path: 'termId' }],
    });

    await logActivity({
      schoolId: req.user?.schoolId,
      userId: req.user?.userId,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'CREATE_CLASS',
      module: 'subjects_classes',
      recordId: classGroup._id.toString(),
      description: `Created class: ${(classGroup.classLevelId as any)?.name || 'Class'} - ${classGroup.arm}${faction ? ` (${faction})` : ''}`,
    });

    const responseData = {
      ...classGroup.toObject(),
      name: (classGroup.classLevelId as any)?.name || inputName || 'Class',
      sessionId: sessionId || (classGroup.periodId as any)?._id,
      assignedTeachers: [],
      studentCount: 0,
      faction: classGroup.faction || null,
    };

    res.status(201).json(responseData);
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClasses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { periodId } = req.query;
    let filter = addSchoolFilter(req);
    
    // Always resolve the active period if periodId is not provided
    if (periodId) {
      filter.periodId = periodId;
    } else {
      // Find active period for this school
      const activePeriod = await Period.findOne(
        addSchoolFilter(req, { isActive: true })
      );
      if (activePeriod) {
        filter.periodId = activePeriod._id;
      }
    }

    // Role-based filtering: Teachers only see their assigned classes OR classes where they teach a subject
    if (req.user?.role === 'teacher') {
      const teacher = await User.findById(req.user.userId);
      const assignedClassIds = (teacher?.assignedClasses || []).map((id: any) => id.toString());

      // Also check subjects where this teacher is assigned
      const subjectRegistrations = await SubjectRegistration.find(
        addSchoolFilter(req, { assignedTeacherId: req.user.userId })
      ).distinct('classId');

      const subjectClassIds = subjectRegistrations.map((id: any) => id.toString());
      const allTeacherClassIds = Array.from(new Set([...assignedClassIds, ...subjectClassIds]));

      // If teacher has assigned classes, filter by them
      if (allTeacherClassIds.length > 0) {
        filter._id = { $in: allTeacherClassIds.map((id) => new mongoose.Types.ObjectId(id)) };
      } else {
        // Teacher has no classes assigned
        res.json([]);
        return;
      }
    }

    // First try with the current filter (including periodId if set)
    let classes = await ClassGroup.find(filter)
      .populate('classLevelId')
      .populate({
        path: 'periodId',
        populate: [{ path: 'sessionId' }, { path: 'termId' }],
      });

    // If no classes found and periodId was specified or auto-set, try without periodId filter
    // This handles cases where classes exist in the school across different or legacy periods
    if (classes.length === 0 && filter.periodId) {
      const fallbackFilter = { ...filter };
      delete fallbackFilter.periodId;
      const fallbackClasses = await ClassGroup.find(fallbackFilter)
        .populate('classLevelId')
        .populate({
          path: 'periodId',
          populate: [{ path: 'sessionId' }, { path: 'termId' }],
        });
      if (fallbackClasses.length > 0) {
        classes = fallbackClasses;
      }
    }

    // Pre-fetch AcademicSessions for this school to map periods to AcademicSessions
    const academicSessions = await AcademicSession.find(addSchoolFilter(req));

    // Enhance each class with assigned teachers, student count, and backward-compatible fields
    const enhancedClasses = await Promise.all(
      classes.map(async (classItem) => {
        // Find teachers assigned to this class
        const teachers = await User.find(
          addSchoolFilter(req, {
            role: 'teacher',
            assignedClasses: classItem._id,
          })
        ).select('_id name email photoUrl');

        // Count students in this class
        const studentCount = await Student.countDocuments(
          addSchoolFilter(req, {
            classId: classItem._id,
            status: 'active',
          })
        );

        // Find corresponding AcademicSession for frontend display
        const periodObj = classItem.periodId as any;
        const pYear = periodObj?.sessionId?.year;
        const pTermName = periodObj?.termId?.name;

        let matchedSession = academicSessions.find((s) => {
          if ((classItem as any).sessionId && s._id.toString() === (classItem as any).sessionId.toString()) {
            return true;
          }
          if (pYear && s.year === pYear) {
            if (pTermName === '2nd Term' && s.currentTerm === 'second') return true;
            if (pTermName === '3rd Term' && s.currentTerm === 'third') return true;
            if ((pTermName === '1st Term' || pTermName === 'First Term') && s.currentTerm === 'first') return true;
          }
          return false;
        });

        const plainClass = classItem.toObject();
        return {
          ...plainClass,
          name: (classItem.classLevelId as any)?.name || (classItem as any).name || 'Class',
          sessionId: matchedSession?._id || (classItem as any).sessionId || periodObj?._id,
          assignedTeachers: teachers,
          studentCount,
          faction: (classItem as any).faction || null,
        };
      })
    );

    res.json(enhancedClasses);
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
      .populate({
        path: 'periodId',
        populate: [{ path: 'sessionId' }, { path: 'termId' }],
      });

    if (!classGroup) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    // Role-based check for teachers
    if (req.user?.role === 'teacher') {
      const teacher = await User.findById(req.user.userId);
      const isAssigned = teacher?.assignedClasses?.some(
        (classId: any) => classId.toString() === classGroup._id.toString()
      );

      // Also check if teacher has subject registration in this class
      const hasSubject = await SubjectRegistration.exists(
        addSchoolFilter(req, {
          classId: classGroup._id,
          assignedTeacherId: req.user.userId,
        })
      );

      if (!isAssigned && !hasSubject) {
        res.status(403).json({ error: 'Access denied to this class' });
        return;
      }
    }

    // Fetch assigned teachers and student count
    const teachers = await User.find(
      addSchoolFilter(req, {
        role: 'teacher',
        assignedClasses: classGroup._id,
      })
    ).select('_id name email photoUrl');

    const studentCount = await Student.countDocuments(
      addSchoolFilter(req, {
        classId: classGroup._id,
        status: 'active',
      })
    );

    res.json({
      ...classGroup.toObject(),
      name: (classGroup.classLevelId as any)?.name || (classGroup as any).name || 'Class',
      sessionId: (classGroup as any).sessionId || (classGroup.periodId as any)?._id,
      assignedTeachers: teachers,
      studentCount,
      faction: (classGroup as any).faction || null,
    });
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      classLevelId,
      name,
      className,
      classLevel,
      arm,
      periodId,
      sessionId,
      faction,
    } = req.body;

    const filter = addSchoolFilter(req, { _id: id });
    const existing = await ClassGroup.findOne(filter);
    if (!existing) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    const updatePayload: any = {};

    if (arm !== undefined) {
      const trimmedArm = (arm || '').trim();
      if (!trimmedArm) {
        res.status(400).json({ error: 'Arm / Section is required' });
        return;
      }
      updatePayload.arm = trimmedArm;
    }

    const inputName = (name || className || classLevel || '').trim();
    if (classLevelId || inputName) {
      const resolvedClassLevelId = await resolveClassLevel(req, classLevelId, inputName);
      if (resolvedClassLevelId) {
        updatePayload.classLevelId = resolvedClassLevelId;
      }
    }

    if (periodId || sessionId) {
      const resolvedPeriodId = await resolvePeriod(req, periodId, sessionId);
      if (resolvedPeriodId) {
        updatePayload.periodId = resolvedPeriodId;
      }
    }

    if (faction !== undefined) {
      updatePayload.faction = faction || null;
    }

    // Check for duplicate class in the same period
    const checkLevelId = updatePayload.classLevelId || existing.classLevelId;
    const checkArm = updatePayload.arm || existing.arm;
    const checkPeriodId = updatePayload.periodId || existing.periodId;

    const escapedArm = checkArm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const duplicate = await ClassGroup.findOne(
      addSchoolFilter(req, {
        _id: { $ne: id },
        classLevelId: checkLevelId,
        arm: { $regex: new RegExp(`^${escapedArm}$`, 'i') },
        periodId: checkPeriodId,
      })
    );

    if (duplicate) {
      res.status(400).json({
        error: 'Another class with this level and arm already exists for the selected academic period',
      });
      return;
    }

    const classGroup = await ClassGroup.findOneAndUpdate(
      filter,
      updatePayload,
      { new: true }
    )
      .populate('classLevelId')
      .populate({
        path: 'periodId',
        populate: [{ path: 'sessionId' }, { path: 'termId' }],
      });

    if (!classGroup) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    await logActivity({
      schoolId: req.user?.schoolId,
      userId: req.user?.userId,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'UPDATE_CLASS',
      module: 'subjects_classes',
      recordId: String(id),
      description: `Updated class: ${(classGroup.classLevelId as any)?.name || 'Class'} - ${classGroup.arm}`,
    });

    res.json({
      ...classGroup.toObject(),
      name: (classGroup.classLevelId as any)?.name || 'Class',
      sessionId: sessionId || (classGroup.periodId as any)?._id,
      faction: classGroup.faction || null,
    });
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

    await logActivity({
      schoolId: req.user?.schoolId,
      userId: req.user?.userId,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'DELETE_CLASS',
      module: 'subjects_classes',
      recordId: String(id),
      description: `Deleted class`,
    });

    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
