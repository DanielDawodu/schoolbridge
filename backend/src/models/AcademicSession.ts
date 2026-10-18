import mongoose, { Schema, Document } from 'mongoose';

export type Term = 'first' | 'second' | 'third';

export interface IAcademicSession extends Document {
  schoolId: mongoose.Types.ObjectId;
  year: string;
  currentTerm: Term;
  finalTerm?: Term;
  daysOpen?: number;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicSessionSchema: Schema = new Schema({
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  year: {
    type: String,
    required: true,
    trim: true,
  },
  currentTerm: {
    type: String,
    enum: ['first', 'second', 'third'],
    required: true,
  },
  finalTerm: {
    type: String,
    enum: ['first', 'second', 'third'],
    default: 'third',
  },
  daysOpen: {
    type: Number,
    default: 0,
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

AcademicSessionSchema.pre('save', function (this: any, next: any) {
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  if (typeof next === 'function') {
    next();
  }
});

export default mongoose.model<IAcademicSession>('AcademicSession', AcademicSessionSchema);
