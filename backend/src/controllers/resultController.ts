const currentUserIsAdmin = (req: AuthRequest) => req.user?.role === "admin";
import School from '../models/School';
import { Response } from 'express';
import StudentResult from '../models/StudentResult';
import Student from '../models/Student';
import Attendance from '../models/Attendance';
import AcademicSession from '../models/AcademicSession';
import Period from '../models/Period';
import Subject from '../models/Subject';
import SubjectRegistration from '../models/SubjectRegistration';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

// Default grade scale
const GRADE_SCALE = [
  { min: 70, max: 100, grade: 'A' },
  { min: 60, max: 69, grade: 'B' },
  { min: 50, max: 59, grade: 'C' },
  { min: 40, max: 49, grade: 'D' },
  { min: 0, max: 39, grade: 'F' },
];

const calculateGrade = (score: number, schoolGradeScale?: any[]): string => {
  const scale = schoolGradeScale && schoolGradeScale.length > 0 ? schoolGradeScale : GRADE_SCALE;
  for (const item of scale) {
    if (score >= item.min && score <= item.max) {
      return item.grade;
    }
  }
  return 'F';
};

const getSchoolAssessmentConfig = async (schoolId: any) => {
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

const resolvePeriodAndSession = async (targetId: string, schoolId?: any) => {
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

const buildPeriodOrSessionFilter = (targetId: string) => {
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

export const createOrUpdateResult = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, periodId, studentId, subjectScores, psychomotorSkills, affectiveDomain, teacherComment, performanceType = "term" } = req.body;
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
    const { sessionId, periodId, classId } = req.query;
    const targetId = (periodId || sessionId) as string;

    if (!targetId || !classId) {
      res.status(400).json({ error: 'Session/Period ID and class ID are required' });
      return;
    }

    const filter = addSchoolFilter(req, {
      ...buildPeriodOrSessionFilter(targetId),
      classId,
    });

    const results = await StudentResult.find(filter)
      .populate('studentId')
      .populate('classId')
      .populate('periodId')
      .populate('sessionId')
      .sort({ averageScore: -1 });

    const classAverage = results.length > 0
      ? results.reduce((sum, r) => sum + r.averageScore, 0) / results.length
      : 0;

    // Calculate class positions and average in memory for fast idempotent response
    const formattedResults = results.map((result, index) => {
      const obj = result.toObject();
      obj.classPosition = index + 1;
      obj.classAverage = Math.round(classAverage);
      return obj;
    });

    res.json(formattedResults);
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

    let result = await StudentResult.findOne({
      schoolId: req.user?.schoolId,
      ...buildPeriodOrSessionFilter(targetId),
      studentId,
      performanceType: performanceType || 'term',
    });

    // If teacher submitted, merge with existing scores so other teachers' entered scores are preserved
    let finalScores = processedScores;
    if (result && req.user?.role === 'teacher') {
      const submittedIds = new Set(processedScores.map((s: any) => s.subjectId.toString()));
      const otherScores = (result.subjectScores || []).filter(
        (s: any) => !submittedIds.has(s.subjectId.toString())
      );
      finalScores = [...otherScores, ...processedScores];
    }

    const totalScore = finalScores.reduce((sum, s) => sum + s.total, 0);
    const averageScore = finalScores.length > 0 ? totalScore / finalScores.length : 0;

    const attendanceSummary =
      performanceType === 'term' || !performanceType
        ? await calculateAttendanceSummary(req.user?.schoolId, studentId, daysOpen)
        : { daysOpen: 0, daysPresent: 0, daysAbsent: 0 };

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
        performanceType: performanceType || 'term',
        subjectScores: finalScores,
        psychomotorSkills: performanceType === 'term' || !performanceType ? psychomotorSkills || [] : [],
        affectiveDomain: performanceType === 'term' || !performanceType ? affectiveDomain || [] : [],
        teacherComment: teacherComment || '',
        headOfSchoolComment: currentUserIsAdmin(req) ? headOfSchoolComment || '' : '',
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
      let isComplete = false;
      let enteredCount = 0;

      if (resRecord && resRecord.subjectScores && resRecord.subjectScores.length > 0) {
        enteredCount = resRecord.subjectScores.length;
        isComplete = totalExpectedSubjects > 0 ? enteredCount >= totalExpectedSubjects : enteredCount > 0;
      }

      if (isComplete) completedCount++;

      return {
        studentId: s._id,
        fullName: s.fullName,
        admissionNo: s.admissionNo,
        isComplete,
        enteredCount,
        expectedCount: totalExpectedSubjects,
        averageScore: resRecord?.averageScore || 0,
        verificationCode: resRecord?.verificationCode || '',
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
