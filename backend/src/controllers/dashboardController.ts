import { Response } from 'express';
import Student from '../models/Student';
import ClassGroup from '../models/ClassGroup';
import User from '../models/User';
import Attendance from '../models/Attendance';
import FeeInvoice from '../models/FeeInvoice';
import FeePayment from '../models/FeePayment';
import Period from '../models/Period';
import Session from '../models/Session';
import Term from '../models/Term';
import School from '../models/School';
import AcademicSession from '../models/AcademicSession';
import StudentResult from '../models/StudentResult';
import SubjectRegistration from '../models/SubjectRegistration';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let studentFilter = addSchoolFilter(req);
    let classFilter = addSchoolFilter(req);

    const school = await School.findById(req.user?.schoolId);
    let activeTargetId = school?.activePeriodId?.toString() || school?.activeTermId?.toString() || '';

    // If user is a teacher, filter by their assigned classes
    let teacherAssignedClassIds: any[] = [];
    if (req.user?.role === 'teacher') {
      const teacher = await User.findById(req.user.userId);
      const assigned = teacher?.assignedClasses || [];
      const taughtRegistrations = await SubjectRegistration.find({
        schoolId: req.user.schoolId,
        assignedTeacherId: req.user.userId,
      });
      const taughtClassIds = taughtRegistrations.map((r) => r.classId);

      const combinedIds = Array.from(
        new Set([...assigned.map((id: any) => id.toString()), ...taughtClassIds.map((id: any) => id.toString())])
      );
      teacherAssignedClassIds = combinedIds;

      studentFilter.classId = { $in: combinedIds };
      classFilter._id = { $in: combinedIds };
    }

    const totalStudents = await Student.countDocuments(studentFilter);
    const totalClasses = await ClassGroup.countDocuments(classFilter);

    let attendanceSummary = null;
    let feesSummary = null;
    let academicStats: any = null;

    // Academic Stats for Teachers
    if (req.user?.role === 'teacher') {
      const studentIds = (await Student.find(studentFilter).select('_id')).map((s) => s._id);

      const resultFilter: any = {
        schoolId: req.user.schoolId,
        studentId: { $in: studentIds },
      };
      if (activeTargetId) {
        resultFilter.$or = [{ periodId: activeTargetId }, { sessionId: activeTargetId }];
      }

      const results = await StudentResult.find(resultFilter).populate('studentId', 'fullName admissionNo photoUrl');

      const completedResults = results.filter((r) => r.isCompleted);
      const totalStudentsCount = studentIds.length;
      const completedCount = completedResults.length;
      const awaitingCount = Math.max(0, totalStudentsCount - completedCount);
      const completionPercentage = totalStudentsCount > 0 ? Math.round((completedCount / totalStudentsCount) * 100) : 0;

      const sumPercentages = completedResults.reduce((sum, r) => sum + (r.percentage || r.averageScore || 0), 0);
      const classAveragePercentage = completedResults.length > 0 ? Number((sumPercentages / completedResults.length).toFixed(1)) : 0;

      const sorted = [...completedResults].sort((a, b) => (a.classPosition || 999) - (b.classPosition || 999));
      const leaderboard = sorted.slice(0, 10).map((r) => ({
        position: r.classPosition,
        studentId: (r.studentId as any)?._id,
        fullName: (r.studentId as any)?.fullName || 'Student',
        admissionNo: (r.studentId as any)?.admissionNo || 'N/A',
        overallPercentage: r.percentage || r.averageScore || 0,
        classAveragePercentage: r.classAverage || classAveragePercentage,
        totalScore: r.totalScore,
      }));

      academicStats = {
        completionPercentage,
        completedCount,
        awaitingCount,
        classAveragePercentage,
        leaderboard,
      };
    }

    // Academic Stats & Fees for Admin / Accountant
    let adminAcademicStats: any = null;
    if (req.user?.role === 'admin') {
      const resultFilter: any = { schoolId: req.user.schoolId };
      if (activeTargetId) {
        resultFilter.$or = [{ periodId: activeTargetId }, { sessionId: activeTargetId }];
      }

      const allResults = await StudentResult.find(resultFilter).populate('studentId', 'fullName admissionNo classId');

      const reportsAwaitingHeadComment = allResults.filter((r) => r.isCompleted && !r.isApproved).length;
      const completedAndPrintableReports = allResults.filter((r) => r.isApproved).length;

      // Group completion by class
      const allClasses = await ClassGroup.find({ schoolId: req.user.schoolId }).populate('classLevelId', 'name');
      const classProgress = await Promise.all(
        allClasses.map(async (cls) => {
          const count = await Student.countDocuments(addSchoolFilter(req, { classId: cls._id, status: 'active' }));
          const clsResults = allResults.filter((r) => r.classId?.toString() === cls._id.toString() && r.isCompleted);
          return {
            classId: cls._id,
            className: `${(cls.classLevelId as any)?.name || 'Class'} - ${cls.arm}`,
            totalStudents: count,
            completedCount: clsResults.length,
            percentage: count > 0 ? Math.round((clsResults.length / count) * 100) : 0,
          };
        })
      );

      // Top school leaderboard
      const topResults = allResults
        .filter((r) => r.isCompleted)
        .sort((a, b) => (b.percentage || b.averageScore || 0) - (a.percentage || a.averageScore || 0))
        .slice(0, 10)
        .map((r, idx) => ({
          position: idx + 1,
          studentId: (r.studentId as any)?._id,
          fullName: (r.studentId as any)?.fullName || 'Student',
          admissionNo: (r.studentId as any)?.admissionNo || 'N/A',
          overallPercentage: r.percentage || r.averageScore || 0,
          totalScore: r.totalScore,
        }));

      adminAcademicStats = {
        reportsAwaitingHeadComment,
        completedAndPrintableReports,
        classProgress,
        topLeaderboard: topResults,
      };
    }

    // Attendance & Fees Summary for Admin & Accountant
    if (req.user?.role === 'admin' || req.user?.role === 'accountant') {
      if (req.user?.role === 'admin') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayAttendance = await Attendance.find({
          schoolId: req.user?.schoolId,
          date: today,
        });

        let present = 0;
        let absent = 0;
        let late = 0;
        let totalMarked = 0;

        todayAttendance.forEach((record) => {
          record.records.forEach((r) => {
            totalMarked++;
            if (r.status === 'present') present++;
            else if (r.status === 'absent') absent++;
            else if (r.status === 'late') late++;
          });
        });

        attendanceSummary = {
          present,
          absent,
          late,
          totalMarked,
        };
      }

      // Fees summary
      let currentPeriod = null;
      if (school?.activePeriodId) {
        currentPeriod = await Period.findOne({
          _id: school.activePeriodId,
          schoolId: req.user?.schoolId,
        });
      }

      if (!currentPeriod) {
        currentPeriod = await Period.findOne({
          schoolId: req.user?.schoolId,
        }).sort({ createdAt: 1 });
      }

      const possibleTermIds = [
        currentPeriod?._id,
        (currentPeriod as any)?.sessionId,
        school?.activeTermId,
        school?.activePeriodId,
      ].filter(Boolean) as any[];

      const invoices: any[] = await FeeInvoice.find({
        schoolId: req.user?.schoolId,
        termId: { $in: possibleTermIds },
      });

      const invoiceIds = invoices.map((inv: any) => inv._id.toString());
      const payments = await FeePayment.find({
        schoolId: req.user?.schoolId,
        invoiceId: { $in: invoiceIds },
      });

      let totalExpected = 0;
      let totalCollected = 0;
      let totalOutstanding = 0;
      let totalCredit = 0;
      let totalCarryover = 0;

      invoices.forEach((invoice: any) => {
        totalExpected += invoice.amountDue;
        totalCarryover += invoice.previousTermCarryover || 0;

        const invoicePayments = payments.filter(
          (p) => p.invoiceId.toString() === invoice._id.toString()
        );
        const totalPaid = invoicePayments.reduce((sum, p) => sum + p.amountPaid, 0);
        totalCollected += totalPaid;

        totalCredit += invoice.credit || 0;
        const remainingBalance = Math.max(0, invoice.amountDue - totalPaid);
        totalOutstanding += remainingBalance;
      });

      let session = null;
      let term = null;
      if (currentPeriod) {
        session = await Session.findById((currentPeriod as any).sessionId);
        term = await Term.findById((currentPeriod as any).termId);
      }

      feesSummary = {
        totalBillsGenerated: invoices.length,
        totalExpected,
        totalCollected,
        totalOutstanding,
        totalCredit,
        totalCarryover,
        termName: `${session?.year || 'Current'} - ${term?.name || 'Term'}`,
      };
    }

    res.json({
      totalStudents,
      totalClasses,
      attendanceSummary,
      feesSummary,
      academicStats,
      adminAcademicStats,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
