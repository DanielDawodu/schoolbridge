import { Response } from 'express';
import StudentResult from '../models/StudentResult';
import Student from '../models/Student';
import School from '../models/School';
import AcademicSession from '../models/AcademicSession';
import Period from '../models/Period';
import ClassGroup from '../models/ClassGroup';
import ClassLevel from '../models/ClassLevel';
import User from '../models/User';
import SubjectRegistration from '../models/SubjectRegistration';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

const buildPeriodOrSessionFilter = (targetId: string) => {
  return {
    $or: [{ periodId: targetId }, { sessionId: targetId }],
  };
};

export const generateReportCard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, periodId, studentId, performanceType } = req.query;
    let targetId = (periodId || sessionId) as string;

    const school = await School.findById(req.user?.schoolId);
    if (!targetId) {
      targetId = school?.activePeriodId?.toString() || school?.activeTermId?.toString() || '';
    }

    if (!targetId || !studentId) {
      res.status(400).json({ error: 'Session/Period ID and student ID are required' });
      return;
    }

    const pType = (performanceType as string) || 'term';

    // Get student result
    const resultFilter = addSchoolFilter(req, {
      ...buildPeriodOrSessionFilter(targetId),
      studentId,
      performanceType: pType,
    });

    const result = await StudentResult.findOne(resultFilter)
      .populate('studentId')
      .populate('classId')
      .populate('periodId')
      .populate('sessionId')
      .populate('completedBy', 'name role')
      .populate('approvedBy', 'name role');

    if (!result) {
      res.status(404).json({ error: 'Result not found for this student and period' });
      return;
    }

    // Get class info
    const classInfo = await ClassGroup.findById(result.classId).populate('classLevelId');

    // Get session info
    let session = await AcademicSession.findById(targetId);
    let periodObj = null;
    if (!session) {
      periodObj = await Period.findById(targetId).populate('sessionId').populate('termId');
      if (periodObj && periodObj.sessionId) {
        session = await AcademicSession.findById((periodObj.sessionId as any)._id || periodObj.sessionId);
      }
    } else {
      periodObj = await Period.findOne({ sessionId: session._id, schoolId: req.user?.schoolId }).populate('termId');
    }

    // Grade scale with descriptions
    const gradeScale = school?.gradeScale && school.gradeScale.length > 0
      ? school.gradeScale
      : [
          { min: 70, max: 100, grade: 'A', description: 'Excellent' },
          { min: 60, max: 69, grade: 'B', description: 'Very Good' },
          { min: 50, max: 59, grade: 'C', description: 'Good' },
          { min: 40, max: 49, grade: 'D', description: 'Fair' },
          { min: 0, max: 39, grade: 'F', description: 'Fail' },
        ];

    // For term results on final term, fetch previous term results for comparison
    let termComparison = null;
    const finalTermName = (session?.finalTerm || 'third').toLowerCase();
    const currentTermName = (session?.currentTerm || (periodObj?.termId as any)?.name || '').toLowerCase();
    const isFinalTerm = currentTermName === finalTermName || currentTermName === 'third' || currentTermName.includes('3rd');

    if (pType === 'term' && session && isFinalTerm) {
      const sessionPeriods = await Period.find({
        schoolId: req.user?.schoolId,
        sessionId: session._id,
      }).populate('termId');

      const targetPeriodIds = sessionPeriods.map((p) => p._id);

      const filter = addSchoolFilter(req, {
        $or: [
          { periodId: { $in: targetPeriodIds } },
          { sessionId: session._id },
          { _id: targetId },
        ],
        studentId,
        performanceType: 'term',
      });

      const allTermResults = await StudentResult.find(filter)
        .populate({ path: 'periodId', populate: { path: 'termId' } })
        .populate('sessionId');

      const termResults: { first: number; second: number; third: number } = {
        first: 0,
        second: 0,
        third: 0,
      };

      allTermResults.forEach((r: any) => {
        const termName = (r.periodId?.termId?.name || r.sessionId?.currentTerm || '').toLowerCase();
        const avg = r.percentage || r.averageScore || 0;
        if (termName.includes('1st') || termName.includes('first')) {
          termResults.first = avg;
        } else if (termName.includes('2nd') || termName.includes('second')) {
          termResults.second = avg;
        } else if (termName.includes('3rd') || termName.includes('third')) {
          termResults.third = avg;
        }
      });

      if (termResults.third === 0 && (result.percentage || result.averageScore)) {
        termResults.third = result.percentage || result.averageScore;
      }

      const termScores = [termResults.first, termResults.second, termResults.third].filter((s) => s > 0);
      const aggregate =
        termScores.length > 0
          ? Math.round(termScores.reduce((sum: number, s: number) => sum + s, 0) / termScores.length)
          : 0;

      termComparison = {
        firstTerm: termResults.first,
        secondTerm: termResults.second,
        thirdTerm: termResults.third,
        aggregate,
      };
    }

    const resultObj = result.toObject();
    if (resultObj.subjectScores) {
      resultObj.subjectScores = resultObj.subjectScores.map((score: any) => {
        const gradeItem = gradeScale.find((g: any) => g.grade === score.grade) || { description: '' };
        return {
          ...score,
          gradeDescription: gradeItem.description,
        };
      });
    }

    // Determine if printing is allowed:
    // "The Print Report button must remain disabled until:
    //  1. The teacher's result sheet is completed.
    //  2. The Head Teacher's/Principal's comment has been saved successfully."
    const canPrint = Boolean(result.isCompleted && result.isApproved && result.headOfSchoolComment?.trim());

    res.json({
      result: resultObj,
      canPrint,
      school: {
        name: school?.name,
        address: school?.address,
        signatureUrl: school?.signatureUrl,
      },
      classInfo: {
        name: (classInfo as any)?.classLevelId?.name || 'Unknown',
        arm: classInfo?.arm,
      },
      sessionInfo: {
        year: session?.year || (periodObj?.sessionId as any)?.year || 'N/A',
        term: session?.currentTerm || (periodObj?.termId as any)?.name || 'Term',
      },
      termComparison,
      gradeScale,
    });
  } catch (error) {
    console.error('Generate report card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Phase 3 Step 1: Get report cards status for all classes
 * Returns list of classes showing:
 * - Class name & arm
 * - Assigned teacher(s)
 * - Number of students
 * - Number of completed teacher result sheets
 * - Number of reports awaiting Head Teacher's/Principal's comments
 * - Number of approved reports
 */
export const getClassReportCardsStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, periodId, performanceType = 'term' } = req.query;
    let targetId = (periodId || sessionId) as string;

    const school = await School.findById(req.user?.schoolId);
    if (!targetId) {
      targetId = school?.activePeriodId?.toString() || school?.activeTermId?.toString() || '';
    }

    if (!targetId) {
      res.status(400).json({ error: 'No active academic period configured. Please configure an active period in Settings.' });
      return;
    }

    const classes = await ClassGroup.find({ schoolId: req.user?.schoolId })
      .populate('classLevelId', 'name')
      .sort({ createdAt: 1 });

    const teachers = await User.find({ schoolId: req.user?.schoolId, role: 'teacher' });

    const statusList = await Promise.all(
      classes.map(async (cls) => {
        const studentCount = await Student.countDocuments(
          addSchoolFilter(req, { classId: cls._id, status: 'active' })
        );

        // Find assigned teachers
        const assignedTeachers = teachers
          .filter((t) => (t.assignedClasses || []).some((c: any) => c.toString() === cls._id.toString()))
          .map((t) => t.name);

        // Find results in this class
        const results = await StudentResult.find(
          addSchoolFilter(req, {
            ...buildPeriodOrSessionFilter(targetId),
            classId: cls._id,
            performanceType,
          })
        );

        const completedCount = results.filter((r) => r.isCompleted).length;
        const awaitingHeadCommentCount = results.filter((r) => r.isCompleted && !r.isApproved).length;
        const approvedCount = results.filter((r) => r.isApproved).length;

        const classLevelName = (cls.classLevelId as any)?.name || 'Class';
        const fullClassName = `${classLevelName} - ${cls.arm}`;

        return {
          _id: cls._id,
          name: fullClassName,
          className: classLevelName,
          arm: cls.arm,
          assignedTeachers,
          studentCount,
          completedResultsCount: completedCount,
          awaitingHeadCommentCount,
          approvedCount,
        };
      })
    );

    res.json({
      targetId,
      classes: statusList,
    });
  } catch (error) {
    console.error('Get class report card status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Phase 3 Step 2: Get students for a selected class with report card progress
 * For each student, shows:
 * - Student name & admission number
 * - Teacher result completion status
 * - Head Teacher's comment status
 * - Report availability (Ready to Print / Pending Head Comment / Incomplete)
 */
export const getClassStudentsReportStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, sessionId, periodId, performanceType = 'term' } = req.query;
    let targetId = (periodId || sessionId) as string;

    if (!classId) {
      res.status(400).json({ error: 'Class ID is required' });
      return;
    }

    const school = await School.findById(req.user?.schoolId);
    if (!targetId) {
      targetId = school?.activePeriodId?.toString() || school?.activeTermId?.toString() || '';
    }

    if (!targetId) {
      res.status(400).json({ error: 'No active academic period configured.' });
      return;
    }

    const students = await Student.find(
      addSchoolFilter(req, { classId, status: 'active' })
    ).sort({ fullName: 1 });

    const results = await StudentResult.find(
      addSchoolFilter(req, {
        ...buildPeriodOrSessionFilter(targetId),
        classId,
        performanceType,
      })
    );

    const resultsMap = new Map<string, any>();
    results.forEach((r) => resultsMap.set(r.studentId.toString(), r));

    const studentList = students.map((s) => {
      const resRecord = resultsMap.get(s._id.toString());
      const isCompleted = Boolean(resRecord?.isCompleted);
      const isApproved = Boolean(resRecord?.isApproved && resRecord?.headOfSchoolComment?.trim());
      const hasTeacherComment = Boolean(resRecord?.teacherComment?.trim());
      const hasHeadComment = Boolean(resRecord?.headOfSchoolComment?.trim());

      let reportAvailability: 'ready' | 'awaiting_head_comment' | 'incomplete';
      if (isCompleted && isApproved) {
        reportAvailability = 'ready';
      } else if (isCompleted && !isApproved) {
        reportAvailability = 'awaiting_head_comment';
      } else {
        reportAvailability = 'incomplete';
      }

      return {
        studentId: s._id,
        fullName: s.fullName,
        admissionNo: s.admissionNo,
        gender: s.gender,
        resultId: resRecord?._id || null,
        isCompleted,
        isApproved,
        hasTeacherComment,
        hasHeadComment,
        headOfSchoolComment: resRecord?.headOfSchoolComment || '',
        teacherComment: resRecord?.teacherComment || '',
        overallPercentage: resRecord?.percentage || resRecord?.averageScore || 0,
        classPosition: resRecord?.classPosition || 0,
        classAverage: resRecord?.classAverage || 0,
        reportAvailability,
        completedAt: resRecord?.completedAt,
        approvedAt: resRecord?.approvedAt,
      };
    });

    res.json({
      classId,
      targetId,
      students: studentList,
    });
  } catch (error) {
    console.error('Get class students report status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClassReportCards = async (req: AuthRequest, res: Response): Promise<void> => {
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
      .sort({ 'studentId.fullName': 1 });

    const school = await School.findById(req.user?.schoolId);

    res.json({
      results,
      school: {
        name: school?.name,
        address: school?.address,
        signatureUrl: school?.signatureUrl,
      },
    });
  } catch (error) {
    console.error('Get class report cards error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
