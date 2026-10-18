import { Response } from 'express';
import StudentResult from '../models/StudentResult';
import Student from '../models/Student';
import Attendance from '../models/Attendance';
import AcademicSession from '../models/AcademicSession';
import Subject from '../models/Subject';
import SubjectRegistration from '../models/SubjectRegistration';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

// Default grade scale (can be made configurable in Settings later)
const GRADE_SCALE = [
  { min: 70, max: 100, grade: 'A' },
  { min: 60, max: 69, grade: 'B' },
  { min: 50, max: 59, grade: 'C' },
  { min: 40, max: 49, grade: 'D' },
  { min: 0, max: 39, grade: 'F' },
];

const calculateGrade = (score: number): string => {
  for (const { min, max, grade } of GRADE_SCALE) {
    if (score >= min && score <= max) {
      return grade;
    }
  }
  return 'F';
};

const calculateAttendanceSummary = async (
  studentId: string,
  sessionId: string,
  daysOpen: number
): Promise<{ daysOpen: number; daysPresent: number; daysAbsent: number }> => {
  const attendanceRecords = await Attendance.find({
    'records.studentId': studentId,
  });

  let daysPresent = 0;
  let daysAbsent = 0;

  for (const record of attendanceRecords) {
    const studentRecord = record.records.find((r: any) => r.studentId.toString() === studentId);
    if (studentRecord) {
      if (studentRecord.status === 'present' || studentRecord.status === 'late') {
        daysPresent++;
      } else if (studentRecord.status === 'absent') {
        daysAbsent++;
      }
    }
  }

  return {
    daysOpen,
    daysPresent,
    daysAbsent,
  };
};

