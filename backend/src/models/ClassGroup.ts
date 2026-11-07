import mongoose, { Schema, Document } from 'mongoose';

export type AcademicFaction = 'Science' | 'Arts' | 'Commercial';

export interface IClassGroup extends Document {
  schoolId: mongoose.Types.ObjectId;
  classLevelId: mongoose.Types.ObjectId;
  arm: string;
  periodId: mongoose.Types.ObjectId;
  faction?: AcademicFaction | null;
  createdAt: Date;
  updatedAt: Date;
}

const ClassGroupSchema: Schema = new Schema({
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  classLevelId: {
    type: Schema.Types.ObjectId,
    ref: 'ClassLevel',
    required: true,
  },
  arm: {
    type: String,
    required: true,
    trim: true,
  },
  periodId: {
    type: Schema.Types.ObjectId,
    ref: 'Period',
    required: true,
  },
  faction: {
    type: String,
    enum: ['Science', 'Arts', 'Commercial', null],
    default: null,
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

ClassGroupSchema.pre('save', function (this: any, next: any) {
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  if (typeof next === 'function') {
    next();
  }
});

export default mongoose.model<IClassGroup>('ClassGroup', ClassGroupSchema);
