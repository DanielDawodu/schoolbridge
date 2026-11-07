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

    // If user is a teacher, filter by their assigned classes or classes where they teach subjects
    if (req.user?.role === 'teacher') {
      const teacher = await User.findById(req.user.userId);
      const assignedClassIds = (teacher?.assignedClasses || []).map((c: any) => c.toString());
      const subjectRegistrations = await SubjectRegistration.find({
        schoolId: req.user.schoolId,
        assignedTeacherId: req.user.userId,
      }).distinct('classId');
      const subjectClassIds = subjectRegistrations.map((id: any) => id.toString());
      const allTeacherClassIds = Array.from(new Set([...assignedClassIds, ...subjectClassIds]));

      // If teacher has no assigned classes or subjects, return empty list cleanly
      if (allTeacherClassIds.length === 0) {
        res.json([]);
        return;
      }

      const validObjectIds = allTeacherClassIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      filter._id = { $in: validObjectIds };
    }

    if (periodId) {
      filter.periodId = periodId;
    }

    // Populate classLevel and period data
    const classes = await ClassGroup.find(filter)
      .populate('classLevelId')
      .populate('periodId')
      .sort({ classLevelId: 1, arm: 1 });

    const classIds = classes.map((c) => c._id);

    // Find teachers with assignedClasses
    const teachers = await User.find({
      schoolId: req.user?.schoolId,
      role: 'teacher',
    }).select('name fullName assignedClasses');

    // Also find teachers from SubjectRegistration
    const subjectRegs = await SubjectRegistration.find({
      schoolId: req.user?.schoolId,
      classId: { $in: classIds },
      assignedTeacherId: { $exists: true, $ne: null },
    }).populate('assignedTeacherId', 'name fullName');

    // Count active students per class safely using countDocuments
    const studentCountMap = new Map<string, number>();
    for (const c of classes) {
      try {
        const count = await Student.countDocuments({
          schoolId: req.user?.schoolId,
          classId: c._id,
          status: { $ne: 'inactive' },
        });
        studentCountMap.set(c._id.toString(), count);
      } catch {
        studentCountMap.set(c._id.toString(), 0);
      }
    }

    const enhancedClasses = classes.map((c) => {
      const cId = c._id.toString();
      const classTeachers = new Set<string>();

      teachers.forEach((t: any) => {
        if ((t.assignedClasses || []).some((ac: any) => ac.toString() === cId)) {
          classTeachers.add(t.fullName || t.name);
        }
      });

      subjectRegs.forEach((sr: any) => {
        if (sr.classId?.toString() === cId && sr.assignedTeacherId) {
          const tName = sr.assignedTeacherId.fullName || sr.assignedTeacherId.name;
          if (tName) classTeachers.add(tName);
        }
      });

      const obj: any = c.toObject();
      const levelName =
        typeof c.classLevelId === 'object' && c.classLevelId
          ? (c.classLevelId as any).name
          : (c as any).name || 'Class';

      obj.className = levelName;
      obj.name = `${levelName} - ${c.arm}`;
      obj.level = levelName;
      obj.assignedTeachers = Array.from(classTeachers);
      obj.studentCount = studentCountMap.get(cId) || 0;
      return obj;
    });

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