export const createOrUpdateResult = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, studentId, subjectScores, psychomotorSkills, affectiveDomain, teacherComment } = req.body;

    if (!sessionId || !studentId) {
      res.status(400).json({ error: 'Session ID and student ID are required' });
      return;
    }

    // Get student and session
    const student = await Student.findOne({
      _id: studentId,
      schoolId: req.user?.schoolId,
    });

    const session = await AcademicSession.findOne({
      _id: sessionId,
      schoolId: req.user?.schoolId,
    });

    if (!student || !session) {
      res.status(404).json({ error: 'Student or session not found' });
      return;
    }

    // Calculate totals and grades for each subject
    const processedScores = await Promise.all(
      (subjectScores || []).map(async (score: any) => {
        const subject = await Subject.findById(score.subjectId);
        const ca1Weight = subject?.ca1Weight || 20;
        const ca2Weight = subject?.ca2Weight || 20;
        const examWeight = subject?.examWeight || 60;

        const total = (score.ca1 * ca1Weight / 100) + (score.ca2 * ca2Weight / 100) + (score.exam * examWeight / 100);
        const grade = calculateGrade(total);

        return {
          ...score,
          total: Math.round(total),
          grade,
          position: 0, // Will be calculated later
        };
      })
    );

    // Calculate total and average
    const totalScore = processedScores.reduce((sum, s) => sum + s.total, 0);
    const averageScore = processedScores.length > 0 ? totalScore / processedScores.length : 0;

    // Calculate attendance summary
    const attendanceSummary = await calculateAttendanceSummary(
      studentId,
      sessionId,
      session.daysOpen || 0
    );

    // Find existing result or create new
    let result = await StudentResult.findOne({
      schoolId: req.user?.schoolId,
      sessionId,
      studentId,
    });

    if (result) {
      result.subjectScores = processedScores;
      result.psychomotorSkills = psychomotorSkills || [];
      result.affectiveDomain = affectiveDomain || [];
      result.teacherComment = teacherComment || '';
      result.totalScore = Math.round(totalScore);
      result.averageScore = Math.round(averageScore);
      result.attendanceSummary = attendanceSummary;
      await result.save();
    } else {
      result = new StudentResult({
        schoolId: req.user?.schoolId,
        sessionId,
        studentId,
        classId: student.classId,
        subjectScores: processedScores,
        psychomotorSkills: psychomotorSkills || [],
        affectiveDomain: affectiveDomain || [],
        teacherComment: teacherComment || '',
        totalScore: Math.round(totalScore),
        averageScore: Math.round(averageScore),
        attendanceSummary,
      });
      await result.save();
    }

    res.json(result);
  } catch (error) {
    console.error('Create/update result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStudentResult = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, studentId, performanceType } = req.query;

    if (!sessionId || !studentId) {
      res.status(400).json({ error: 'Session ID and student ID are required' });
      return;
    }

    const filter = addSchoolFilter(req, {
      sessionId,
      studentId,
      performanceType: performanceType || 'term',
    });

    const result = await StudentResult.findOne(filter)
      .populate('studentId')
      .populate('classId')
      .populate('sessionId');

    if (!result) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Get student result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClassResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, classId } = req.query;

    if (!sessionId || !classId) {
      res.status(400).json({ error: 'Session ID and class ID are required' });
      return;
    }

    const filter = addSchoolFilter(req, {
      sessionId,
      classId,
    });

    let results = await StudentResult.find(filter)
      .populate('studentId')
      .populate('classId')
      .sort({ averageScore: -1 });

    // Calculate class positions
    results = results.map((result, index) => {
      result.classPosition = index + 1;
      return result;
    });

    // Calculate class average
    const classAverage = results.length > 0
      ? results.reduce((sum, r) => sum + r.averageScore, 0) / results.length
      : 0;

    // Update each result with class average
    await Promise.all(
      results.map(async (result) => {
        result.classAverage = Math.round(classAverage);
        await result.save();
      })
    );

    res.json(results);
  } catch (error) {
    console.error('Get class results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateHeadOfSchoolComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { resultId, comment } = req.body;

    if (!resultId) {
      res.status(400).json({ error: 'Result ID is required' });
      return;
    }

    const filter = addSchoolFilter(req, { _id: resultId });
    const result = await StudentResult.findOneAndUpdate(
      filter,
      { headOfSchoolComment: comment },
      { new: true }
    );

    if (!result) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Update head of school comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const saveStudentResult = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, studentId, subjectScores, psychomotorSkills, affectiveDomain, teacherComment, headOfSchoolComment, performanceType } = req.body;

    if (!sessionId || !studentId) {
      res.status(400).json({ error: 'Session ID and student ID are required' });
      return;
    }

    // Get student and session
    const student = await Student.findOne({
      _id: studentId,
      schoolId: req.user?.schoolId,
    });

    const session = await AcademicSession.findOne({
      _id: sessionId,
      schoolId: req.user?.schoolId,
    });

    if (!student || !session) {
      res.status(404).json({ error: 'Student or session not found' });
      return;
    }

    // If teacher, verify they are assigned to these subjects
    if (req.user?.role === 'teacher') {
      const userRegistrations = await SubjectRegistration.find({
        schoolId: req.user?.schoolId,
        sessionId,
        assignedTeacherId: req.user.userId,
      });

      const assignedSubjectIds = userRegistrations.map(r => r.subjectId.toString());
      const requestedSubjectIds = (subjectScores || []).map((s: any) => s.subjectId);

      for (const subjectId of requestedSubjectIds) {
        if (!assignedSubjectIds.includes(subjectId)) {
          res.status(403).json({ error: 'Teacher can only enter scores for assigned subjects' });
          return;
        }
      }
    }

    // Calculate totals and grades for each subject
    const processedScores = await Promise.all(
      (subjectScores || []).map(async (score: any) => {
        const subject = await Subject.findById(score.subjectId);
        const ca1Weight = subject?.ca1Weight || 20;
        const ca2Weight = subject?.ca2Weight || 20;
        const examWeight = subject?.examWeight || 60;

        const total = (score.ca1 * ca1Weight / 100) + (score.ca2 * ca2Weight / 100) + (score.exam * examWeight / 100);
        const grade = calculateGrade(total);

        return {
          ...score,
          total: Math.round(total),
          grade,
          position: 0, // Will be calculated later
        };
      })
    );

    // Calculate total and average
    const totalScore = processedScores.reduce((sum, s) => sum + s.total, 0);
    const averageScore = processedScores.length > 0 ? totalScore / processedScores.length : 0;

    // Calculate attendance summary (only for full term results)
    const attendanceSummary = performanceType === 'term'
      ? await calculateAttendanceSummary(studentId, sessionId, session.daysOpen || 0)
      : { daysOpen: 0, daysPresent: 0, daysAbsent: 0 };

    // Find existing result or create new
    let result = await StudentResult.findOne({
      schoolId: req.user?.schoolId,
      sessionId,
      studentId,
      performanceType: performanceType || 'term',
    });

    if (result) {
      result.subjectScores = processedScores;
      // Only update psychomotor/affective for full term
      if (performanceType === 'term' || !performanceType) {
        result.psychomotorSkills = psychomotorSkills || [];
        result.affectiveDomain = affectiveDomain || [];
      }
      result.teacherComment = teacherComment || '';
      if (headOfSchoolComment !== undefined) {
        result.headOfSchoolComment = headOfSchoolComment;
      }
      result.totalScore = Math.round(totalScore);
      result.averageScore = Math.round(averageScore);
      result.attendanceSummary = attendanceSummary;
      await result.save();
    } else {
      result = new StudentResult({
        schoolId: req.user?.schoolId,
        sessionId,
        studentId,
        classId: student.classId,
        performanceType: performanceType || 'term',
        subjectScores: processedScores,
        psychomotorSkills: (performanceType === 'term' || !performanceType) ? (psychomotorSkills || []) : [],
        affectiveDomain: (performanceType === 'term' || !performanceType) ? (affectiveDomain || []) : [],
        teacherComment: teacherComment || '',
        headOfSchoolComment: headOfSchoolComment || '',
        totalScore: Math.round(totalScore),
        averageScore: Math.round(averageScore),
        attendanceSummary,
      });
      await result.save();
    }

    res.json(result);
  } catch (error) {
    console.error('Save student result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStudentTermResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, studentId } = req.query;

    if (!sessionId || !studentId) {
      res.status(400).json({ error: 'Session ID and student ID are required' });
      return;
    }

    const filter = addSchoolFilter(req, {
      sessionId,
      studentId,
      performanceType: 'term',
    });

    const results = await StudentResult.find(filter)
      .populate('sessionId')
      .sort({ 'sessionId.currentTerm': 1 });

    res.json(results);
  } catch (error) {
    console.error('Get student term results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const releaseResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, classId } = req.body;

    if (!sessionId || !classId) {
      res.status(400).json({ error: 'Session ID and class ID are required' });
      return;
    }

    const filter = addSchoolFilter(req, {
      sessionId,
      classId,
    });

    const result = await StudentResult.updateMany(filter, { isReleased: true });

    res.json({
      message: `Released ${result.modifiedCount} results`,
      releasedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Release results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
