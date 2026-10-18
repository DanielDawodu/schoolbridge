import mongoose, { Schema, Document } from 'mongoose';

export interface IClassLevel extends Document {
  schoolId: mongoose.Types.ObjectId;
  name: string;
  levelOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ClassLevelSchema: Schema = new Schema({
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
  levelOrder: {
    type: Number,
    required: true,
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

ClassLevelSchema.pre('save', function (this: any, next: any) {
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  if (typeof next === 'function') {
    next();
  }
});

// Unique index for schoolId + name combination
ClassLevelSchema.index({ schoolId: 1, name: 1 }, { unique: true });

export default mongoose.model<IClassLevel>('ClassLevel', ClassLevelSchema);
