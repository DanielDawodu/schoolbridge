import { Response } from 'express';
import mongoose from 'mongoose';
import FeeInvoice, { generateInvoiceNumber, IInvoiceLineItem } from '../models/FeeInvoice';
import FeePayment, { generateReceiptNumber, generateVerificationCode } from '../models/FeePayment';
import { amountToWords } from '../utils/numberToWords';
import Student from '../models/Student';
import AcademicSession from '../models/AcademicSession';
import School from '../models/School';
import BillTemplate from '../models/BillTemplate';
import ClassGroup from '../models/ClassGroup';
import Period from '../models/Period';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';
import { logActivity } from '../models/AuditLog';

/**
 * Helper to resolve the active billing term/session for a school.
 */
export const resolveActiveBillingTerm = async (schoolId: any, customTermId?: string) => {
  const schoolIdVariants = [
    schoolId,
    schoolId?.toString(),
    ...(mongoose.Types.ObjectId.isValid(schoolId) ? [new mongoose.Types.ObjectId(schoolId)] : []),
  ];

  if (customTermId) {
    let term = await AcademicSession.findOne({ _id: customTermId, schoolId: { $in: schoolIdVariants } });
    if (!term) {
      const period = await Period.findOne({ _id: customTermId, schoolId: { $in: schoolIdVariants } })
        .populate('sessionId')
        .populate('termId');
      if (period) {
        term = await AcademicSession.findById((period.sessionId as any)?._id || period.sessionId);
        return {
          term,
          period,
          termId: period._id,
          sessionId: (period.sessionId as any)?._id || period.sessionId,
          name: `${(period.sessionId as any)?.year || term?.year || ''} - ${(period.termId as any)?.name || term?.currentTerm || ''}`.trim(),
        };
      }
    }
    if (term) {
      return { term, termId: term._id, sessionId: term._id, name: `${term.year} - ${term.currentTerm}` };
    }
  }

  const school = await School.findById(schoolId);
  let term: any = null;
  let period: any = null;

  if (school?.activePeriodId) {
    period = await Period.findOne({ _id: school.activePeriodId, schoolId: { $in: schoolIdVariants } })
      .populate('sessionId')
      .populate('termId');
    if (period) {
      if (period.sessionId) {
        term = await AcademicSession.findById((period.sessionId as any)._id || period.sessionId);
      }
      return {
        term,
        period,
        termId: period._id,
        sessionId: (period.sessionId as any)?._id || period.sessionId,
        name: `${(period.sessionId as any)?.year || term?.year || ''} - ${(period.termId as any)?.name || term?.currentTerm || 'Active Term'}`.trim(),
      };
    }
  }

  if (school?.activeTermId) {
    term = await AcademicSession.findOne({ _id: school.activeTermId, schoolId: { $in: schoolIdVariants } });
    if (term) {
      return { term, termId: term._id, sessionId: term._id, name: `${term.year} - ${term.currentTerm}` };
    }
  }

  term = await AcademicSession.findOne({ schoolId: { $in: schoolIdVariants } }).sort({ createdAt: -1 });
  if (term) {
    return { term, termId: term._id, sessionId: term._id, name: `${term.year} - ${term.currentTerm}` };
  }

  return { term: null, period: null, termId: null, sessionId: null, name: 'Active Term' };
};

/**
 * Helper to inspect a student's previous term financial records and calculate
 * the exact unpaid carryover balance. Prevents double-counting and ensures full traceability.
 */
export const calculateStudentCarryover = async (
  schoolId: any,
  studentId: any,
  activeTermId: any
): Promise<{ totalCarryover: number; sources: Array<{ invoiceId: any; termName: string; amount: number }> }> => {
  const previousInvoices = await FeeInvoice.find({
    schoolId,
    studentId,
    termId: { $ne: activeTermId },
    isCarriedForward: { $ne: true },
  }).populate('termId');

  let totalCarryover = 0;
  const sources: Array<{ invoiceId: any; termName: string; amount: number }> = [];

  for (const inv of previousInvoices) {
    const payments = await FeePayment.find({ invoiceId: inv._id });
    const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const unpaidBalance = Math.max(0, inv.amountDue - totalPaid);

    if (unpaidBalance > 0) {
      totalCarryover += unpaidBalance;
      const termObj: any = inv.termId;
      const termName = termObj ? `${termObj.year || ''} - ${termObj.currentTerm || ''}`.trim() : 'Previous Term';
      sources.push({
        invoiceId: inv._id,
        termName,
        amount: unpaidBalance,
      });
    }
  }

  return { totalCarryover, sources };
};

/**
 * Phase 4 Step 1: Get billing summary for all classes in active term
 */
