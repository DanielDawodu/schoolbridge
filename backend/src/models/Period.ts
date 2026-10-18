import mongoose, { Schema, Document } from 'mongoose';

export interface IPeriod extends Document {
  schoolId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  termId: mongoose.Types.ObjectId;
  daysOpen: number;
  closeDate?: Date;
  nextTermBeginDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PeriodSchema: Schema = new Schema({
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  termId: {
    type: Schema.Types.ObjectId,
    ref: 'Term',
    required: true,
  },
  daysOpen: {
    type: Number,
    default: 0,
  },
  closeDate: {
    type: Date,
  },
  nextTermBeginDate: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

PeriodSchema.pre('save', function (this: any, next: any) {
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  if (typeof next === 'function') {
    next();
  }
});

// Unique index for schoolId + sessionId + termId combination
PeriodSchema.index({ schoolId: 1, sessionId: 1, termId: 1 }, { unique: true });

// Index for active period
PeriodSchema.index({ schoolId: 1, isActive: 1 });

export default mongoose.model<IPeriod>('Period', PeriodSchema);
