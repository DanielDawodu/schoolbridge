import mongoose, { Schema, Document } from 'mongoose';

export interface BillLineItem {
  label: string;
  amount: number;
}

export interface BillAppliesTo {
  type: 'class' | 'school';
  classId?: mongoose.Types.ObjectId;
}

export interface IBillTemplate extends Document {
  schoolId: mongoose.Types.ObjectId;
  termId: mongoose.Types.ObjectId;
  name: string;
  lineItems: BillLineItem[];
  totalAmount: number;
  appliesTo: BillAppliesTo;
  createdAt: Date;
  updatedAt: Date;
}

const BillLineItemSchema = new Schema({
  label: { type: String, required: true },
  amount: { type: Number, required: true },
});

const BillAppliesToSchema = new Schema({
  type: { type: String, enum: ['class', 'school'], required: true },
  classId: { type: Schema.Types.ObjectId, ref: 'ClassGroup' },
});

const BillTemplateSchema = new Schema({
  schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
  termId: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  name: { type: String, required: true },
  lineItems: [BillLineItemSchema],
  totalAmount: { type: Number, required: true },
  appliesTo: { type: BillAppliesToSchema, required: true },
}, {
  timestamps: true,
});

// Compute totalAmount before saving
BillTemplateSchema.pre('save', function() {
  if (this.lineItems && this.lineItems.length > 0) {
    this.totalAmount = this.lineItems.reduce((sum, item) => sum + item.amount, 0);
  }
});

const BillTemplate = mongoose.model<IBillTemplate>('BillTemplate', BillTemplateSchema);

export default BillTemplate;
