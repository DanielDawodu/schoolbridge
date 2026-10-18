import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendanceRecord {
  studentId: mongoose.Types.ObjectId;
  status: 'present' | 'absent' | 'late' | 'unmarked';
}

export interface IAttendance extends Document {
  schoolId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  date: Date;
  records: IAttendanceRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'unmarked'],
    required: true,
    default: 'unmarked',
  },
});

const AttendanceSchema = new Schema<IAttendance>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'ClassGroup',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    records: [AttendanceRecordSchema],
  },
  {
    timestamps: true,
  }
);

// Ensure one attendance record per class per date
AttendanceSchema.index({ schoolId: 1, classId: 1, date: 1 }, { unique: true });

export default mongoose.model<IAttendance>('Attendance', AttendanceSchema);
