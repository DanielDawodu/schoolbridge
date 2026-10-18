import mongoose, { Schema, Document } from 'mongoose';

export interface IGradeScale {
  min: number;
  max: number;
  grade: string;
  description: string;
}

export interface ISchool extends Document {
  name: string;
  address: string;
  activePeriodId?: mongoose.Types.ObjectId;
  activeTermId?: mongoose.Types.ObjectId; // For migration compatibility
  signatureUrl?: string;
  reportCardMode: 'mid-term-and-term' | 'term-only';
  gradeScale: IGradeScale[];
  createdAt: Date;
}

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
  gradeScale: [{
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
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add default grade scale on first save
SchoolSchema.pre('save', function (this: any, next: any) {
  if (this.isNew && (!this.gradeScale || this.gradeScale.length === 0)) {
    this.gradeScale = [
      { min: 70, max: 100, grade: 'A', description: 'Excellent' },
      { min: 60, max: 69, grade: 'B', description: 'Very Good' },
      { min: 50, max: 59, grade: 'C', description: 'Good' },
      { min: 40, max: 49, grade: 'D', description: 'Fair' },
      { min: 0, max: 39, grade: 'F', description: 'Fail' },
    ];
  }
  if (typeof next === 'function') {
    next();
  }
});

export default mongoose.model<ISchool>('School', SchoolSchema);
