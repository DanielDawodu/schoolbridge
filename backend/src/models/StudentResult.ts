import mongoose, { Document, Schema } from 'mongoose';

export interface ISubjectScore {
  subjectId: mongoose.Types.ObjectId;
  subjectName: string;
  ca1: number;
  ca2: number;
  exam: number;
  total: number;
  grade: string;
  position?: number;
}

export interface IPsychomotorRating {
  trait: string;
  rating: number; // 1-5
}

export interface IAffectiveRating {
  trait: string;
  rating: number; // 1-5
}

export interface IAttendanceSummary {
  daysOpen: number;
  daysPresent: number;
  daysAbsent: number;
}

export interface IStudentResult extends Document {
  schoolId: mongoose.Types.ObjectId;
  periodId?: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classId?: mongoose.Types.ObjectId;
  performanceType: 'mid-term' | 'term';
  verificationCode: string;
  subjectScores: ISubjectScore[];
  psychomotorSkills: IPsychomotorRating[];
  affectiveDomain: IAffectiveRating[];
  teacherComment: string;
  headOfSchoolComment: string;
  isReleased: boolean;
  isCompleted: boolean;
  completedBy?: mongoose.Types.ObjectId;
  completedAt?: Date;
  isApproved: boolean;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  reopenedBy?: mongoose.Types.ObjectId;
  reopenedAt?: Date;
  totalScore: number;
  totalAvailableMarks: number;
  averageScore: number;
  percentage: number;
  classPosition: number;
  classAverage: number;
  attendanceSummary: IAttendanceSummary;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectScoreSchema = new Schema({
  subjectId: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  },
  subjectName: {
    type: String,
    required: true,
  },
  ca1: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  ca2: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  exam: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  grade: {
    type: String,
    required: true,
  },
  position: {
    type: Number,
    default: 0,
  },
});

const PsychomotorRatingSchema = new Schema({
  trait: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
});

const AffectiveRatingSchema = new Schema({
  trait: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
});

const AttendanceSummarySchema = new Schema({
  daysOpen: {
    type: Number,
    default: 0,
  },
  daysPresent: {
    type: Number,
    default: 0,
  },
  daysAbsent: {
    type: Number,
    default: 0,
  },
});

export const generateVerificationCode = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SR${timestamp}${random}`.substring(0, 10);
};

const StudentResultSchema: Schema = new Schema({
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  periodId: {
    type: Schema.Types.ObjectId,
    ref: 'Period',
    required: false,
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: false,
  },
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  classId: {
    type: Schema.Types.ObjectId,
    ref: 'ClassGroup',
    required: false,
  },
  performanceType: {
    type: String,
    enum: ['mid-term', 'term'],
    default: 'term',
    required: true,
  },
  verificationCode: {
    type: String,
    unique: true,
    default: generateVerificationCode,
  },
  subjectScores: [SubjectScoreSchema],
  psychomotorSkills: [PsychomotorRatingSchema],
  affectiveDomain: [AffectiveRatingSchema],
  teacherComment: {
    type: String,
    default: '',
  },
  headOfSchoolComment: {
    type: String,
    default: '',
  },
  isReleased: {
    type: Boolean,
    default: false,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  completedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  completedAt: {
    type: Date,
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
  reopenedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  reopenedAt: {
    type: Date,
  },
  totalScore: {
    type: Number,
    default: 0,
  },
  totalAvailableMarks: {
    type: Number,
    default: 0,
  },
  averageScore: {
    type: Number,
    default: 0,
  },
  percentage: {
    type: Number,
    default: 0,
  },
  classPosition: {
    type: Number,
    default: 0,
  },
  classAverage: {
    type: Number,
    default: 0,
  },
  attendanceSummary: {
    type: AttendanceSummarySchema,
    default: () => ({ daysOpen: 0, daysPresent: 0, daysAbsent: 0 }),
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

StudentResultSchema.pre('validate', function (this: any) {
  if (!this.verificationCode) {
    this.verificationCode = generateVerificationCode();
  }
});

StudentResultSchema.pre('save', function (this: any, next: any) {
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  if (!this.verificationCode) {
    this.verificationCode = generateVerificationCode();
  }
  if (typeof next === 'function') {
    next();
  }
});

// Indexes to ensure fast lookup and uniqueness per student per period/session
StudentResultSchema.index({ schoolId: 1, periodId: 1, studentId: 1, performanceType: 1 }, { unique: true, sparse: true });
StudentResultSchema.index({ schoolId: 1, sessionId: 1, studentId: 1, performanceType: 1 }, { sparse: true });

export default mongoose.model<IStudentResult>('StudentResult', StudentResultSchema);
