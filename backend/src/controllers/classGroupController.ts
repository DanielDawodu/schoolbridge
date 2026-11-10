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
 * Verifies school ownership for security.
 */
async function resolveClassLevel(
  req: AuthRequest,
  classLevelId?: string,
  name?: string
): Promise<{ levelId: mongoose.Types.ObjectId | null; error?: string }> {
  const schoolId = req.user?.schoolId;
  if (!schoolId) {
    return { levelId: null, error: 'Authentication required' };
  }

  // 1. If explicit classLevelId provided, verify it exists and belongs to this school
  if (classLevelId) {
    if (!mongoose.isValidObjectId(classLevelId)) {
      return { levelId: null, error: 'Invalid class level ID format' };
    }

    const existing = await ClassLevel.findOne(
      addSchoolFilter(req, { _id: classLevelId })
    );
    if (!existing) {
      return { levelId: null, error: 'The specified class level does not exist or does not belong to your school' };
    }

    return { levelId: existing._id as mongoose.Types.ObjectId };
  }

  // 2. If name provided, lookup by case-insensitive name for this school
  const trimmedName = (name || '').trim();
  if (trimmedName) {
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let classLevel = await ClassLevel.findOne(
      addSchoolFilter(req, {
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      })
    );
    if (classLevel) {
      return { levelId: classLevel._id as mongoose.Types.ObjectId };
    }

    // Auto-create new ClassLevel strictly scoped to this school
    classLevel = new ClassLevel({
      schoolId: req.user?.schoolId,
      name: trimmedName,
      levelOrder: 0,
    });
    await classLevel.save();
    return { levelId: classLevel._id as mongoose.Types.ObjectId };
  }

  return { levelId: null, error: 'Class level or name is required' };
}

/**
 * Maps an AcademicSession (year, currentTerm) to its corresponding Period for the authenticated school.
 * Only creates missing Session, Term, Period records when their exact relationship is safely established.
 */
async function findPeriodForAcademicSession(
  req: AuthRequest,
  academicSession: any
): Promise<mongoose.Types.ObjectId | null> {
  const schoolId = req.user?.schoolId;
  if (!schoolId || !academicSession) return null;

  const termMap: Record<string, { names: string[]; canonical: string; order: number }> = {
    first: { names: ['1st Term', 'First Term', 'first', '1st term'], canonical: '1st Term', order: 1 },
    second: { names: ['2nd Term', 'Second Term', 'second', '2nd term'], canonical: '2nd Term', order: 2 },
    third: { names: ['3rd Term', 'Third Term', 'third', '3rd term'], canonical: '3rd Term', order: 3 },
  };

  const termConfig = termMap[academicSession.currentTerm] || {
    names: ['1st Term', 'First Term'],
    canonical: '1st Term',
    order: 1,
  };

  // 1. Find or safely create Session for this school
  let sessionDoc = await Session.findOne(
    addSchoolFilter(req, { year: academicSession.year })
  );

  if (!sessionDoc) {
    sessionDoc = new Session({
      schoolId: req.user?.schoolId,
      year: academicSession.year,
    });
    await sessionDoc.save();
  }

  // 2. Find or safely create Term for this school
  let termDoc = await Term.findOne(
    addSchoolFilter(req, { name: { $in: termConfig.names } })
  );

  if (!termDoc) {
    termDoc = new Term({
      schoolId: req.user?.schoolId,
      name: termConfig.canonical,
      order: termConfig.order,
    });
    await termDoc.save();
  }

  // 3. Find or safely create Period for this school, session, and term
  let period = await Period.findOne(
    addSchoolFilter(req, {
      sessionId: sessionDoc._id,
      termId: termDoc._id,
    })
  );

  if (!period) {
    period = new Period({
      schoolId: req.user?.schoolId,
      sessionId: sessionDoc._id,
      termId: termDoc._id,
      daysOpen: 0,
      isActive: false,
    });
    await period.save();
  }

  return period._id as mongoose.Types.ObjectId;
}

