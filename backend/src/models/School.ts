import mongoose, { Schema, Document } from 'mongoose';

export interface IGradeScale {
  min: number;
  max: number;
  grade: string;
  description: string;
}

export interface IAssessmentConfig {
  examMax: number;
  midtermMax: number;
  ca1Max?: number;
  ca2Max?: number;
}

export interface ISchool extends Document {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  motto?: string;
  activePeriodId?: mongoose.Types.ObjectId;
  activeTermId?: mongoose.Types.ObjectId; // For migration compatibility
  signatureUrl?: string;
  reportCardMode: 'mid-term-and-term' | 'term-only';
  assessmentConfig?: IAssessmentConfig;
  gradeScale: IGradeScale[];
  createdAt: Date;
}

export const DEFAULT_GRADE_SCALE: IGradeScale[] = [
  { min: 70, max: 100, grade: 'A', description: 'Distinction' },
  { min: 60, max: 69, grade: 'B', description: 'Very Good' },
  { min: 50, max: 59, grade: 'C', description: 'Good' },
  { min: 45, max: 49, grade: 'D', description: 'Credit' },
  { min: 40, max: 44, grade: 'E', description: 'Pass' },
  { min: 0, max: 39, grade: 'F', description: 'Fail' },
];

const SchoolSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
  },
  website: {
    type: String,
    trim: true,
  },
  logoUrl: {
    type: String,
  },
  motto: {
    type: String,
    trim: true,
  },
  activePeriodId: {
    type: Schema.Types.ObjectId,
    ref: 'Period',
  },
  activeTermId: {
    type: Schema.Types.ObjectId,
    ref: 'AcademicSession',
  },
  signatureUrl: {
    type: String,
  },
  reportCardMode: {
    type: String,
    enum: ['mid-term-and-term', 'term-only'],
    default: 'mid-term-and-term',
  },
  assessmentConfig: {
    examMax: { type: Number, default: 60 },
    midtermMax: { type: Number, default: 40 },
    ca1Max: { type: Number, default: 20 },
    ca2Max: { type: Number, default: 20 },
  },
  gradeScale: [
    {
      min: {
        type: Number,
        required: true,
      },
      max: {
        type: Number,
        required: true,
      },
      grade: {
        type: String,
        required: true,
      },
      description: {
        type: String,
        required: true,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add default grade scale on first save
SchoolSchema.pre('save', function (this: any, next: any) {
  if (this.isNew && (!this.gradeScale || this.gradeScale.length === 0)) {
    this.gradeScale = [...DEFAULT_GRADE_SCALE];
  }
  if (typeof next === 'function') {
    next();
  }
});

export default mongoose.model<ISchool>('School', SchoolSchema);
