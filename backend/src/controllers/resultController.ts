import { Response } from 'express';
import mongoose from 'mongoose';
import School from '../models/School';
import StudentResult from '../models/StudentResult';
import Student from '../models/Student';
import Attendance from '../models/Attendance';
import AcademicSession from '../models/AcademicSession';
import Period from '../models/Period';
import Subject from '../models/Subject';
import SubjectRegistration from '../models/SubjectRegistration';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

const currentUserIsAdmin = (req: AuthRequest) => req.user?.role === 'admin';

// Default grade scale
const GRADE_SCALE = [
  { min: 70, max: 100, grade: 'A' },
  { min: 60, max: 69, grade: 'B' },
  { min: 50, max: 59, grade: 'C' },
  { min: 40, max: 49, grade: 'D' },
  { min: 0, max: 39, grade: 'F' },
];

export const calculateGrade = (score: number, schoolGradeScale?: any[]): string => {
  const scale = schoolGradeScale && schoolGradeScale.length > 0 ? schoolGradeScale : GRADE_SCALE;
  for (const item of scale) {
    if (score >= item.min && score <= item.max) {
      return item.grade;
    }
  }
  return 'F';
};

export const getSchoolAssessmentConfig = async (schoolId: any) => {
  const school = await School.findById(schoolId);
  const config = school?.assessmentConfig || {
    examMax: 60,
    midtermMax: 40,
    ca1Max: 20,
    ca2Max: 20,
  };
  const examMax = Number(config.examMax) || 60;
  const midtermMax = Number(config.midtermMax) || 40;
  const ca1Max = config.ca1Max !== undefined ? Number(config.ca1Max) : Math.round(midtermMax / 2);
  const ca2Max = config.ca2Max !== undefined ? Number(config.ca2Max) : (midtermMax - ca1Max);
  return {
    examMax,
    midtermMax,
    ca1Max,
    ca2Max,
    gradeScale: school?.gradeScale,
  };
};

export const resolvePeriodAndSession = async (targetId: string, schoolId?: any) => {
  let period: any = null;
  let session: any = null;

  if (targetId) {
    period = await Period.findOne({ _id: targetId, ...(schoolId ? { schoolId } : {}) });
    if (!period) {
      session = await AcademicSession.findOne({ _id: targetId, ...(schoolId ? { schoolId } : {}) });
      if (session) {
        period = await Period.findOne({ sessionId: session._id, ...(schoolId ? { schoolId } : {}) });
      }
    } else {
      session = await AcademicSession.findById(period.sessionId);
    }
  }

  const daysOpen = period?.daysOpen || session?.daysOpen || 0;
  return { period, session, daysOpen };
};

export const buildPeriodOrSessionFilter = (targetId: string) => {
  return {
    $or: [{ periodId: targetId }, { sessionId: targetId }],
  };
};