/**
 * Resolves a Period ID strictly scoped to the authenticated school.
 * - If an AcademicSession or Period ID is provided, it MUST resolve to that exact record.
 * - Never falls back to active/latest periods if a specific ID was passed.
 */
async function resolvePeriod(
  req: AuthRequest,
  periodId?: string,
  sessionId?: string
): Promise<{ periodId: mongoose.Types.ObjectId | null; error?: string }> {
  const schoolId = req.user?.schoolId;
  if (!schoolId) {
    return { periodId: null, error: 'Authentication required' };
  }

  const requestedId = sessionId || periodId;

  // Case 1: Client specified a specific session or period ID
  if (requestedId) {
    if (!mongoose.isValidObjectId(requestedId)) {
      return { periodId: null, error: 'Invalid academic session or period ID format' };
    }

    // A. Check if requestedId is an AcademicSession belonging to THIS school
    const academicSession = await AcademicSession.findOne(
      addSchoolFilter(req, { _id: requestedId })
    );

    if (academicSession) {
      const resolved = await findPeriodForAcademicSession(req, academicSession);
      if (!resolved) {
        return {
          periodId: null,
          error: `Could not establish an academic period for session ${academicSession.year} (${academicSession.currentTerm} term)`,
        };
      }
      return { periodId: resolved };
    }

    // B. Check if requestedId is directly a Period belonging to THIS school
    const directPeriod = await Period.findOne(
      addSchoolFilter(req, { _id: requestedId })
    );

    if (directPeriod) {
      return { periodId: directPeriod._id as mongoose.Types.ObjectId };
    }

    // C. If requestedId was provided but belongs to another school or does not exist:
    return {
      periodId: null,
      error: 'The selected academic session or period does not exist or does not belong to your school',
    };
  }

  // Case 2: No specific session or period was requested - use school's active period
  const school = await School.findById(schoolId);
  if (school?.activePeriodId) {
    const activePeriod = await Period.findOne(
      addSchoolFilter(req, { _id: school.activePeriodId })
    );
    if (activePeriod) {
      return { periodId: activePeriod._id as mongoose.Types.ObjectId };
    }
  }

  const activePeriod = await Period.findOne(
    addSchoolFilter(req, { isActive: true })
  );
  if (activePeriod) {
    return { periodId: activePeriod._id as mongoose.Types.ObjectId };
  }

  return {
    periodId: null,
    error: 'No academic session was selected, and no active academic period is configured for this school',
  };
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

    const levelResolution = await resolveClassLevel(req, classLevelId, inputName);
    if (!levelResolution.levelId) {
      res.status(400).json({ error: levelResolution.error || 'Failed to resolve class level' });
      return;
    }

    const periodResolution = await resolvePeriod(req, periodId, sessionId);
    if (!periodResolution.periodId) {
      res.status(400).json({
        error: periodResolution.error || 'Active academic period or session is required',
      });
      return;
    }

    // Check for duplicate class in the exact same period for this school
    const escapedArm = trimmedArm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingClass = await ClassGroup.findOne(
      addSchoolFilter(req, {
        classLevelId: levelResolution.levelId,
        arm: { $regex: new RegExp(`^${escapedArm}$`, 'i') },
        periodId: periodResolution.periodId,
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
      classLevelId: levelResolution.levelId,
      arm: trimmedArm,
      periodId: periodResolution.periodId,
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
      const levelResolution = await resolveClassLevel(req, classLevelId, inputName);
      if (!levelResolution.levelId) {
        res.status(400).json({ error: levelResolution.error || 'Failed to resolve class level' });
        return;
      }
      updatePayload.classLevelId = levelResolution.levelId;
    }

    if (periodId !== undefined || sessionId !== undefined) {
      const periodResolution = await resolvePeriod(req, periodId, sessionId);
      if (!periodResolution.periodId) {
        res.status(400).json({ error: periodResolution.error || 'Failed to resolve academic period' });
        return;
      }
      updatePayload.periodId = periodResolution.periodId;
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
