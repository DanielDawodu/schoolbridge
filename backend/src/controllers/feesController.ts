import { Response } from 'express';
import FeeInvoice from '../models/FeeInvoice';
import FeePayment from '../models/FeePayment';
import Student from '../models/Student';
import AcademicSession from '../models/AcademicSession';
import School from '../models/School';
import BillTemplate from '../models/BillTemplate';
import ClassGroup from '../models/ClassGroup';
import { AuthRequest } from '../middleware/auth';

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
      termId,
      amountDue,
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
    const { invoiceId, amountPaid, note } = req.body;

    if (!invoiceId || !amountPaid) {
      res.status(400).json({ error: 'Invoice ID and amount paid are required' });
      return;
    }

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId: req.user?.schoolId });
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const payment = new FeePayment({
      schoolId: req.user?.schoolId,
      invoiceId,
      studentId: invoice.studentId,
      amountPaid,
      recordedBy: req.user?.userId,
      note,
    });

    await payment.save();

    const allPayments = await FeePayment.find({ invoiceId });
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

    const remainingBalance = Math.max(0, invoice.amountDue - totalPaid);

    res.json({
      payment,
      invoice,
      totalPaid,
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
    }).populate('studentId')
      .populate('billTemplateId')
      .populate('termId');

    const payments = await FeePayment.find({
      schoolId: req.user?.schoolId,
      studentId,
    }).populate('recordedBy');

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

    let term = null;
    if (termId) {
      term = await AcademicSession.findOne({ _id: termId as string, schoolId: req.user?.schoolId });
    } else {
      const school = await School.findById(req.user?.schoolId);
      if (school?.activeTermId) {
        term = await AcademicSession.findOne({
          _id: school.activeTermId,
          schoolId: req.user?.schoolId,
        });
      }
      
      if (!term) {
        term = await AcademicSession.findOne({ schoolId: req.user?.schoolId }).sort({ createdAt: -1 });
      }
    }

    if (!term) {
      res.status(404).json({ error: 'No academic session found' });
      return;
    }

    const invoices = await FeeInvoice.find({
      schoolId: req.user?.schoolId,
      termId: (term as any)._id.toString(),
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
    const outstandingBalances: any[] = [];

    invoices.forEach((invoice) => {
      totalExpected += invoice.amountDue;

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
      termId: (term as any)._id.toString(),
      termName: `${(term as any).year} - ${(term as any).currentTerm}`,
      totalExpected,
      totalCollected,
      totalOutstanding,
      totalCredit,
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
    }).populate('recordedBy');

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

    // Get target students
    let students;
    if (template.appliesTo.type === 'class') {
      students = await Student.find({
        schoolId: req.user?.schoolId,
        classId: template.appliesTo.classId,
        status: 'active',
      });
    } else {
      // School-wide
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
      // Check if student already has an invoice from this template for this term
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

      // Create new invoice
      const invoice = new FeeInvoice({
        schoolId: req.user?.schoolId,
        studentId: student._id,
        termId: template.termId,
        billTemplateId: template._id,
        amountDue: template.totalAmount,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
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
