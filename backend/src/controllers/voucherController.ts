import { Response } from 'express';
import mongoose from 'mongoose';
import PaymentVoucher, { generateVoucherNumber, VoucherCategory, VoucherStatus } from '../models/PaymentVoucher';
import School from '../models/School';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { amountToWords } from '../utils/numberToWords';

/**
 * Get all payment vouchers for school with filtering and stats
 */
export const getVouchers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { category, status, search, startDate, endDate, staffId } = req.query;

    const filter: any = { schoolId };

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (staffId) {
      filter.staffId = staffId;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      filter.$or = [
        { voucherNumber: searchRegex },
        { payee: searchRegex },
        { purpose: searchRegex },
        { referenceNumber: searchRegex },
      ];
    }

    const vouchers = await PaymentVoucher.find(filter)
      .populate('staffId', 'name fullName email role phone')
      .sort({ date: -1, createdAt: -1 });

    // Aggregate summary stats for the school
    const allSchoolVouchers = await PaymentVoucher.find({ schoolId });
    const stats = {
      totalVouchers: allSchoolVouchers.length,
      totalAmountPaid: allSchoolVouchers
        .filter((v) => v.status === 'Paid')
        .reduce((sum, v) => sum + v.amount, 0),
      totalPendingApproval: allSchoolVouchers.filter((v) => v.status === 'Pending Approval').length,
      totalApproved: allSchoolVouchers.filter((v) => v.status === 'Approved').length,
      totalDraft: allSchoolVouchers.filter((v) => v.status === 'Draft').length,
    };

    res.json({
      vouchers,
      stats,
    });
  } catch (error) {
    console.error('Get vouchers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get single voucher detail for viewing and printing
 */
export const getVoucherById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;

    const voucher = await PaymentVoucher.findOne({ _id: id, schoolId })
      .populate('staffId', 'name fullName email role phone')
      .populate('preparedBy.userId', 'name fullName email')
      .populate('approvedBy.userId', 'name fullName email')
      .populate('paidBy.userId', 'name fullName email');

    if (!voucher) {
      res.status(404).json({ error: 'Payment voucher not found' });
      return;
    }

    const school = await School.findById(schoolId);

    res.json({
      voucher,
      school: {
        name: school?.name,
        address: school?.address,
        signatureUrl: school?.signatureUrl,
      },
    });
  } catch (error) {
    console.error('Get voucher by id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create a new payment voucher
 */
export const createVoucher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      payee,
      staffId,
      category,
      purpose,
      amount,
      paymentMethod = 'bank_transfer',
      referenceNumber,
      paymentPeriod,
      date,
      notes,
      status = 'Draft',
    } = req.body;

    if (!payee || !payee.trim()) {
      res.status(400).json({ error: 'Payee name is required' });
      return;
    }

    if (!category) {
      res.status(400).json({ error: 'Voucher category is required' });
      return;
    }

    if (!purpose || !purpose.trim()) {
      res.status(400).json({ error: 'Payment purpose/description is required' });
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than zero' });
      return;
    }

    const prepUser = await User.findById(req.user?.userId);
    const preparedByName = (prepUser as any)?.fullName || prepUser?.name || 'Authorized Staff';

    const words = amountToWords(numAmount);

    let voucherNumber = generateVoucherNumber();
    // Ensure uniqueness
    let exists = await PaymentVoucher.findOne({ voucherNumber });
    let attempts = 0;
    while (exists && attempts < 5) {
      voucherNumber = generateVoucherNumber();
      exists = await PaymentVoucher.findOne({ voucherNumber });
      attempts++;
    }

    const voucher = new PaymentVoucher({
      schoolId,
      voucherNumber,
      date: date ? new Date(date) : new Date(),
      payee: payee.trim(),
      staffId: staffId ? staffId : undefined,
      category,
      purpose: purpose.trim(),
      amount: numAmount,
      amountInWords: words,
      paymentMethod,
      referenceNumber: referenceNumber ? referenceNumber.trim() : undefined,
      paymentPeriod: paymentPeriod ? paymentPeriod.trim() : undefined,
      preparedBy: {
        userId: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
        name: preparedByName,
        date: new Date(),
      },
      status: ['Draft', 'Pending Approval', 'Approved', 'Paid'].includes(status) ? status : 'Draft',
      notes: notes ? notes.trim() : undefined,
    });

    if (voucher.status === 'Approved') {
      voucher.approvedBy = {
        userId: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
        name: preparedByName,
        date: new Date(),
      };
    } else if (voucher.status === 'Paid') {
      voucher.approvedBy = {
        userId: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
        name: preparedByName,
        date: new Date(),
      };
      voucher.paidBy = {
        userId: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
        name: preparedByName,
        date: new Date(),
      };
    }

    await voucher.save();

    res.status(201).json(voucher);
  } catch (error) {
    console.error('Create voucher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update an existing voucher
 */
export const updateVoucher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;

    const voucher = await PaymentVoucher.findOne({ _id: id, schoolId });
    if (!voucher) {
      res.status(404).json({ error: 'Voucher not found' });
      return;
    }

    if (voucher.status === 'Paid') {
      res.status(400).json({ error: 'Paid vouchers cannot be edited. Create an adjustment voucher instead.' });
      return;
    }

    const {
      payee,
      staffId,
      category,
      purpose,
      amount,
      paymentMethod,
      referenceNumber,
      paymentPeriod,
      date,
      notes,
    } = req.body;

    if (payee) voucher.payee = payee.trim();
    if (staffId !== undefined) voucher.staffId = staffId || undefined;
    if (category) voucher.category = category;
    if (purpose) voucher.purpose = purpose.trim();
    if (paymentMethod) voucher.paymentMethod = paymentMethod;
    if (referenceNumber !== undefined) voucher.referenceNumber = referenceNumber.trim();
    if (paymentPeriod !== undefined) voucher.paymentPeriod = paymentPeriod.trim();
    if (date) voucher.date = new Date(date);
    if (notes !== undefined) voucher.notes = notes.trim();

    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        res.status(400).json({ error: 'Amount must be greater than zero' });
        return;
      }
      voucher.amount = numAmount;
      voucher.amountInWords = amountToWords(numAmount);
    }

    await voucher.save();
    res.json(voucher);
  } catch (error) {
    console.error('Update voucher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update status (approve, mark paid, cancel) with audit trail
 */
export const updateVoucherStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const schoolId = req.user?.schoolId;

    const voucher = await PaymentVoucher.findOne({ _id: id, schoolId });
    if (!voucher) {
      res.status(404).json({ error: 'Voucher not found' });
      return;
    }

    const user = await User.findById(req.user?.userId);
    const userName = (user as any)?.fullName || user?.name || 'Authorized Staff';

    if (status === 'Approved') {
      voucher.status = 'Approved';
      voucher.approvedBy = {
        userId: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
        name: userName,
        date: new Date(),
      };
    } else if (status === 'Paid') {
      voucher.status = 'Paid';
      if (!voucher.approvedBy || !voucher.approvedBy.name) {
        voucher.approvedBy = {
          userId: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
          name: userName,
          date: new Date(),
        };
      }
      voucher.paidBy = {
        userId: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
        name: userName,
        date: new Date(),
      };
    } else if (status === 'Cancelled') {
      voucher.status = 'Cancelled';
    } else if (status === 'Pending Approval') {
      voucher.status = 'Pending Approval';
    } else if (status === 'Draft') {
      voucher.status = 'Draft';
    }

    if (notes) {
      voucher.notes = notes;
    }

    await voucher.save();
    res.json(voucher);
  } catch (error) {
    console.error('Update voucher status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete draft voucher (paid or approved vouchers cannot be deleted)
 */
export const deleteVoucher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;

    const voucher = await PaymentVoucher.findOne({ _id: id, schoolId });
    if (!voucher) {
      res.status(404).json({ error: 'Voucher not found' });
      return;
    }

    if (voucher.status === 'Paid') {
      res.status(400).json({ error: 'Completed/Paid vouchers cannot be deleted for audit compliance.' });
      return;
    }

    await PaymentVoucher.deleteOne({ _id: id });
    res.json({ message: 'Voucher deleted successfully' });
  } catch (error) {
    console.error('Delete voucher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
