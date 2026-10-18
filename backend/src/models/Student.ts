import mongoose, { Schema, Document } from 'mongoose';

export type StudentStatus = 'active' | 'inactive' | 'withdrawn' | 'graduated';

export interface IStudent extends Document {
  schoolId: mongoose.Types.ObjectId;
  fullName: string;
  admissionNo: string;
  classId: mongoose.Types.ObjectId;
  gender: string;
  dateOfBirth: Date;
  guardianName: string;
  guardianPhone: string;
  address: string;
  status: StudentStatus;
  statusReason?: string;
  migrationBatchId?: mongoose.Types.ObjectId;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema: Schema = new Schema({
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  admissionNo: {
    type: String,
    required: true,
    trim: true,
  },
  classId: {
    type: Schema.Types.ObjectId,
    ref: 'ClassGroup',
    required: true,
  },
  gender: {
    type: String,
    required: true,
    trim: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  guardianName: {
    type: String,
    required: true,
    trim: true,
  },
  guardianPhone: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'withdrawn', 'graduated'],
    default: 'active',
  },
  statusReason: {
    type: String,
  },
  migrationBatchId: {
    type: Schema.Types.ObjectId,
    ref: 'MigrationBatch',
  },
  photoUrl: {
    type: String,
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

StudentSchema.pre('save', function (this: any, next: any) {
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  if (typeof next === 'function') {
    next();
  }
});

export default mongoose.model<IStudent>('Student', StudentSchema);
