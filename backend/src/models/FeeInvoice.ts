import mongoose, { Schema, Document } from 'mongoose';

export interface IFeeInvoice extends Document {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  termId: mongoose.Types.ObjectId;
  billTemplateId?: mongoose.Types.ObjectId;
  amountDue: number;
  dueDate: Date;
  status: 'unpaid' | 'partial' | 'paid';
  credit: number;
  createdAt: Date;
  updatedAt: Date;
}

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
    termId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicSession',
      required: true,
    },
    billTemplateId: {
      type: Schema.Types.ObjectId,
      ref: 'BillTemplate',
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IFeeInvoice>('FeeInvoice', FeeInvoiceSchema);
