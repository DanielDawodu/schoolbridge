import { Response } from 'express';
import Student from '../models/Student';
import ClassGroup from '../models/ClassGroup';
import ClassLevel from '../models/ClassLevel';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const getPromotionCandidates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sourceClassId } = req.params;

    if (!sourceClassId) {
      res.status(400).json({ error: 'Source class ID is required' });
      return;
    }

    // Get all active students in the source class
    const filter = addSchoolFilter(req, {
      classId: sourceClassId,
      status: 'active',
    });

    const students = await Student.find(filter)
      .select('_id fullName admissionNo classId')
      .populate({
        path: 'classId',
        populate: { path: 'classLevelId' }
      });

    res.json(students);
  } catch (error) {
    console.error('Get promotion candidates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const promoteStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sourceClassId, targetClassId, studentIds } = req.body;

    if (!sourceClassId || !targetClassId || !studentIds || !Array.isArray(studentIds)) {
      res.status(400).json({ error: 'Source class, target class, and student IDs are required' });
      return;
    }

    if (studentIds.length === 0) {
      res.status(400).json({ error: 'No students selected for promotion' });
      return;
    }

    // Verify source and target classes exist and belong to the school
    const sourceClass = await ClassGroup.findOne({
      _id: sourceClassId,
      schoolId: req.user?.schoolId,
    }).populate('classLevelId');

    const targetClass = await ClassGroup.findOne({
      _id: targetClassId,
      schoolId: req.user?.schoolId,
    }).populate('classLevelId');

    if (!sourceClass) {
      res.status(404).json({ error: 'Source class not found' });
      return;
    }

    if (!targetClass) {
      res.status(404).json({ error: 'Target class not found' });
      return;
    }

    // Update classId for selected students
    const result = await Student.updateMany(
      {
        _id: { $in: studentIds },
        schoolId: req.user?.schoolId,
        classId: sourceClassId,
      },
      {
        classId: targetClassId,
      }
    );

    const sourceLevelName = (sourceClass as any).classLevelId?.name || 'Unknown';
    const targetLevelName = (targetClass as any).classLevelId?.name || 'Unknown';

    res.json({
      message: `Successfully promoted ${result.modifiedCount} students`,
      promotedCount: result.modifiedCount,
      sourceClass: `${sourceLevelName}-${sourceClass.arm}`,
      targetClass: `${targetLevelName}-${targetClass.arm}`,
    });
  } catch (error) {
    console.error('Promote students error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
