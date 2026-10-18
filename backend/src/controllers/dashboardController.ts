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
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let studentFilter = addSchoolFilter(req);
    let classFilter = addSchoolFilter(req);

    // If user is a teacher, filter by their assigned classes
    if (req.user?.role === 'teacher') {
      const teacher = await User.findById(req.user.userId);
      if (teacher && teacher.assignedClasses.length > 0) {
        studentFilter.classId = { $in: teacher.assignedClasses };
        classFilter._id = { $in: teacher.assignedClasses };
      } else {
        // Teacher with no assigned classes sees no data
        studentFilter.classId = { $in: [] };
        classFilter._id = { $in: [] };
      }
    }

    const totalStudents = await Student.countDocuments(studentFilter);
    const totalClasses = await ClassGroup.countDocuments(classFilter);

    let attendanceSummary = null;
    let feesSummary = null;

    // Only admins get attendance and fees summary
    if (req.user?.role === 'admin') {
      // Get today's attendance
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

      // Get current term fees summary (use school's active period if set, otherwise oldest)
      const school = await School.findById(req.user?.schoolId);
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

      if (currentPeriod) {
        const invoices = await FeeInvoice.find({
          schoolId: req.user?.schoolId,
          termId: (currentPeriod as any)._id.toString(),
        });

        // Filter payments by the invoices in this term to ensure accurate aggregation
        const invoiceIds = invoices.map((inv) => inv._id.toString());
        const payments = await FeePayment.find({
          schoolId: req.user?.schoolId,
          invoiceId: { $in: invoiceIds },
        });

        let totalExpected = 0;
        let totalCollected = 0;
        let totalOutstanding = 0;
        let totalCredit = 0;

        invoices.forEach((invoice) => {
          totalExpected += invoice.amountDue;
          const invoicePayments = payments.filter(
            (p) => p.invoiceId.toString() === invoice._id.toString()
          );
          const totalPaid = invoicePayments.reduce((sum, p) => sum + p.amountPaid, 0);
          totalCollected += totalPaid;

          // Add credit to total
          totalCredit += invoice.credit || 0;

          // Calculate remaining balance (floor at 0 to prevent negative)
          const remainingBalance = Math.max(0, invoice.amountDue - totalPaid);
          totalOutstanding += remainingBalance;
        });

        // Get session and term info for display
        const session = await Session.findById((currentPeriod as any).sessionId);
        const term = await Term.findById((currentPeriod as any).termId);

        feesSummary = {
          totalExpected,
          totalCollected,
          totalOutstanding,
          totalCredit,
          termName: `${session?.year || 'N/A'} - ${term?.name || 'N/A'}`,
        };
      }
    }

    res.json({
      totalStudents,
      totalClasses,
      attendanceSummary,
      feesSummary,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
