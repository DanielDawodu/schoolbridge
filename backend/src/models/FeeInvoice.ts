import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoiceLineItem {
  name: string;
  amount: number;
  isTuition?: boolean;
  isCarryover?: boolean;
}

export interface ICarriedForwardSource {
  invoiceId: mongoose.Types.ObjectId;
  termName?: string;
  amount: number;
}

export interface IFeeInvoice extends Document {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classId?: mongoose.Types.ObjectId;
  termId: mongoose.Types.ObjectId;
  invoiceNumber?: string;
  billTemplateId?: mongoose.Types.ObjectId;
  lineItems: IInvoiceLineItem[];
  currentTermCharges: number;
  previousTermCarryover: number;
  amountDue: number;
  dueDate: Date;
  status: 'unpaid' | 'partial' | 'paid';
  credit: number;
  isCarriedForward: boolean;
  carriedForwardTo?: mongoose.Types.ObjectId;
  carriedForwardFrom: ICarriedForwardSource[];
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineItemSchema = new Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  isTuition: { type: Boolean, default: false },
  isCarryover: { type: Boolean, default: false },
});

const CarriedForwardSourceSchema = new Schema({
  invoiceId: { type: Schema.Types.ObjectId, ref: 'FeeInvoice', required: true },
  termName: { type: String },
  amount: { type: Number, required: true },
});

export const generateInvoiceNumber = (): string => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${dateStr}-${rand}`;
};

const FeeInvoiceSchema = new Schema<IFeeInvoice>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'ClassGroup',
    },
    termId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicSession',
      required: true,
    },
    invoiceNumber: {
      type: String,
      default: generateInvoiceNumber,
    },
    billTemplateId: {
      type: Schema.Types.ObjectId,
      ref: 'BillTemplate',
    },
    lineItems: [InvoiceLineItemSchema],
    currentTermCharges: {
      type: Number,
      default: 0,
    },
    previousTermCarryover: {
      type: Number,
      default: 0,
    },
    amountDue: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    credit: {
      type: Number,
      default: 0,
      min: 0,
    },
    isCarriedForward: {
      type: Boolean,
      default: false,
    },
    carriedForwardTo: {
      type: Schema.Types.ObjectId,
      ref: 'FeeInvoice',
    },
    carriedForwardFrom: [CarriedForwardSourceSchema],
  },
  {
    timestamps: true,
  }
);

FeeInvoiceSchema.index({ schoolId: 1, studentId: 1, termId: 1 });
FeeInvoiceSchema.index({ schoolId: 1, classId: 1, termId: 1 });
FeeInvoiceSchema.index({ schoolId: 1, invoiceNumber: 1 });

export default mongoose.model<IFeeInvoice>('FeeInvoice', FeeInvoiceSchema);
