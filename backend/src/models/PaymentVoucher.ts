import mongoose, { Schema, Document } from 'mongoose';

export type VoucherCategory =
  | 'Teaching Staff Salary'
  | 'Non-teaching Staff Salary'
  | 'Allowances'
  | 'Utilities'
  | 'Maintenance'
  | 'Supplies'
  | 'Other Expenditure';

export type VoucherStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Paid' | 'Cancelled';

export interface IPaymentVoucher extends Document {
  schoolId: mongoose.Types.ObjectId;
  voucherNumber: string;
  date: Date;
  payee: string;
  staffId?: mongoose.Types.ObjectId;
  category: VoucherCategory;
  purpose: string;
  amount: number;
  amountInWords: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'pos' | 'other';
  referenceNumber?: string;
  paymentPeriod?: string;
  preparedBy: {
    userId?: mongoose.Types.ObjectId;
    name: string;
    date: Date;
  };
  approvedBy?: {
    userId?: mongoose.Types.ObjectId;
    name: string;
    date: Date;
  };
  paidBy?: {
    userId?: mongoose.Types.ObjectId;
    name: string;
    date: Date;
  };
  status: VoucherStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const generateVoucherNumber = (): string => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PV-${dateStr}-${rand}`;
};

const PaymentVoucherSchema = new Schema<IPaymentVoucher>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    voucherNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: generateVoucherNumber,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    payee: {
      type: String,
      required: true,
      trim: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Teaching Staff Salary',
        'Non-teaching Staff Salary',
        'Allowances',
        'Utilities',
        'Maintenance',
        'Supplies',
        'Other Expenditure',
      ],
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    amountInWords: {
      type: String,
      required: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'cheque', 'pos', 'other'],
      default: 'bank_transfer',
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    paymentPeriod: {
      type: String,
      trim: true,
    },
    preparedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, required: true },
      date: { type: Date, default: Date.now },
    },
    approvedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      name: { type: String },
      date: { type: Date },
    },
    paidBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      name: { type: String },
      date: { type: Date },
    },
    status: {
      type: String,
      enum: ['Draft', 'Pending Approval', 'Approved', 'Paid', 'Cancelled'],
      default: 'Draft',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

PaymentVoucherSchema.index({ schoolId: 1, date: -1 });
PaymentVoucherSchema.index({ schoolId: 1, category: 1 });
PaymentVoucherSchema.index({ schoolId: 1, status: 1 });

export default mongoose.model<IPaymentVoucher>('PaymentVoucher', PaymentVoucherSchema);

