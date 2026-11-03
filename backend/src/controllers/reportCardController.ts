import { Response } from 'express';
import StudentResult from '../models/StudentResult';
import Student from '../models/Student';
import School from '../models/School';
import AcademicSession from '../models/AcademicSession';
import Period from '../models/Period';
import ClassGroup from '../models/ClassGroup';
import ClassLevel from '../models/ClassLevel';
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
    const targetId = (periodId || sessionId) as string;

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
      .populate('sessionId');

    if (!result) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    // Get school for signature
    const school = await School.findById(req.user?.schoolId);

    // Get class info
    const classInfo = await ClassGroup.findById(result.classId).populate('classLevelId');

    // Get session info
    let session = await AcademicSession.findById(targetId);
    if (!session) {
      const period = await Period.findById(targetId);
      if (period) {
        session = await AcademicSession.findById(period.sessionId);
      }
    }

    // Grade scale with descriptions
    const gradeScale = [
      { min: 70, max: 100, grade: 'A', description: 'Excellent' },
      { min: 60, max: 69, grade: 'B', description: 'Very Good' },
      { min: 50, max: 59, grade: 'C', description: 'Good' },
      { min: 40, max: 49, grade: 'D', description: 'Fair' },
      { min: 0, max: 39, grade: 'F', description: 'Fail' },
    ];

    // For term results on final term, fetch previous term results for comparison
    let termComparison = null;
    const finalTermName = (session?.finalTerm || 'third').toLowerCase();
    const currentTermName = (session?.currentTerm || '').toLowerCase();
    const isFinalTerm = currentTermName === finalTermName || currentTermName === 'third' || currentTermName.includes('3rd');

    if (pType === 'term' && session && isFinalTerm) {
      // Find all periods or sessions for this academic session
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

      // Map results by term
      const termResults: { first: number; second: number; third: number } = {
        first: 0,
        second: 0,
        third: 0,
      };

      allTermResults.forEach((r: any) => {
        const termName = (r.periodId?.termId?.name || r.sessionId?.currentTerm || '').toLowerCase();
        const avg = r.averageScore || 0;
        if (termName.includes('1st') || termName.includes('first')) {
          termResults.first = avg;
        } else if (termName.includes('2nd') || termName.includes('second')) {
          termResults.second = avg;
        } else if (termName.includes('3rd') || termName.includes('third')) {
          termResults.third = avg;
        }
      });

      if (termResults.third === 0 && result.averageScore) {
        termResults.third = result.averageScore;
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
        const gradeItem = gradeScale.find((g) => g.grade === score.grade) || { description: '' };
        return {
          ...score,
          gradeDescription: gradeItem.description,
        };
      });
    }

    res.json({
      result: resultObj,
      school: {
        name: school?.name,
        address: school?.address,
        signatureUrl: school?.signatureUrl,
      },
      classInfo: {
        name: (classInfo as any)?.classLevelId?.name || 'Unknown',
        arm: classInfo?.arm,
      },
      termComparison,
      gradeScale,
    });
  } catch (error) {
    console.error('Generate report card error:', error);
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

    // Get school for signature
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