const calculateAttendanceSummary = async (
  schoolId: any,
  studentId: string,
  daysOpen: number
): Promise<{ daysOpen: number; daysPresent: number; daysAbsent: number }> => {
  const attendanceRecords = await Attendance.find({
    schoolId,
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

/**
 * Automatically recalculate student positions, overall percentages, and class average.
 * Follows Phase 2 rules:
 * - Isolated by class, session/period, and assessment type.
 * - Percentage = (Total Marks Obtained / Total Available Marks) * 100.
 * - Competition ranking for ties (1st, 1st, 3rd...).
 * - Identical percentages receive identical positions.
 * - Excludes incomplete results from published ranking.
 */
export const recalculateClassRankings = async (
  schoolId: any,
  classId: any,
  targetId: string,
  performanceType: string = 'term'
) => {
  if (!schoolId || !classId || !targetId) return;

  const { examMax, midtermMax, ca1Max, ca2Max } = await getSchoolAssessmentConfig(schoolId);
  const totalMaxPerSubject = performanceType === 'mid-term' ? midtermMax : (ca1Max + ca2Max + examMax);

  // Find all results for this class, period, and performanceType
  const results = await StudentResult.find({
    schoolId,
    classId,
    ...buildPeriodOrSessionFilter(targetId),
    performanceType: (performanceType as any) || 'term',
  });

  // Only rank results that are marked as completed!
  const completedResults = results.filter((r: any) => r.isCompleted === true);

  if (completedResults.length === 0) {
    for (const r of results as any[]) {
      r.classPosition = 0;
      r.classAverage = 0;
      await r.save();
    }
    return;
  }

  // Calculate percentage and totalAvailableMarks for each completed result
  const calculatedItems = completedResults.map((result: any) => {
    let totalAvailable = 0;
    let totalObtained = 0;

    for (const score of result.subjectScores || []) {
      totalObtained += Number(score.total) || 0;
      totalAvailable += totalMaxPerSubject || 100;
    }

    const percentage = totalAvailable > 0
      ? Number(((totalObtained / totalAvailable) * 100).toFixed(2))
      : 0;

    return {
      result,
      totalObtained,
      totalAvailable,
      percentage,
    };
  });

  // Class average percentage = average of eligible students' overall percentages
  const sumPercentages = calculatedItems.reduce((sum, item) => sum + item.percentage, 0);
  const classAveragePercentage = Number((sumPercentages / calculatedItems.length).toFixed(2));

  // Sort descending by percentage (highest to lowest)
  calculatedItems.sort((a, b) => b.percentage - a.percentage);

  // Apply standard competition ranking (1st, 1st, 3rd...)
  for (let i = 0; i < calculatedItems.length; i++) {
    const item = calculatedItems[i];
    let position = i + 1;
    if (i > 0 && item.percentage === calculatedItems[i - 1].percentage) {
      position = (calculatedItems[i - 1].result as any).classPosition;
    }
    const r: any = item.result;
    r.classPosition = position;
    r.classAverage = classAveragePercentage;
    r.totalAvailableMarks = item.totalAvailable;
    r.totalScore = item.totalObtained;
    r.percentage = item.percentage;
    r.averageScore = item.percentage;
    await r.save();
  }

  // Set position 0 for any incomplete results in the class
  const completedIds = new Set(completedResults.map((r: any) => r._id.toString()));
  for (const r of results as any[]) {
    if (!completedIds.has(r._id.toString())) {
      r.classPosition = 0;
      r.classAverage = classAveragePercentage;
      await r.save();
    }
  }
};

export const createOrUpdateResult = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, periodId, studentId, subjectScores, psychomotorSkills, affectiveDomain, teacherComment, performanceType = 'term' } = req.body;
    const targetId = periodId || sessionId;

    if (!targetId || !studentId) {
      res.status(400).json({ error: 'Session/Period ID and student ID are required' });
      return;
    }

    const student = await Student.findOne({
      _id: studentId,
      schoolId: req.user?.schoolId,
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const { period, session, daysOpen } = await resolvePeriodAndSession(targetId, req.user?.schoolId);

    // Calculate totals and grades for each subject
    const processedScores = await Promise.all(
      (subjectScores || []).map(async (score: any) => {
        const subject = await Subject.findById(score.subjectId);
        const ca1Weight = subject?.ca1Weight || 20;
        const ca2Weight = subject?.ca2Weight || 20;
        const examWeight = subject?.examWeight || 60;

        let total = 0;
        if (performanceType === 'mid-term') {
          const caTotalWeight = ca1Weight + ca2Weight;
          if (caTotalWeight > 0) {
            total = Math.round(
              (((score.ca1 || 0) * ca1Weight) / 100 + ((score.ca2 || 0) * ca2Weight) / 100) /
                (caTotalWeight / 100)
            );
          } else {
            total = Math.round(((score.ca1 || 0) + (score.ca2 || 0)) / 2);
          }
        } else {
          total = Math.round(
            ((score.ca1 || 0) * ca1Weight) / 100 +
              ((score.ca2 || 0) * ca2Weight) / 100 +
              ((score.exam || 0) * examWeight) / 100
          );
        }
        const grade = calculateGrade(total);

        return {
          ...score,
          total: Math.round(total),
          grade,
          position: 0,
        };
      })
    );

    const totalScore = processedScores.reduce((sum, s) => sum + s.total, 0);
    const averageScore = processedScores.length > 0 ? totalScore / processedScores.length : 0;

    const attendanceSummary = await calculateAttendanceSummary(
      req.user?.schoolId,
      studentId,
      daysOpen
    );

    let result = await StudentResult.findOne({
      schoolId: req.user?.schoolId,
      ...buildPeriodOrSessionFilter(targetId),
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
      if (period?._id) result.periodId = period._id;
      if (session?._id) result.sessionId = session._id;
      await result.save();
    } else {
      result = new StudentResult({
        schoolId: req.user?.schoolId,
        periodId: period?._id || targetId,
        sessionId: session?._id || targetId,
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

    if (result.isCompleted) {
      await recalculateClassRankings(req.user?.schoolId, student.classId, targetId, performanceType);
    }

    res.json(result);
  } catch (error) {
    console.error('Create/update result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStudentResult = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, periodId, studentId, performanceType } = req.query;
    const targetId = (periodId || sessionId) as string;

    if (!targetId || !studentId) {
      res.status(400).json({ error: 'Session/Period ID and student ID are required' });
      return;
    }

    const filter = addSchoolFilter(req, {
      ...buildPeriodOrSessionFilter(targetId),
      studentId,
      performanceType: performanceType || 'term',
    });

    const result = await StudentResult.findOne(filter)
      .populate('studentId')
      .populate('classId')
      .populate('periodId')
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
    const { sessionId, periodId, classId, performanceType } = req.query;
    const targetId = (periodId || sessionId) as string;
    const pType = (performanceType as string) || 'term';

    if (!targetId || !classId) {
      res.status(400).json({ error: 'Session/Period ID and class ID are required' });
      return;
    }

    // Refresh rankings
    await recalculateClassRankings(req.user?.schoolId, classId, targetId, pType);

    const filter = addSchoolFilter(req, {
      ...buildPeriodOrSessionFilter(targetId),
      classId,
      performanceType: pType,
    });

    const results = await StudentResult.find(filter)
      .populate('studentId')
      .populate('classId')
      .populate('periodId')
      .populate('sessionId')
      .sort({ classPosition: 1, percentage: -1 });

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

    if (!comment || !comment.trim()) {
      res.status(400).json({ error: "Head Teacher's / Principal's comment is required" });
      return;
    }

    const filter = addSchoolFilter(req, { _id: resultId });
    const result = await StudentResult.findOne(filter);

    if (!result) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    // The Head Teacher's/Principal's comment must only become editable after the teacher has completed the student's result sheet.
    if (!result.isCompleted) {
      res.status(400).json({
        error: "Cannot approve or save comment: The teacher has not completed this student's result sheet yet.",
      });
      return;
    }

    result.headOfSchoolComment = comment.trim();
    result.isApproved = true;
    result.approvedBy = req.user?.userId as any;
    result.approvedAt = new Date();
    await result.save();

    res.json(result);
  } catch (error) {
    console.error('Update head of school comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const saveStudentResult = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      sessionId,
      periodId,
      studentId,
      subjectScores,
      psychomotorSkills,
      affectiveDomain,
      teacherComment,
      headOfSchoolComment,
      performanceType,
    } = req.body;
    const targetId = periodId || sessionId;

    if (!targetId || !studentId) {
      res.status(400).json({ error: 'Session/Period ID and student ID are required' });
      return;
    }

    const student = await Student.findOne({
      _id: studentId,
      schoolId: req.user?.schoolId,
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const { period, session, daysOpen } = await resolvePeriodAndSession(targetId, req.user?.schoolId);

    // Fetch school assessment config and grade scale
    const { examMax, midtermMax, ca1Max, ca2Max, gradeScale } = await getSchoolAssessmentConfig(req.user?.schoolId);

    // If teacher, verify class and subject assignments
    if (req.user?.role === 'teacher') {
      const isAssignedClass = (req.user.assignedClasses || []).some(
        (c: any) => c.toString() === student.classId?.toString()
      );
      const teachesInClass = await SubjectRegistration.exists({
        schoolId: req.user.schoolId,
        classId: student.classId,
        assignedTeacherId: req.user.userId,
      });

      if (!isAssignedClass && !teachesInClass) {
        res.status(403).json({ error: "Access denied: You are not assigned to this student's class" });
        return;
      }

      const userRegistrations = await SubjectRegistration.find({
        schoolId: req.user?.schoolId,
        ...buildPeriodOrSessionFilter(targetId),
        classId: student.classId,
        assignedTeacherId: req.user.userId,
      });

      const assignedSubjectIds = userRegistrations.map((r) => r.subjectId.toString());
      const requestedSubjectIds = (subjectScores || []).map((s: any) => s.subjectId.toString());

      for (const subjectId of requestedSubjectIds) {
        if (!assignedSubjectIds.includes(subjectId)) {
          res.status(403).json({ error: 'Teacher can only enter or modify scores for assigned subjects' });
          return;
        }
      }
    }

    // Check if result is already completed and user is teacher
    let existingResult = await StudentResult.findOne({
      schoolId: req.user?.schoolId,
      ...buildPeriodOrSessionFilter(targetId),
      studentId,
      performanceType: performanceType || 'term',
    });

    if (existingResult && existingResult.isCompleted && req.user?.role === 'teacher') {
      res.status(400).json({
        error: 'This result has already been completed. An administrator must reopen it before changes can be made.',
      });
      return;
    }

    // Strict validation of scores
    for (const score of subjectScores || []) {
      const sName = score.subjectName || 'Subject';
      const ca1 = Number(score.ca1);
      const ca2 = Number(score.ca2);
      const exam = Number(score.exam);

      if (isNaN(ca1) || ca1 < 0 || ca1 > ca1Max) {
        res.status(400).json({ error: `CA1 score for ${sName} must be between 0 and ${ca1Max}` });
        return;
      }
      if (isNaN(ca2) || ca2 < 0 || ca2 > ca2Max) {
        res.status(400).json({ error: `CA2 score for ${sName} must be between 0 and ${ca2Max}` });
        return;
      }
      if (performanceType === 'term') {
        if (isNaN(exam) || exam < 0 || exam > examMax) {
          res.status(400).json({ error: `Exam score for ${sName} must be between 0 and ${examMax}` });
          return;
        }
      }
    }

    // Calculate totals and grades for each subject
    const totalMax = performanceType === 'mid-term' ? midtermMax : (ca1Max + ca2Max + examMax);

    const processedScores = await Promise.all(
      (subjectScores || []).map(async (score: any) => {
        const ca1 = Number(score.ca1) || 0;
        const ca2 = Number(score.ca2) || 0;
        const exam = performanceType === 'term' ? (Number(score.exam) || 0) : 0;

        let total = 0;
        if (performanceType === 'mid-term') {
          if (midtermMax > 0 && midtermMax !== 100) {
            total = Math.round(((ca1 + ca2) / midtermMax) * 100);
          } else {
            total = ca1 + ca2;
          }
        } else {
          if (totalMax > 0 && totalMax !== 100) {
            total = Math.round(((ca1 + ca2 + exam) / totalMax) * 100);
          } else {
            total = ca1 + ca2 + exam;
          }
        }

        const grade = calculateGrade(total, gradeScale);

        return {
          ...score,
          ca1,
          ca2,
          exam,
          total: Math.round(total),
          grade,
          position: 0,
        };
      })
    );

    // If teacher submitted, merge with existing scores so other teachers' entered scores are preserved
    let finalScores = processedScores;
    if (existingResult && req.user?.role === 'teacher') {
      const submittedIds = new Set(processedScores.map((s: any) => s.subjectId.toString()));
      const otherScores = (existingResult.subjectScores || []).filter(
        (s: any) => !submittedIds.has(s.subjectId.toString())
      );
      finalScores = [...otherScores, ...processedScores];
    }

    const totalScore = finalScores.reduce((sum, s) => sum + s.total, 0);
    const totalAvailableMarks = finalScores.length * totalMax;
    const percentage = totalAvailableMarks > 0
      ? Number(((totalScore / totalAvailableMarks) * 100).toFixed(2))
      : 0;
    const averageScore = percentage;

    const attendanceSummary =
      performanceType === 'term' || !performanceType
        ? await calculateAttendanceSummary(req.user?.schoolId, studentId, daysOpen)
        : { daysOpen: 0, daysPresent: 0, daysAbsent: 0 };

    let result = existingResult;
    if (result) {
      result.subjectScores = finalScores;
      if (performanceType === 'term' || !performanceType) {
        if (psychomotorSkills) result.psychomotorSkills = psychomotorSkills;
        if (affectiveDomain) result.affectiveDomain = affectiveDomain;
      }
      if (teacherComment !== undefined) {
        result.teacherComment = teacherComment;
      }
      if (currentUserIsAdmin(req) && headOfSchoolComment !== undefined) {
        result.headOfSchoolComment = headOfSchoolComment;
      }
      result.totalScore = Math.round(totalScore);
      result.totalAvailableMarks = totalAvailableMarks;
      result.percentage = percentage;
      result.averageScore = averageScore;
      result.attendanceSummary = attendanceSummary;
      if (period?._id) result.periodId = period._id;
      if (session?._id) result.sessionId = session._id;
      await result.save();
    } else {
      result = new StudentResult({
        schoolId: req.user?.schoolId,
        periodId: period?._id || targetId,
        sessionId: session?._id || targetId,
        studentId,
        classId: student.classId,
        performanceType: performanceType || 'term',
        subjectScores: finalScores,
        psychomotorSkills: performanceType === 'term' || !performanceType ? psychomotorSkills || [] : [],
        affectiveDomain: performanceType === 'term' || !performanceType ? affectiveDomain || [] : [],
        teacherComment: teacherComment || '',
        headOfSchoolComment: currentUserIsAdmin(req) ? headOfSchoolComment || '' : '',
        totalScore: Math.round(totalScore),
        totalAvailableMarks,
        percentage,
        averageScore,
        attendanceSummary,
      });
      await result.save();
    }

    if (result.isCompleted) {
      await recalculateClassRankings(req.user?.schoolId, student.classId, targetId, performanceType || 'term');
      const updated = await StudentResult.findById(result._id);
      res.json(updated);
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Save student result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Phase 1: Complete Result endpoint
 * Validates:
 * 1. All registered subjects for class have entered scores.
 * 2. Affective domain completed (for term).
 * 3. Psychomotor skills completed (for term).
 * 4. Teacher's comment non-empty.
 * 5. All scores within configured max.
 * Marks as completed, records completing user and timestamp, recalculates rankings.
 */
export const completeStudentResult = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      sessionId,
      periodId,
      studentId,
      performanceType = 'term',
      subjectScores,
      psychomotorSkills,
      affectiveDomain,
      teacherComment,
    } = req.body;
    const targetId = periodId || sessionId;

    if (!targetId || !studentId) {
      res.status(400).json({ error: 'Session/Period ID and student ID are required' });
      return;
    }

    const student = await Student.findOne({
      _id: studentId,
      schoolId: req.user?.schoolId,
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Role check: Teacher must be assigned to this class
    if (req.user?.role === 'teacher') {
      const isAssigned = (req.user.assignedClasses || []).some(
        (c: any) => c.toString() === student.classId?.toString()
      );
      const teachesInClass = await SubjectRegistration.exists({
        schoolId: req.user.schoolId,
        classId: student.classId,
        assignedTeacherId: req.user.userId,
      });

      if (!isAssigned && !teachesInClass) {
        res.status(403).json({ error: "Access denied: You are not assigned to this student's class" });
        return;
      }
    }

    const { period, session, daysOpen } = await resolvePeriodAndSession(targetId, req.user?.schoolId);
    const { examMax, midtermMax, ca1Max, ca2Max, gradeScale } = await getSchoolAssessmentConfig(req.user?.schoolId);
    const totalMax = performanceType === 'mid-term' ? midtermMax : (ca1Max + ca2Max + examMax);

    // 1. Fetch expected subjects
    let registeredSubjects = await SubjectRegistration.find({
      schoolId: req.user?.schoolId,
      ...buildPeriodOrSessionFilter(targetId),
      classId: student.classId,
    }).populate('subjectId');

    let expectedSubjectList: any[] = registeredSubjects.map((r) => r.subjectId).filter(Boolean);

    // Fallback to school-wide subjects if no session registration exists
    if (expectedSubjectList.length === 0) {
      expectedSubjectList = await Subject.find({
        schoolId: req.user?.schoolId,
        $or: [{ classId: student.classId }, { classId: { $exists: false } }, { classId: null }],
      });
    }

    // Get current saved result to merge if necessary
    let existingResult = await StudentResult.findOne({
      schoolId: req.user?.schoolId,
      ...buildPeriodOrSessionFilter(targetId),
      studentId,
      performanceType,
    });

    // Merge submitted scores with any existing saved scores
    const incomingScores = subjectScores || [];
    const existingScores = existingResult?.subjectScores || [];

    const mergedScoresMap = new Map<string, any>();
    existingScores.forEach((s: any) => mergedScoresMap.set(s.subjectId.toString(), s));
    incomingScores.forEach((s: any) => mergedScoresMap.set(s.subjectId.toString(), s));

    const finalScoresList = Array.from(mergedScoresMap.values());

    // Validation 1: All registered subjects have scores
    const missingSubjects: string[] = [];
    for (const expSub of expectedSubjectList) {
      const subIdStr = expSub._id.toString();
      const score = finalScoresList.find((s) => s.subjectId.toString() === subIdStr);
      if (!score) {
        missingSubjects.push(expSub.name);
      } else {
        if (score.ca1 === undefined || score.ca1 === null || isNaN(Number(score.ca1))) {
          missingSubjects.push(`${expSub.name} (CA1)`);
        }
        if (score.ca2 === undefined || score.ca2 === null || isNaN(Number(score.ca2))) {
          missingSubjects.push(`${expSub.name} (CA2)`);
        }
        if (performanceType === 'term') {
          if (score.exam === undefined || score.exam === null || isNaN(Number(score.exam))) {
            missingSubjects.push(`${expSub.name} (Exam)`);
          }
        }
      }
    }

    if (missingSubjects.length > 0) {
      res.status(400).json({
        error: `Cannot complete result: Missing scores for subject(s): ${missingSubjects.slice(0, 5).join(', ')}${missingSubjects.length > 5 ? ' and more' : ''}`,
        missingSubjects,
      });
      return;
    }

    // Validation 2: Score range checks
    for (const score of finalScoresList) {
      const ca1 = Number(score.ca1);
      const ca2 = Number(score.ca2);
      const exam = Number(score.exam);

      if (ca1 < 0 || ca1 > ca1Max) {
        res.status(400).json({ error: `CA1 score for ${score.subjectName || 'subject'} must be between 0 and ${ca1Max}` });
        return;
      }
      if (ca2 < 0 || ca2 > ca2Max) {
        res.status(400).json({ error: `CA2 score for ${score.subjectName || 'subject'} must be between 0 and ${ca2Max}` });
        return;
      }
      if (performanceType === 'term') {
        if (exam < 0 || exam > examMax) {
          res.status(400).json({ error: `Exam score for ${score.subjectName || 'subject'} must be between 0 and ${examMax}` });
          return;
        }
      }
    }

    // Validation 3 & 4: For term results, Affective and Psychomotor domain assessments
    const finalAffective = affectiveDomain !== undefined ? affectiveDomain : (existingResult?.affectiveDomain || []);
    const finalPsychomotor = psychomotorSkills !== undefined ? psychomotorSkills : (existingResult?.psychomotorSkills || []);

    if (performanceType === 'term') {
      if (!finalAffective || finalAffective.length === 0) {
        res.status(400).json({ error: 'Cannot complete result: Affective domain assessments are required for Full Term.' });
        return;
      }
      const invalidAffective = finalAffective.some((a: any) => !a.trait || Number(a.rating) < 1 || Number(a.rating) > 5);
      if (invalidAffective) {
        res.status(400).json({ error: 'All affective domain traits must be rated between 1 and 5.' });
        return;
      }

      if (!finalPsychomotor || finalPsychomotor.length === 0) {
        res.status(400).json({ error: 'Cannot complete result: Psychomotor skills assessments are required for Full Term.' });
        return;
      }
      const invalidPsychomotor = finalPsychomotor.some((p: any) => !p.trait || Number(p.rating) < 1 || Number(p.rating) > 5);
      if (invalidPsychomotor) {
        res.status(400).json({ error: 'All psychomotor skill traits must be rated between 1 and 5.' });
        return;
      }
    }

    // Validation 5: Teacher's comment
    const finalComment = teacherComment !== undefined ? teacherComment : (existingResult?.teacherComment || '');
    if (!finalComment || !finalComment.trim()) {
      res.status(400).json({ error: "Cannot complete result: Teacher's comment is required." });
      return;
    }

    // Process all subject scores
    const processedScores = finalScoresList.map((score: any) => {
      const ca1 = Number(score.ca1) || 0;
      const ca2 = Number(score.ca2) || 0;
      const exam = performanceType === 'term' ? (Number(score.exam) || 0) : 0;

      let total = 0;
      if (performanceType === 'mid-term') {
        if (midtermMax > 0 && midtermMax !== 100) {
          total = Math.round(((ca1 + ca2) / midtermMax) * 100);
        } else {
          total = ca1 + ca2;
        }
      } else {
        if (totalMax > 0 && totalMax !== 100) {
          total = Math.round(((ca1 + ca2 + exam) / totalMax) * 100);
        } else {
          total = ca1 + ca2 + exam;
        }
      }

      const grade = calculateGrade(total, gradeScale);

      return {
        subjectId: score.subjectId,
        subjectName: score.subjectName || 'Subject',
        ca1,
        ca2,
        exam,
        total: Math.round(total),
        grade,
        position: 0,
      };
    });

    const totalScore = processedScores.reduce((sum, s) => sum + s.total, 0);
    const totalAvailableMarks = processedScores.length * totalMax;
    const percentage = totalAvailableMarks > 0
      ? Number(((totalScore / totalAvailableMarks) * 100).toFixed(2))
      : 0;

    const attendanceSummary =
      performanceType === 'term' || !performanceType
        ? await calculateAttendanceSummary(req.user?.schoolId, studentId, daysOpen)
        : { daysOpen: 0, daysPresent: 0, daysAbsent: 0 };

    let result = existingResult;
    if (result) {
      result.subjectScores = processedScores;
      result.psychomotorSkills = performanceType === 'term' ? finalPsychomotor : [];
      result.affectiveDomain = performanceType === 'term' ? finalAffective : [];
      result.teacherComment = finalComment.trim();
      result.totalScore = Math.round(totalScore);
      result.totalAvailableMarks = totalAvailableMarks;
      result.percentage = percentage;
      result.averageScore = percentage;
      result.attendanceSummary = attendanceSummary;
      result.isCompleted = true;
      result.completedBy = req.user?.userId as any;
      result.completedAt = new Date();
      result.isApproved = false; // Reset approval so Head Teacher reviews before printing
      if (period?._id) result.periodId = period._id;
      if (session?._id) result.sessionId = session._id;
      await result.save();
    } else {
      result = new StudentResult({
        schoolId: req.user?.schoolId,
        periodId: period?._id || targetId,
        sessionId: session?._id || targetId,
        studentId,
        classId: student.classId,
        performanceType,
        subjectScores: processedScores,
        psychomotorSkills: performanceType === 'term' ? finalPsychomotor : [],
        affectiveDomain: performanceType === 'term' ? finalAffective : [],
        teacherComment: finalComment.trim(),
        totalScore: Math.round(totalScore),
        totalAvailableMarks,
        percentage,
        averageScore: percentage,
        attendanceSummary,
        isCompleted: true,
        completedBy: req.user?.userId,
        completedAt: new Date(),
        isApproved: false,
      });
      await result.save();
    }

    // Recalculate rankings for class
    await recalculateClassRankings(req.user?.schoolId, student.classId, targetId, performanceType);

    const updated = await StudentResult.findById(result._id)
      .populate('studentId')
      .populate('completedBy', 'name email');

    res.json({
      message: 'Result completed successfully!',
      result: updated,
      classPosition: updated?.classPosition,
      classAverage: updated?.classAverage,
      percentage: updated?.percentage,
    });
  } catch (error) {
    console.error('Complete student result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Reopen a completed result for editing (Admin only)
 */
export const reopenStudentResult = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { resultId, studentId, sessionId, periodId, performanceType = 'term' } = req.body;
    const targetId = periodId || sessionId;

    let filter: any = { schoolId: req.user?.schoolId };
    if (resultId) {
      filter._id = resultId;
    } else if (studentId && targetId) {
      filter = {
        ...filter,
        ...buildPeriodOrSessionFilter(targetId),
        studentId,
        performanceType,
      };
    } else {
      res.status(400).json({ error: 'Result ID or student ID and session ID are required' });
      return;
    }

    const result = await StudentResult.findOne(filter);
    if (!result) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    result.isCompleted = false;
    result.isApproved = false;
    result.reopenedBy = req.user?.userId as any;
    result.reopenedAt = new Date();
    result.classPosition = 0;
    await result.save();

    const classTarget = result.periodId?.toString() || result.sessionId?.toString() || targetId;
    if (result.classId && classTarget) {
      await recalculateClassRankings(req.user?.schoolId, result.classId, classTarget, result.performanceType);
    }

    res.json({
      message: 'Result reopened for editing. Completion will be required again after changes.',
      result,
    });
  } catch (error) {
    console.error('Reopen student result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Phase 2: Leaderboard endpoint
 * Returns ranked students in the class. Excludes incomplete results.
 * Respects teacher role (teacher can only view assigned classes).
 */
export const getClassLeaderboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, sessionId, periodId, performanceType = 'term' } = req.query;
    const targetId = (periodId || sessionId) as string;
    const pType = (performanceType as string) || 'term';

    if (!classId) {
      res.status(400).json({ error: 'Class ID is required' });
      return;
    }

    // Role check: Teachers can only view leaderboard for their assigned classes
    if (req.user?.role === 'teacher') {
      const isAssigned = (req.user.assignedClasses || []).some(
        (c: any) => c.toString() === classId.toString()
      );
      const teachesInClass = await SubjectRegistration.exists({
        schoolId: req.user.schoolId,
        classId: classId as any,
        assignedTeacherId: req.user.userId,
      });

      if (!isAssigned && !teachesInClass) {
        res.status(403).json({ error: 'Access denied: You are not authorized to view the leaderboard for this class' });
        return;
      }
    }

    // If no targetId provided, resolve active period
    let effectiveTargetId = targetId;
    if (!effectiveTargetId) {
      const school = await School.findById(req.user?.schoolId);
      effectiveTargetId = school?.activePeriodId?.toString() || school?.activeTermId?.toString() || '';
    }

    if (effectiveTargetId) {
      await recalculateClassRankings(req.user?.schoolId, classId, effectiveTargetId, pType);
    }

    const filter: any = {
      schoolId: req.user?.schoolId,
      classId,
      performanceType: pType,
      isCompleted: true,
    };

    if (effectiveTargetId) {
      Object.assign(filter, buildPeriodOrSessionFilter(effectiveTargetId));
    }

    const results = await StudentResult.find(filter)
      .populate('studentId', 'fullName admissionNo photoUrl gender')
      .sort({ classPosition: 1, percentage: -1 });

    const totalStudentsInClass = await Student.countDocuments(
      addSchoolFilter(req, { classId, status: 'active' })
    );

    const classAveragePercentage = results.length > 0 ? results[0].classAverage : 0;

    const leaderboard = results.map((r) => {
      const studentObj: any = r.studentId;
      return {
        resultId: r._id,
        position: r.classPosition,
        studentId: studentObj?._id,
        fullName: studentObj?.fullName || 'Unknown Student',
        admissionNo: studentObj?.admissionNo || 'N/A',
        gender: studentObj?.gender,
        photoUrl: studentObj?.photoUrl,
        totalScore: r.totalScore,
        totalAvailableMarks: r.totalAvailableMarks || 0,
        overallPercentage: r.percentage || r.averageScore,
        classAveragePercentage: r.classAverage,
        isCompleted: r.isCompleted,
        completedAt: r.completedAt,
        isApproved: r.isApproved,
      };
    });

    res.json({
      classId,
      performanceType: pType,
      totalStudentsInClass,
      completedStudentsCount: results.length,
      classAveragePercentage,
      leaderboard,
    });
  } catch (error) {
    console.error('Get class leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStudentTermResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, periodId, studentId } = req.query;
    const targetId = (periodId || sessionId) as string;

    if (!targetId || !studentId) {
      res.status(400).json({ error: 'Session/Period ID and student ID are required' });
      return;
    }

    const filter = addSchoolFilter(req, {
      ...buildPeriodOrSessionFilter(targetId),
      studentId,
      performanceType: 'term',
    });

    const results = await StudentResult.find(filter)
      .populate('periodId')
      .populate('sessionId')
      .sort({ createdAt: 1 });

    res.json(results);
  } catch (error) {
    console.error('Get student term results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const releaseResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, periodId, classId } = req.body;
    const targetId = periodId || sessionId;

    if (!targetId || !classId) {
      res.status(400).json({ error: 'Session/Period ID and class ID are required' });
      return;
    }

    const filter = addSchoolFilter(req, {
      ...buildPeriodOrSessionFilter(targetId),
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

export const getStudentAllResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    if (!studentId) {
      res.status(400).json({ error: 'Student ID is required' });
      return;
    }

    const filter = addSchoolFilter(req, { studentId });
    const results = await StudentResult.find(filter)
      .populate('periodId')
      .populate('sessionId')
      .populate('classId')
      .sort({ createdAt: -1 });

    res.json(results);
  } catch (error) {
    console.error('Get student all results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClassCompletionTracker = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, periodId, classId, performanceType } = req.query;
    const targetId = (periodId || sessionId) as string;
    const pType = (performanceType as string) || 'term';

    if (!targetId || !classId) {
      res.status(400).json({ error: 'Session/Period ID and class ID are required' });
      return;
    }

    // Get all active students in the class
    const students = await Student.find(
      addSchoolFilter(req, { classId, status: 'active' })
    ).sort({ fullName: 1 });

    // Get all subject registrations for this class / period
    const registrations = await SubjectRegistration.find(
      addSchoolFilter(req, {
        ...buildPeriodOrSessionFilter(targetId),
        classId,
      })
    );
    const totalExpectedSubjects = registrations.length;

    // Get all results entered for this class and period
    const results = await StudentResult.find(
      addSchoolFilter(req, {
        ...buildPeriodOrSessionFilter(targetId),
        classId,
        performanceType: pType,
      })
    );

    const resultsMap = new Map<string, any>();
    results.forEach((r) => resultsMap.set(r.studentId.toString(), r));

    let completedCount = 0;
    const studentStatusList = students.map((s) => {
      const resRecord = resultsMap.get(s._id.toString());
      const isComplete = Boolean(resRecord?.isCompleted);
      const isApproved = Boolean(resRecord?.isApproved);
      const hasTeacherComment = Boolean(resRecord?.teacherComment?.trim());
      const hasHeadTeacherComment = Boolean(resRecord?.headOfSchoolComment?.trim());
      let enteredCount = resRecord?.subjectScores?.length || 0;

      if (isComplete) completedCount++;

      return {
        studentId: s._id,
        fullName: s.fullName,
        admissionNo: s.admissionNo,
        isComplete,
        isApproved,
        hasTeacherComment,
        hasHeadTeacherComment,
        enteredCount,
        expectedCount: totalExpectedSubjects,
        totalScore: resRecord?.totalScore || 0,
        totalAvailableMarks: resRecord?.totalAvailableMarks || 0,
        percentage: resRecord?.percentage || resRecord?.averageScore || 0,
        averageScore: resRecord?.averageScore || 0,
        classPosition: resRecord?.classPosition || 0,
        classAverage: resRecord?.classAverage || 0,
        verificationCode: resRecord?.verificationCode || '',
        completedAt: resRecord?.completedAt,
        approvedAt: resRecord?.approvedAt,
      };
    });

    res.json({
      totalStudents: students.length,
      completedCount,
      pendingCount: Math.max(0, students.length - completedCount),
      completionPercentage:
        students.length > 0 ? Math.round((completedCount / students.length) * 100) : 0,
      students: studentStatusList,
    });
  } catch (error) {
    console.error('Get class completion tracker error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
