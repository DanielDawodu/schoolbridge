import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  schoolId: mongoose.Types.ObjectId;
  year: string;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema: Schema = new Schema({
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

SessionSchema.pre('save', function (this: any, next: any) {
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  if (typeof next === 'function') {
    next();
  }
});

// Unique index for schoolId + year combination
SessionSchema.index({ schoolId: 1, year: 1 }, { unique: true });

export default mongoose.model<ISession>('Session', SessionSchema);