export const getClassBillingSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { termId } = req.query;
    const activeTermInfo = await resolveActiveBillingTerm(req.user?.schoolId, termId as string);

    if (!activeTermInfo.termId) {
      res.status(400).json({ error: 'No active academic period configured. Please configure Settings first.' });
      return;
    }

    const classes = await ClassGroup.find({ schoolId: req.user?.schoolId })
      .populate('classLevelId', 'name')
      .sort({ createdAt: 1 });

    const teachers = await User.find({ schoolId: req.user?.schoolId, role: 'teacher' });

    const classSummaries = await Promise.all(
      classes.map(async (cls) => {
        const studentCount = await Student.countDocuments(
          addSchoolFilter(req, { classId: cls._id, status: 'active' })
        );

        const assignedTeachers = teachers
          .filter((t) => (t.assignedClasses || []).some((c: any) => c.toString() === cls._id.toString()))
          .map((t) => t.name);

        const invoices = await FeeInvoice.find({
          schoolId: req.user?.schoolId,
          classId: cls._id,
          termId: activeTermInfo.termId as any,
        });

        const invoiceIds = invoices.map((i) => i._id);
        const payments = await FeePayment.find({ invoiceId: { $in: invoiceIds } });

        const totalAmountDue = invoices.reduce((sum, i) => sum + i.amountDue, 0);
        const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
        const totalOutstanding = Math.max(0, totalAmountDue - totalPaid);

        let billingStatus: 'not_billed' | 'partial' | 'billed';
        if (invoices.length === 0) {
          billingStatus = 'not_billed';
        } else if (invoices.length < studentCount) {
          billingStatus = 'partial';
        } else {
          billingStatus = 'billed';
        }

        const classLevelName = (cls.classLevelId as any)?.name || 'Class';

        return {
          _id: cls._id,
          name: `${classLevelName} - ${cls.arm}`,
          className: classLevelName,
          arm: cls.arm,
          assignedTeachers,
          studentCount,
          billingStatus,
          invoicesCount: invoices.length,
          totalAmountDue,
          totalPaid,
          totalOutstanding,
        };
      })
    );

    res.json({
      activeTerm: activeTermInfo,
      classes: classSummaries,
    });
  } catch (error) {
    console.error('Get class billing summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Phase 4 Step 2: Preview class billing with automated carryover calculations
 */
export const getClassBillingPreview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, termId } = req.query;

    if (!classId) {
      res.status(400).json({ error: 'Class ID is required' });
      return;
    }

    const activeTermInfo = await resolveActiveBillingTerm(req.user?.schoolId, termId as string);
    if (!activeTermInfo.termId) {
      res.status(400).json({ error: 'No active academic period configured.' });
      return;
    }

    const classGroup = await ClassGroup.findById(classId).populate('classLevelId');
    if (!classGroup) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    const students = await Student.find(
      addSchoolFilter(req, { classId, status: 'active' })
    ).sort({ fullName: 1 });

    let totalCarryoverAcrossClass = 0;
    const studentPreview = await Promise.all(
      students.map(async (student) => {
        const carryoverInfo = await calculateStudentCarryover(
          req.user?.schoolId,
          student._id,
          activeTermInfo.termId
        );
        totalCarryoverAcrossClass += carryoverInfo.totalCarryover;

        return {
          studentId: student._id,
          fullName: student.fullName,
          admissionNo: student.admissionNo,
          gender: student.gender,
          previousTermCarryover: carryoverInfo.totalCarryover,
          carryoverSources: carryoverInfo.sources,
        };
      })
    );

    // Check if invoices already exist for this class & term
    const existingInvoices = await FeeInvoice.find({
      schoolId: req.user?.schoolId,
      classId: classId as any,
      termId: activeTermInfo.termId as any,
    });

    res.json({
      classId,
      className: `${(classGroup.classLevelId as any)?.name || 'Class'} - ${classGroup.arm}`,
      activeTerm: activeTermInfo,
      totalStudents: students.length,
      totalCarryoverAcrossClass,
      studentsWithCarryoverCount: studentPreview.filter((s) => s.previousTermCarryover > 0).length,
      existingInvoiceCount: existingInvoices.length,
      alreadyBilled: existingInvoices.length > 0,
      students: studentPreview,
    });
  } catch (error) {
    console.error('Get class billing preview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Phase 4 Step 3: Class-wide bill generation
 * Generates an individual student invoice for every eligible student in the selected class.
 * Applies tuition + additional charges + automated previous-term carryover.
 */
export const generateClassBill = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, termId, tuition, additionalCharges = [], dueDate, overwrite = false } = req.body;

    if (!classId) {
      res.status(400).json({ error: 'Class ID is required' });
      return;
    }

    const tuitionAmount = Number(tuition);
    if (isNaN(tuitionAmount) || tuitionAmount < 0) {
      res.status(400).json({ error: 'Tuition must be a valid non-negative number' });
      return;
    }

    // Validate additional charges
    for (const charge of additionalCharges) {
      if (!charge.name || !charge.name.trim()) {
        res.status(400).json({ error: 'Each additional charge must have a description/service name' });
        return;
      }
      const chargeAmount = Number(charge.amount);
      if (isNaN(chargeAmount) || chargeAmount < 0) {
        res.status(400).json({ error: `Amount for ${charge.name} must be a valid non-negative number` });
        return;
      }
    }

    const activeTermInfo = await resolveActiveBillingTerm(req.user?.schoolId, termId as string);
    if (!activeTermInfo.termId) {
      res.status(400).json({ error: 'No active academic period configured.' });
      return;
    }

    const classGroup = await ClassGroup.findById(classId);
    if (!classGroup) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    // Check if invoices already exist for this class & term
    const existingInvoices = await FeeInvoice.find({
      schoolId: req.user?.schoolId,
      classId: classId as any,
      termId: activeTermInfo.termId as any,
    });

    if (existingInvoices.length > 0 && !overwrite) {
      res.status(409).json({
        error: 'A bill already exists for this class in the active term. Please review or confirm you wish to revise the existing bill.',
        existingCount: existingInvoices.length,
      });
      return;
    }

    // If overwrite is confirmed, clean up existing invoices safely:
    if (existingInvoices.length > 0 && overwrite) {
      for (const inv of existingInvoices) {
        // Revert any carryover flags on prior invoices linked to this invoice
        await FeeInvoice.updateMany(
          { carriedForwardTo: inv._id },
          { isCarriedForward: false, $unset: { carriedForwardTo: 1 } }
        );
        // Delete payments on this active invoice
        await FeePayment.deleteMany({ invoiceId: inv._id });
        await FeeInvoice.deleteOne({ _id: inv._id });
      }
    }

    // Fetch active students in the class
    const students = await Student.find(
      addSchoolFilter(req, { classId, status: 'active' })
    ).sort({ fullName: 1 });

    if (students.length === 0) {
      res.status(400).json({ error: 'No active students found in this class to bill.' });
      return;
    }

    const billDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const additionalSum = additionalCharges.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
    const currentTermCharges = tuitionAmount + additionalSum;

    let totalExpectedForClass = 0;
    let totalCarryoverForClass = 0;
    const createdInvoices: any[] = [];

    for (const student of students) {
      // 1. Calculate previous term carryover
      const carryoverInfo = await calculateStudentCarryover(
        req.user?.schoolId,
        student._id,
        activeTermInfo.termId
      );

      totalCarryoverForClass += carryoverInfo.totalCarryover;

      // 2. Build itemized charge list
      const lineItems: IInvoiceLineItem[] = [
        { name: 'Tuition', amount: tuitionAmount, isTuition: true },
        ...additionalCharges.map((c: any) => ({
          name: c.name.trim(),
          amount: Number(c.amount),
          note: c.note ? c.note.trim() : undefined,
        })),
      ];

      if (carryoverInfo.totalCarryover > 0) {
        lineItems.push({
          name: 'Previous Term Outstanding Balance (Carryover)',
          amount: carryoverInfo.totalCarryover,
          isCarryover: true,
        });
      }

      const totalPayable = currentTermCharges + carryoverInfo.totalCarryover;
      totalExpectedForClass += totalPayable;

      // 3. Create invoice with unique invoice number
      const invoice = new FeeInvoice({
        schoolId: req.user?.schoolId,
        studentId: student._id,
        classId,
        termId: activeTermInfo.termId,
        invoiceNumber: generateInvoiceNumber(),
        lineItems,
        currentTermCharges,
        previousTermCarryover: carryoverInfo.totalCarryover,
        amountDue: totalPayable,
        dueDate: billDueDate,
        status: 'unpaid',
        carriedForwardFrom: carryoverInfo.sources,
      });

      await invoice.save();

      // 4. Mark prior unpaid invoices as carried forward to this new invoice
      for (const src of carryoverInfo.sources) {
        await FeeInvoice.findByIdAndUpdate(src.invoiceId, {
          isCarriedForward: true,
          carriedForwardTo: invoice._id,
        });
      }

      createdInvoices.push(invoice);
    }

    await logActivity(
      req,
      'GENERATE_CLASS_BILL',
      'finance_billing',
      classId as string,
      {
        invoicesCount: createdInvoices.length,
        currentTermChargesPerStudent: currentTermCharges,
        totalExpectedAmountForClass: totalExpectedForClass,
        totalCarryoverAcrossClass: totalCarryoverForClass,
      }
    );

    res.status(201).json({
      message: `Successfully generated ${createdInvoices.length} invoices for the class`,
      invoicesCount: createdInvoices.length,
      currentTermChargesPerStudent: currentTermCharges,
      totalCarryoverAcrossClass: totalCarryoverForClass,
      totalExpectedAmountForClass: totalExpectedForClass,
      invoices: createdInvoices,
    });
  } catch (error) {
    console.error('Generate class bill error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Phase 4 Step 4: Get student invoice list for a class in active term
 */
export const getClassInvoices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, termId } = req.query;

    if (!classId) {
      res.status(400).json({ error: 'Class ID is required' });
      return;
    }

    const activeTermInfo = await resolveActiveBillingTerm(req.user?.schoolId, termId as string);
    if (!activeTermInfo.termId) {
      res.status(400).json({ error: 'No active academic period configured.' });
      return;
    }

    const invoices = await FeeInvoice.find({
      schoolId: req.user?.schoolId,
      classId: classId as any,
      termId: activeTermInfo.termId as any,
    }).populate('studentId', 'fullName admissionNo gender photoUrl');

    const invoiceIds = invoices.map((i: any) => i._id);
    const payments = await FeePayment.find({ invoiceId: { $in: invoiceIds } });

    const formattedList = invoices.map((inv: any) => {
      const invPayments = payments.filter((p: any) => p.invoiceId.toString() === inv._id.toString());
      const totalPaid = invPayments.reduce((sum: number, p: any) => sum + p.amountPaid, 0);
      const remainingBalance = Math.max(0, inv.amountDue - totalPaid);

      const studentObj: any = inv.studentId;

      return {
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber || `INV-${inv._id.toString().slice(-6).toUpperCase()}`,
        studentId: studentObj?._id,
        fullName: studentObj?.fullName || 'Unknown Student',
        admissionNo: studentObj?.admissionNo || 'N/A',
        gender: studentObj?.gender,
        photoUrl: studentObj?.photoUrl,
        currentTermCharges: inv.currentTermCharges || 0,
        previousTermCarryover: inv.previousTermCarryover || 0,
        amountDue: inv.amountDue,
        amountPaid: totalPaid,
        remainingBalance,
        status: inv.status,
        dueDate: inv.dueDate,
        lineItems: inv.lineItems || [],
        createdAt: inv.createdAt,
      };
    });

    res.json({
      classId,
      activeTerm: activeTermInfo,
      invoices: formattedList,
    });
  } catch (error) {
    console.error('Get class invoices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Phase 4 Step 5: Get single invoice detail with full breakdown for viewing & printing
 */
export const getInvoiceDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { invoiceId } = req.params;

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId: req.user?.schoolId })
      .populate('studentId')
      .populate('classId')
      .populate('termId');

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const payments = await FeePayment.find({
      schoolId: req.user?.schoolId,
      invoiceId,
    })
      .populate('recordedBy', 'name role')
      .sort({ paidAt: -1 });

    const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const remainingBalance = Math.max(0, invoice.amountDue - totalPaid);

    const school = await School.findById(req.user?.schoolId);
    const classInfo = await ClassGroup.findById(invoice.classId).populate('classLevelId');

    res.json({
      invoice,
      school: {
        name: school?.name,
        address: school?.address,
        signatureUrl: school?.signatureUrl,
      },
      classInfo: {
        name: (classInfo as any)?.classLevelId?.name || 'Class',
        arm: classInfo?.arm || '',
      },
      payments,
      totalPaid,
      remainingBalance,
    });
  } catch (error) {
    console.error('Get invoice detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, termId, amountDue, dueDate } = req.body;

    if (!studentId || !termId || !amountDue || !dueDate) {
      res.status(400).json({ error: 'Student ID, term ID, amount due, and due date are required' });
      return;
    }

    const student = await Student.findOne({ _id: studentId, schoolId: req.user?.schoolId });
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const term = await AcademicSession.findOne({ _id: termId, schoolId: req.user?.schoolId });
    if (!term) {
      res.status(404).json({ error: 'Academic session not found' });
      return;
    }

    const invoice = new FeeInvoice({
      schoolId: req.user?.schoolId,
      studentId,
      classId: student.classId,
      termId,
      amountDue,
      currentTermCharges: amountDue,
      previousTermCarryover: 0,
      dueDate: new Date(dueDate),
    });

    await invoice.save();
    res.status(201).json(invoice);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const recordPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { invoiceId, amountPaid, paymentMethod = 'cash', referenceNumber, paidAt, note } = req.body;

    if (!invoiceId || !amountPaid) {
      res.status(400).json({ error: 'Invoice ID and amount paid are required' });
      return;
    }

    const numAmount = Number(amountPaid);
    if (isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Amount paid must be greater than zero' });
      return;
    }

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId: req.user?.schoolId })
      .populate('studentId')
      .populate('classId')
      .populate('termId');

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // Previous valid payments on this invoice
    const priorPayments = await FeePayment.find({ invoiceId, status: { $ne: 'reversed' } });
    const currentTotalPaid = priorPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const previousBalance = Math.max(0, invoice.amountDue - currentTotalPaid);

    let receiptNumber = generateReceiptNumber();
    let rExists = await FeePayment.findOne({ receiptNumber });
    let attempts = 0;
    while (rExists && attempts < 5) {
      receiptNumber = generateReceiptNumber();
      rExists = await FeePayment.findOne({ receiptNumber });
      attempts++;
    }

    let verificationCode = generateVerificationCode();
    let vExists = await FeePayment.findOne({ verificationCode });
    attempts = 0;
    while (vExists && attempts < 5) {
      verificationCode = generateVerificationCode();
      vExists = await FeePayment.findOne({ verificationCode });
      attempts++;
    }

    const words = amountToWords(numAmount);
    const newTotalPaid = currentTotalPaid + numAmount;
    const remainingBalance = Math.max(0, invoice.amountDue - newTotalPaid);

    const paymentDate = paidAt ? new Date(paidAt) : new Date();

    const payment = new FeePayment({
      schoolId: req.user?.schoolId,
      invoiceId,
      studentId: invoice.studentId,
      receiptNumber,
      verificationCode,
      amountPaid: numAmount,
      amountInWords: words,
      paymentMethod,
      referenceNumber: referenceNumber ? referenceNumber.trim() : undefined,
      previousBalance,
      remainingBalance,
      paidAt: paymentDate,
      recordedBy: req.user?.userId,
      status: 'valid',
      note: note ? note.trim() : undefined,
    });

    await payment.save();

    // Overpayment handling
    const overpayment = newTotalPaid - invoice.amountDue;
    if (overpayment > 0) {
      invoice.credit = overpayment;
    } else {
      invoice.credit = 0;
    }

    if (newTotalPaid >= invoice.amountDue) {
      invoice.status = 'paid';
    } else if (newTotalPaid > 0) {
      invoice.status = 'partial';
    } else {
      invoice.status = 'unpaid';
    }

    await invoice.save();

    const school = await School.findById(req.user?.schoolId);
    const recordedByUser = await User.findById(req.user?.userId);
    const studentObj: any = invoice.studentId;
    const classObj: any = invoice.classId;

    let className = 'Class';
    if (classObj) {
      const fullClass = await ClassGroup.findById(classObj._id || classObj).populate('classLevelId');
      className = `${(fullClass?.classLevelId as any)?.name || 'Class'} - ${fullClass?.arm || ''}`.trim();
    }

    const receipt = {
      _id: payment._id,
      receiptNumber: payment.receiptNumber,
      verificationCode: payment.verificationCode,
      paidAt: payment.paidAt,
      amountPaid: payment.amountPaid,
      amountInWords: payment.amountInWords,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      previousBalance: payment.previousBalance,
      remainingBalance: payment.remainingBalance,
      status: payment.status,
      note: payment.note,
      student: {
        _id: studentObj?._id,
        fullName: studentObj?.fullName || 'Student',
        admissionNo: studentObj?.admissionNo || 'N/A',
      },
      className,
      termName: (invoice.termId as any)?.year
        ? `${(invoice.termId as any).year} - ${(invoice.termId as any).currentTerm}`
        : 'Active Term',
      school: {
        name: school?.name || 'School',
        address: school?.address || '',
        signatureUrl: school?.signatureUrl,
      },
      cashier: (recordedByUser as any)?.fullName || recordedByUser?.name || 'Authorized Cashier',
    };

    await logActivity(
      req,
      'RECORD_PAYMENT',
      'finance_payment',
      payment._id.toString(),
      {
        receiptNumber: payment.receiptNumber,
        invoiceId: invoice._id.toString(),
        studentId: invoice.studentId?.toString(),
        amountPaid: numAmount,
        paymentMethod,
        remainingBalance,
      }
    );

    res.json({
      payment,
      invoice,
      receipt,
      totalPaid: newTotalPaid,
      remainingBalance,
      credit: invoice.credit,
    });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStudentFees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;

    const invoices = await FeeInvoice.find({
      schoolId: req.user?.schoolId,
      studentId,
    })
      .populate('studentId')
      .populate('billTemplateId')
      .populate('termId')
      .sort({ createdAt: -1 });

    const invoiceIds = invoices.map((i) => i._id);
    const payments = await FeePayment.find({
      schoolId: req.user?.schoolId,
      invoiceId: { $in: invoiceIds },
    }).populate('recordedBy', 'name role');

    res.json({
      invoices,
      payments,
    });
  } catch (error) {
    console.error('Get student fees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFeesDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { termId } = req.query;
    const activeTermInfo = await resolveActiveBillingTerm(req.user?.schoolId, termId as string);

    if (!activeTermInfo.termId) {
      res.status(404).json({ error: 'No academic session found' });
      return;
    }

    const invoices = await FeeInvoice.find({
      schoolId: req.user?.schoolId,
      termId: activeTermInfo.termId,
    }).populate('studentId');

    const invoiceIds = invoices.map((inv) => inv._id.toString());
    const payments = await FeePayment.find({
      schoolId: req.user?.schoolId,
      invoiceId: { $in: invoiceIds },
    });

    let totalExpected = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalCredit = 0;
    let totalCarryover = 0;
    const outstandingBalances: any[] = [];

    invoices.forEach((invoice) => {
      totalExpected += invoice.amountDue;
      totalCarryover += invoice.previousTermCarryover || 0;

      const invoicePayments = payments.filter((p) => p.invoiceId.toString() === invoice._id.toString());
      const totalPaid = invoicePayments.reduce((sum, p) => sum + p.amountPaid, 0);
      totalCollected += totalPaid;

      totalCredit += invoice.credit || 0;

      const remainingBalance = Math.max(0, invoice.amountDue - totalPaid);

      if (remainingBalance > 0 || (invoice.credit || 0) > 0) {
        if (remainingBalance > 0) {
          totalOutstanding += remainingBalance;
        }
        outstandingBalances.push({
          student: invoice.studentId,
          invoiceId: invoice._id,
          amountDue: invoice.amountDue,
          amountPaid: totalPaid,
          remainingBalance,
          status: invoice.status,
          credit: invoice.credit || 0,
        });
      }
    });

    res.json({
      termId: activeTermInfo.termId.toString(),
      termName: activeTermInfo.name,
      totalBillsGenerated: invoices.length,
      totalExpected,
      totalCollected,
      totalOutstanding,
      totalCredit,
      totalCarryover,
      outstandingBalances,
    });
  } catch (error) {
    console.error('Get fees dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getInvoicePayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { invoiceId } = req.params;

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId: req.user?.schoolId });
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const payments = await FeePayment.find({
      schoolId: req.user?.schoolId,
      invoiceId,
    }).populate('recordedBy', 'name role');

    const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const remainingBalance = Math.max(0, invoice.amountDue - totalPaid);

    res.json({
      invoice,
      payments,
      totalPaid,
      remainingBalance,
      credit: invoice.credit || 0,
    });
  } catch (error) {
    console.error('Get invoice payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;

    const payment = await FeePayment.findOne({ _id: paymentId, schoolId: req.user?.schoolId });
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    const invoice = await FeeInvoice.findById(payment.invoiceId);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    await FeePayment.deleteOne({ _id: paymentId });

    const allPayments = await FeePayment.find({ invoiceId: payment.invoiceId });
    const totalPaid = allPayments.reduce((sum, p) => sum + p.amountPaid, 0);

    const overpayment = totalPaid - invoice.amountDue;
    if (overpayment > 0) {
      invoice.credit = overpayment;
    } else {
      invoice.credit = 0;
    }

    if (totalPaid >= invoice.amountDue) {
      invoice.status = 'paid';
    } else if (totalPaid > 0) {
      invoice.status = 'partial';
    } else {
      invoice.status = 'unpaid';
    }

    await invoice.save();

    res.json({ message: 'Payment deleted successfully', invoice });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { invoiceId } = req.params;

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId: req.user?.schoolId });
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // Revert carryover flags on previous invoices
    await FeeInvoice.updateMany(
      { carriedForwardTo: invoice._id },
      { isCarriedForward: false, $unset: { carriedForwardTo: 1 } }
    );

    await FeePayment.deleteMany({ invoiceId });
    await FeeInvoice.deleteOne({ _id: invoiceId });

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Bill Template Functions
export const createBillTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, termId, lineItems, appliesTo } = req.body;

    if (!name || !termId || !lineItems || !appliesTo) {
      res.status(400).json({ error: 'Name, term ID, line items, and applies to are required' });
      return;
    }

    const term = await AcademicSession.findOne({ _id: termId, schoolId: req.user?.schoolId });
    if (!term) {
      res.status(404).json({ error: 'Academic session not found' });
      return;
    }

    if (appliesTo.type === 'class') {
      const classGroup = await ClassGroup.findOne({ _id: appliesTo.classId, schoolId: req.user?.schoolId });
      if (!classGroup) {
        res.status(404).json({ error: 'Class not found' });
        return;
      }
    }

    const totalAmount = lineItems.reduce((sum: number, item: any) => sum + item.amount, 0);

    const template = new BillTemplate({
      schoolId: req.user?.schoolId,
      termId,
      name,
      lineItems,
      totalAmount,
      appliesTo,
    });

    await template.save();
    res.status(201).json(template);
  } catch (error) {
    console.error('Create bill template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBillTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const templates = await BillTemplate.find({ schoolId: req.user?.schoolId })
      .populate('termId')
      .populate('appliesTo.classId')
      .sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    console.error('Get bill templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBillTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const template = await BillTemplate.findOne({ _id: id, schoolId: req.user?.schoolId })
      .populate('termId')
      .populate('appliesTo.classId');

    if (!template) {
      res.status(404).json({ error: 'Bill template not found' });
      return;
    }

    res.json(template);
  } catch (error) {
    console.error('Get bill template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteBillTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const template = await BillTemplate.findOne({ _id: id, schoolId: req.user?.schoolId });

    if (!template) {
      res.status(404).json({ error: 'Bill template not found' });
      return;
    }

    await BillTemplate.deleteOne({ _id: id });
    res.json({ message: 'Bill template deleted successfully' });
  } catch (error) {
    console.error('Delete bill template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const applyBillTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { templateId } = req.params;

    const template = await BillTemplate.findOne({ _id: templateId, schoolId: req.user?.schoolId });
    if (!template) {
      res.status(404).json({ error: 'Bill template not found' });
      return;
    }

    let students;
    if (template.appliesTo.type === 'class') {
      students = await Student.find({
        schoolId: req.user?.schoolId,
        classId: template.appliesTo.classId,
        status: 'active',
      });
    } else {
      students = await Student.find({
        schoolId: req.user?.schoolId,
        status: 'active',
      });
    }

    if (!students || students.length === 0) {
      res.json({ message: 'No active students found in target', created: 0, skipped: 0 });
      return;
    }

    let created = 0;
    let skipped = 0;

    for (const student of students) {
      const existingInvoice = await FeeInvoice.findOne({
        schoolId: req.user?.schoolId,
        studentId: student._id,
        termId: template.termId,
        billTemplateId: template._id,
      });

      if (existingInvoice) {
        skipped++;
        continue;
      }

      const invoice = new FeeInvoice({
        schoolId: req.user?.schoolId,
        studentId: student._id,
        classId: student.classId,
        termId: template.termId,
        billTemplateId: template._id,
        amountDue: template.totalAmount,
        currentTermCharges: template.totalAmount,
        previousTermCarryover: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await invoice.save();
      created++;
    }

    res.json({
      message: `Created ${created} invoices, skipped ${skipped} (already billed)`,
      created,
      skipped,
    });
  } catch (error) {
    console.error('Apply bill template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


/**
 * Phase 6: Get receipt details for viewing and printing with QR and school branding
 */
export const getReceiptDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const payment = await FeePayment.findOne({ _id: paymentId, schoolId: req.user?.schoolId })
      .populate('studentId')
      .populate('recordedBy', 'name fullName email')
      .populate('invoiceId');

    if (!payment) {
      res.status(404).json({ error: 'Payment receipt not found' });
      return;
    }

    const school = await School.findById(req.user?.schoolId);
    const invoice: any = payment.invoiceId;

    let className = 'Class';
    let termName = 'Current Term';

    if (invoice) {
      if (invoice.classId) {
        const fullClass = await ClassGroup.findById(invoice.classId).populate('classLevelId');
        className = `${(fullClass?.classLevelId as any)?.name || 'Class'} - ${fullClass?.arm || ''}`.trim();
      }
      if (invoice.termId) {
        const term = await AcademicSession.findById(invoice.termId);
        if (term) termName = `${term.year} - ${term.currentTerm}`;
      }
    }

    const studentObj: any = payment.studentId;
    const recordedByObj: any = payment.recordedBy;

    res.json({
      receipt: {
        _id: payment._id,
        receiptNumber: payment.receiptNumber,
        verificationCode: payment.verificationCode,
        paidAt: payment.paidAt,
        amountPaid: payment.amountPaid,
        amountInWords: payment.amountInWords || amountToWords(payment.amountPaid),
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        previousBalance: payment.previousBalance,
        remainingBalance: payment.remainingBalance,
        status: payment.status,
        note: payment.note,
        student: {
          _id: studentObj?._id,
          fullName: studentObj?.fullName || 'Student',
          admissionNo: studentObj?.admissionNo || 'N/A',
        },
        className,
        termName,
        school: {
          name: school?.name || 'School',
          address: school?.address || '',
          signatureUrl: school?.signatureUrl,
        },
        cashier: (recordedByObj as any)?.fullName || recordedByObj?.name || 'Authorized Cashier',
      },
    });
  } catch (error) {
    console.error('Get receipt detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Phase 6: Public receipt verification endpoint (no authentication required)
 * Scanned from receipt QR code: /verify-receipt/:verificationCode
 */
export const verifyReceiptPublic = async (req: any, res: Response): Promise<void> => {
  try {
    const { verificationCode } = req.params;

    if (!verificationCode) {
      res.status(400).json({ isValid: false, error: 'Verification code is required' });
      return;
    }

    const payment = await FeePayment.findOne({ verificationCode })
      .populate('studentId', 'fullName admissionNo')
      .populate('schoolId', 'name address signatureUrl')
      .populate('recordedBy', 'name fullName')
      .populate('invoiceId');

    if (!payment) {
      res.status(404).json({
        isValid: false,
        error: 'Receipt verification failed. No official record matches this verification code.',
      });
      return;
    }

    const schoolObj: any = payment.schoolId;
    const studentObj: any = payment.studentId;
    const invoice: any = payment.invoiceId;

    let className = 'Class';
    let termName = 'Academic Term';

    if (invoice) {
      if (invoice.classId) {
        const fullClass = await ClassGroup.findById(invoice.classId).populate('classLevelId');
        className = `${(fullClass?.classLevelId as any)?.name || 'Class'} - ${fullClass?.arm || ''}`.trim();
      }
      if (invoice.termId) {
        const term = await AcademicSession.findById(invoice.termId);
        if (term) termName = `${term.year} - ${term.currentTerm}`;
      }
    }

    res.json({
      isValid: true,
      status: payment.status,
      receiptNumber: payment.receiptNumber,
      verificationCode: payment.verificationCode,
      paidAt: payment.paidAt,
      amountPaid: payment.amountPaid,
      amountInWords: payment.amountInWords || amountToWords(payment.amountPaid),
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      student: {
        fullName: studentObj?.fullName || 'N/A',
        admissionNo: studentObj?.admissionNo || 'N/A',
      },
      className,
      termName,
      school: {
        name: schoolObj?.name || 'School',
        address: schoolObj?.address || '',
      },
      cashier: (payment.recordedBy as any)?.fullName || (payment.recordedBy as any)?.name || 'Authorized Cashier',
      reversalReason: payment.reversalReason,
      reversedAt: payment.reversedAt,
    });
  } catch (error) {
    console.error('Verify receipt public error:', error);
    res.status(500).json({ isValid: false, error: 'Server error during verification' });
  }
};

/**
 * Phase 6: Reverse/void a payment with reason and audit trail
 */
export const reversePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ error: 'A justification/reason is required to reverse a payment.' });
      return;
    }

    const payment = await FeePayment.findOne({ _id: paymentId, schoolId: req.user?.schoolId });
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    if (payment.status === 'reversed') {
      res.status(400).json({ error: 'Payment has already been reversed' });
      return;
    }

    payment.status = 'reversed';
    payment.reversalReason = reason.trim();
    payment.reversedBy = req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined;
    payment.reversedAt = new Date();
    await payment.save();

    // Recalculate invoice total
    const invoice = await FeeInvoice.findById(payment.invoiceId);
    if (invoice) {
      const validPayments = await FeePayment.find({ invoiceId: invoice._id, status: { $ne: 'reversed' } });
      const totalPaid = validPayments.reduce((sum, p) => sum + p.amountPaid, 0);

      const overpayment = totalPaid - invoice.amountDue;
      invoice.credit = overpayment > 0 ? overpayment : 0;

      if (totalPaid >= invoice.amountDue) {
        invoice.status = 'paid';
      } else if (totalPaid > 0) {
        invoice.status = 'partial';
      } else {
        invoice.status = 'unpaid';
      }

      await invoice.save();
    }

    await logActivity(
      req,
      'REVERSE_PAYMENT',
      'finance_payment',
      payment._id.toString(),
      {
        receiptNumber: payment.receiptNumber,
        invoiceId: payment.invoiceId.toString(),
        amountReversed: payment.amountPaid,
        reason: payment.reversalReason,
      }
    );

    res.json({ message: 'Payment successfully reversed with audit trail preserved', payment });
  } catch (error) {
    console.error('Reverse payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Phase 7: Payment Reports: Fully Paid Students & Debtors List
 */
export const getClassPaymentReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, termId } = req.query;
    if (!classId) {
      res.status(400).json({ error: 'Class ID is required' });
      return;
    }

    const activeTermInfo = await resolveActiveBillingTerm(req.user?.schoolId, termId as string | undefined);
    if (!activeTermInfo.termId) {
      res.status(400).json({ error: 'No active academic period configured.' });
      return;
    }

    const classGroup = await ClassGroup.findById(classId).populate('classLevelId');
    if (!classGroup) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    const className = `${(classGroup.classLevelId as any)?.name || 'Class'} - ${classGroup.arm}`;

    const invoices = await FeeInvoice.find({
      schoolId: req.user?.schoolId,
      classId: classId as any,
      termId: activeTermInfo.termId,
    }).populate('studentId', 'fullName admissionNo gender status');

    const invoiceIds = invoices.map((i) => i._id);
    const payments = await FeePayment.find({
      invoiceId: { $in: invoiceIds },
      status: { $ne: 'reversed' },
    }).sort({ paidAt: 1 });

    const fullyPaidStudents: any[] = [];
    const debtorsList: any[] = [];

    let totalBilledClass = 0;
    let totalCollectedClass = 0;
    let totalOutstandingClass = 0;

    for (const inv of invoices as any[]) {
      const student: any = inv.studentId;
      if (!student) continue;

      const invPayments = payments.filter((p) => p.invoiceId.toString() === inv._id.toString());
      const totalPaid = invPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      const remainingBalance = Math.max(0, inv.amountDue - totalPaid);

      totalBilledClass += inv.amountDue;
      totalCollectedClass += totalPaid;
      totalOutstandingClass += remainingBalance;

      const lastPayment = invPayments[invPayments.length - 1];

      if (remainingBalance === 0 && inv.amountDue > 0) {
        fullyPaidStudents.push({
          studentId: student._id,
          fullName: student.fullName,
          admissionNo: student.admissionNo,
          className,
          totalAmountBilled: inv.amountDue,
          totalAmountPaid: totalPaid,
          dateFullySettled: lastPayment ? lastPayment.paidAt : inv.updatedAt,
          invoiceNumber: inv.invoiceNumber,
        });
      } else {
        debtorsList.push({
          studentId: student._id,
          fullName: student.fullName,
          admissionNo: student.admissionNo,
          className,
          totalBill: inv.amountDue,
          amountPaid: totalPaid,
          outstandingAmount: remainingBalance,
          paymentStatus: totalPaid > 0 ? 'Part Payment' : 'Unpaid',
          dueDate: inv.dueDate,
          invoiceNumber: inv.invoiceNumber,
        });
      }
    }

    const school = await School.findById(req.user?.schoolId);

    res.json({
      classId,
      className,
      activeTerm: activeTermInfo,
      school: {
        name: school?.name,
        address: school?.address,
      },
      summary: {
        totalStudents: invoices.length,
        fullyPaidCount: fullyPaidStudents.length,
        debtorCount: debtorsList.length,
        totalBilledClass,
        totalCollectedClass,
        totalOutstandingClass,
      },
      fullyPaidStudents,
      debtorsList,
    });
  } catch (error) {
    console.error('Get class payment reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};