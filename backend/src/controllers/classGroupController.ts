import Student from '../models/Student';
import SubjectRegistration from '../models/SubjectRegistration';
import mongoose from 'mongoose';
import { Response } from 'express';
import ClassGroup from '../models/ClassGroup';
import ClassLevel from '../models/ClassLevel';
import Period from '../models/Period';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';
import { logActivity } from '../models/AuditLog';

export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classLevelId, arm, periodId, faction } = req.body;

    if (!classLevelId || !arm || !periodId) {
      res.status(400).json({ error: 'ClassLevel, arm, and periodId are required' });
      return;
    }

    const classGroup = new ClassGroup({
      schoolId: req.user?.schoolId,
      classLevelId,
      arm,
      periodId,
      faction: faction || null,
    });
    await classGroup.save();

    // Populate for response
    await classGroup.populate('classLevelId');
    await classGroup.populate('periodId');

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
    
    // Always resolve the active period if periodId is not provided
    if (periodId) {
      filter.periodId = periodId;
    } else {
      // Find active period for this school
      const activePeriod = await Period.findOne({
        schoolId: req.user?.schoolId,
        isActive: true,
      });
      if (activePeriod) {
        filter.periodId = activePeriod._id;
      }
    }

    // Role-based filtering: Teachers only see their assigned classes OR classes where they teach a subject
    if (req.user?.role === 'teacher') {
      const teacher = await User.findById(req.user.userId);
      const assignedClassIds = (teacher?.assignedClasses || []).map((id: any) => id.toString());

      // Also check subjects where this teacher is assigned
      const subjectRegistrations = await SubjectRegistration.find({
        schoolId: req.user.schoolId,
        assignedTeacherId: req.user.userId,
      }).distinct('classId');

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
      .populate('periodId');

    // If no classes found and periodId was specified or auto-set, try without periodId filter
    // This handles cases where classes exist in the school across different or legacy periods
    if (classes.length === 0 && filter.periodId) {
      const fallbackFilter = { ...filter };
      delete fallbackFilter.periodId;
      const fallbackClasses = await ClassGroup.find(fallbackFilter)
        .populate('classLevelId')
        .populate('periodId');
      if (fallbackClasses.length > 0) {
        classes = fallbackClasses;
      }
    }

    // Enhance each class with assigned teachers and accurate student count
    const enhancedClasses = await Promise.all(
      classes.map(async (classItem) => {
        // Find teachers assigned to this class
        const teachers = await User.find({
          schoolId: req.user?.schoolId,
          role: 'teacher',
          assignedClasses: classItem._id,
        }).select('_id name email photoUrl');

        // Count students in this class
        const studentCount = await Student.countDocuments({
          schoolId: req.user?.schoolId,
          classId: classItem._id,
          status: 'active',
        });

        const plainClass = classItem.toObject();
        return {
          ...plainClass,
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
      .populate('periodId');

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
      const hasSubject = await SubjectRegistration.exists({
        schoolId: req.user.schoolId,
        classId: classGroup._id,
        assignedTeacherId: req.user.userId,
      });

      if (!isAssigned && !hasSubject) {
        res.status(403).json({ error: 'Access denied to this class' });
        return;
      }
    }

    // Fetch assigned teachers and student count
    const teachers = await User.find({
      schoolId: req.user?.schoolId,
      role: 'teacher',
      assignedClasses: classGroup._id,
    }).select('_id name email photoUrl');

    const studentCount = await Student.countDocuments({
      schoolId: req.user?.schoolId,
      classId: classGroup._id,
      status: 'active',
    });

    res.json({
      ...classGroup.toObject(),
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
    const { classLevelId, arm, periodId, faction } = req.body;

    const filter = addSchoolFilter(req, { _id: id });
    const updatePayload: any = { classLevelId, arm, periodId };
    if (faction !== undefined) {
      updatePayload.faction = faction || null;
    }

    const classGroup = await ClassGroup.findOneAndUpdate(
      filter,
      updatePayload,
      { new: true }
    )
      .populate('classLevelId')
      .populate('periodId');

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
