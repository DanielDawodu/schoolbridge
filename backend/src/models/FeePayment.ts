import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethodType = 'cash' | 'bank_transfer' | 'pos' | 'cheque' | 'other';
export type PaymentStatusType = 'valid' | 'voided' | 'reversed';

export interface IFeePayment extends Document {
  schoolId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  receiptNumber: string;
  verificationCode: string;
  amountPaid: number;
  amountInWords?: string;
  paymentMethod: PaymentMethodType;
  referenceNumber?: string;
  previousBalance: number;
  remainingBalance: number;
  paidAt: Date;
  recordedBy: mongoose.Types.ObjectId;
  status: PaymentStatusType;
  reversalReason?: string;
  reversedBy?: mongoose.Types.ObjectId;
  reversedAt?: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const generateReceiptNumber = (): string => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `REC-${dateStr}-${rand}`;
};

export const generateVerificationCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const FeePaymentSchema = new Schema<IFeePayment>(
  {
    schoolId: {
      type: Schema.Types.Mixed,
      ref: 'School',
      required: true,
      index: true,
    },
    invoiceId: {
      type: Schema.Types.Mixed,
      ref: 'FeeInvoice',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.Mixed,
      ref: 'Student',
      required: true,
      index: true,
    },
    receiptNumber: {
      type: String,
      unique: true,
      sparse: true,
      default: generateReceiptNumber,
    },
    verificationCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: generateVerificationCode,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },
    amountInWords: {
      type: String,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'pos', 'cheque', 'other'],
      default: 'cash',
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    previousBalance: {
      type: Number,
      default: 0,
    },
    remainingBalance: {
      type: Number,
      default: 0,
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['valid', 'voided', 'reversed'],
      default: 'valid',
    },
    reversalReason: {
      type: String,
    },
    reversedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reversedAt: {
      type: Date,
    },
    note: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

FeePaymentSchema.index({ schoolId: 1, paidAt: -1 });
FeePaymentSchema.index({ schoolId: 1, status: 1 });

export default mongoose.model<IFeePayment>('FeePayment', FeePaymentSchema);
