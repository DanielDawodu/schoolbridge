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

    // For term results on final term, fetch previous term results for comparison
    let termComparison = null;
    if (pType === 'term' && session && session.currentTerm === session.finalTerm) {
      // Get all term results for this student in this session
      const filter = addSchoolFilter(req, {
        ...buildPeriodOrSessionFilter(targetId),
        studentId,
        performanceType: 'term',
      });
      const allTermResults = await StudentResult.find(filter)
        .populate('periodId')
        .populate('sessionId');

      // Map results by term
      const termResults: Record<string, any> = {};
      allTermResults.forEach((r: any) => {
        const term = r.sessionId?.currentTerm || 'term';
        termResults[term] = r.averageScore;
      });

      // Calculate aggregate
      const termScores = Object.values(termResults).filter((s: any) => s > 0);
      const aggregate =
        termScores.length > 0
          ? Math.round(termScores.reduce((sum: number, s: any) => sum + s, 0) / termScores.length)
          : 0;

      termComparison = {
        firstTerm: termResults.first || 0,
        secondTerm: termResults.second || 0,
        thirdTerm: termResults.third || 0,
        aggregate,
      };
    }

    res.json({
      result,
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
