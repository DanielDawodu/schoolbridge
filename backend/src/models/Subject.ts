import mongoose, { Schema, Document } from 'mongoose';

export interface ISubject extends Document {
  schoolId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  category: 'core' | 'elective';
  stream?: string; // For SSS electives (e.g., 'Science', 'Arts', 'Commercial')
  isCompulsory: boolean;
  ca1Weight: number;
  ca2Weight: number;
  examWeight: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema: Schema = new Schema({
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: ['core', 'elective'],
    default: 'core',
  },
  stream: {
    type: String,
    trim: true,
  },
  isCompulsory: {
    type: Boolean,
    default: true,
  },
  ca1Weight: {
    type: Number,
    default: 20,
    min: 0,
    max: 100,
  },
  ca2Weight: {
    type: Number,
    default: 20,
    min: 0,
    max: 100,
  },
  examWeight: {
    type: Number,
    default: 60,
    min: 0,
    max: 100,
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

SubjectSchema.index({ schoolId: 1, code: 1 }, { unique: true });

SubjectSchema.pre('save', function (this: any, next: any) {
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  if (typeof next === 'function') {
    next();
  }
});

export default mongoose.model<ISubject>('Subject', SubjectSchema);
