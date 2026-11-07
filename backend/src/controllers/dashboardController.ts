import { Response } from 'express';
import mongoose from 'mongoose';
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
import Subject from '../models/Subject';
import AcademicSession from '../models/AcademicSession';
import StudentResult from '../models/StudentResult';
import SubjectRegistration from '../models/SubjectRegistration';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';
import { resolveActiveBillingTerm } from './feesController';

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
    let onboardingChecklist: any = null;

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

    // Fees summary using the unified active billing term resolution
    const activeTermInfo = await resolveActiveBillingTerm(req.user?.schoolId);

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

      let termIds: any[] = [];
      if (activeTermInfo && activeTermInfo.termId) {
        termIds.push(activeTermInfo.termId);
      }
      if (school?.activePeriodId) {
        termIds.push(school.activePeriodId);
      }
      if (school?.activeTermId) {
        termIds.push(school.activeTermId);
      }
      if (activeTermInfo?.period?.sessionId) {
        termIds.push(activeTermInfo.period.sessionId);
      }
      // Also look up any Period belonging to this school that is active
      const activePeriods = await Period.find({ schoolId: req.user?.schoolId, isActive: true });
      for (const p of activePeriods) {
        termIds.push(p._id);
        if (p.sessionId) termIds.push(p.sessionId);
      }
      const uniqueTermIds = Array.from(new Set(termIds.map((id) => id.toString()))).map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      const invoices: any[] = await FeeInvoice.find({
        schoolId: req.user?.schoolId,
        termId: { $in: uniqueTermIds },
      });

      const invoiceObjectIds = invoices.map((inv: any) => inv._id);
      const payments = await FeePayment.find({
        schoolId: req.user?.schoolId,
        invoiceId: { $in: invoiceObjectIds },
        status: { $ne: 'reversed' },
      });

      let totalExpected = 0;
      let totalCollected = 0;
      let totalCarryover = 0;
      let totalCredit = 0;

      invoices.forEach((invoice: any) => {
        totalExpected += invoice.amountDue || 0;
        totalCarryover += invoice.previousTermCarryover || 0;
        totalCredit += invoice.credit || 0;
      });

      payments.forEach((payment: any) => {
        totalCollected += payment.amountPaid || 0;
      });

      const totalOutstanding = Math.max(0, totalExpected - totalCollected);

      feesSummary = {
        totalBillsGenerated: invoices.length,
        totalExpected,
        totalCollected,
        totalOutstanding,
        totalCredit,
        totalCarryover,
        termName: activeTermInfo?.name || 'Active Term',
      };
    }

    // Dynamic 9-Step Onboarding Checklist for Administrator
    if (req.user?.role === 'admin') {
      const isBrandingComplete = Boolean(
        school?.name &&
        school?.address &&
        (school?.phone || school?.email) &&
        school?.logoUrl
      );
      const isTermComplete = Boolean(school?.activePeriodId || school?.activeTermId || activeTermInfo?.termId);
      const classCount = await ClassGroup.countDocuments({ schoolId: req.user?.schoolId });
      const isClassesComplete = classCount > 0;
      const subjectCount = await Subject.countDocuments({ schoolId: req.user?.schoolId });
      const isSubjectsComplete = subjectCount > 0;
      const staffCount = await User.countDocuments({ schoolId: req.user?.schoolId });
      const isStaffComplete = staffCount > 1; // More than 1 staff registered
      const teacherAssignedCount = await User.countDocuments({
        schoolId: req.user?.schoolId,
        role: 'teacher',
        'assignedClasses.0': { $exists: true },
      });
      const subjectAssignedCount = await SubjectRegistration.countDocuments({
        schoolId: req.user?.schoolId,
        assignedTeacherId: { $exists: true },
      });
      const isTeacherAssignmentsComplete = teacherAssignedCount > 0 || subjectAssignedCount > 0;
      const studentCount = await Student.countDocuments({ schoolId: req.user?.schoolId });
      const isStudentsComplete = studentCount > 0;
      const isScoreLimitsComplete = Boolean(
        school?.assessmentConfig &&
        ((school.assessmentConfig.ca1Max ?? 0) > 0 ||
         (school.assessmentConfig.ca2Max ?? 0) > 0 ||
         school.assessmentConfig.midtermMax > 0 ||
         school.assessmentConfig.examMax > 0)
      );
      const isGradingComplete = Boolean(school?.gradeScale && school.gradeScale.length > 0);

      const checklist = [
        {
          id: 'branding',
          step: 1,
          title: 'School Profile & Branding',
          description: 'Set your school logo, official address, motto, and contact details.',
          isComplete: isBrandingComplete,
          route: '/settings/branding',
        },
        {
          id: 'session-term',
          step: 2,
          title: 'Academic Session & Term',
          description: 'Configure and activate the current academic session and term.',
          isComplete: isTermComplete,
          route: '/academic-periods',
        },
        {
          id: 'classes',
          step: 3,
          title: 'Class Groups & Levels',
          description: 'Create classes and arms (e.g., JSS 1A, SS 2 Science).',
          isComplete: isClassesComplete,
          route: '/classes',
        },
        {
          id: 'subjects',
          step: 4,
          title: 'Subjects & Class Assignments',
          description: 'Configure curriculum subjects and assign them to relevant classes.',
          isComplete: isSubjectsComplete,
          route: '/subjects',
        },
        {
          id: 'staff',
          step: 5,
          title: 'Staff Registration',
          description: 'Add teachers, accountants, and administrators to your school portal.',
          isComplete: isStaffComplete,
          route: '/staff',
        },
        {
          id: 'teacher-assignment',
          step: 6,
          title: 'Teacher Assignments',
          description: 'Assign teachers to their designated classes and subjects.',
          isComplete: isTeacherAssignmentsComplete,
          route: '/staff',
        },
        {
          id: 'students',
          step: 7,
          title: 'Student Enrollment',
          description: 'Enroll students into classes and assign streams or admission numbers.',
          isComplete: isStudentsComplete,
          route: '/students',
        },
        {
          id: 'score-limits',
          step: 8,
          title: 'Score Limits & Assessment Rules',
          description: 'Set maximum marks for Continuous Assessment (CA) and Exams.',
          isComplete: isScoreLimitsComplete,
          route: '/settings/score-limits',
        },
        {
          id: 'grading',
          step: 9,
          title: 'School Grading System',
          description: 'Review and customize the grade scales, thresholds, and remarks.',
          isComplete: isGradingComplete,
          route: '/settings/grading',
        },
      ];

      const completedCount = checklist.filter((item) => item.isComplete).length;
      onboardingChecklist = {
        totalSteps: 9,
        completedCount,
        progressPercentage: Math.round((completedCount / 9) * 100),
        isAllComplete: completedCount === 9,
        steps: checklist,
      };
    }

    res.json({
      totalStudents,
      totalClasses,
      attendanceSummary,
      feesSummary,
      academicStats,
      adminAcademicStats,
      onboardingChecklist,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
