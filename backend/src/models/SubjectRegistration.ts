import mongoose, { Schema, Document } from 'mongoose';

export interface ISubjectRegistration extends Document {
  schoolId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  classId?: mongoose.Types.ObjectId; // For class-level registration (Primary/JSS)
  studentId?: mongoose.Types.ObjectId; // For student-level registration (SSS electives)
  stream?: string; // For SSS stream-based electives
  assignedTeacherId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectRegistrationSchema: Schema = new Schema({
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true,
  },
  subjectId: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  },
  classId: {
    type: Schema.Types.ObjectId,
    ref: 'ClassGroup',
  },
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
  },
  stream: {
    type: String,
    trim: true,
  },
  assignedTeacherId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
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

// Ensure either classId or studentId is set (but not both for the same registration)
SubjectRegistrationSchema.pre('save', function (this: any, next: any) {
  if (!this.classId && !this.studentId) {
    next(new Error('Either classId or studentId must be set'));
    return;
  }
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  if (typeof next === 'function') {
    next();
  }
});

export default mongoose.model<ISubjectRegistration>('SubjectRegistration', SubjectRegistrationSchema);
