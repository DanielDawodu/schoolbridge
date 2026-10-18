import mongoose, { Schema, Document } from 'mongoose';

export interface ITerm extends Document {
  schoolId: mongoose.Types.ObjectId;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const TermSchema: Schema = new Schema({
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
  order: {
    type: Number,
    required: true,
    default: 1,
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

TermSchema.pre('save', function (this: any, next: any) {
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  if (typeof next === 'function') {
    next();
  }
});

// Unique index for schoolId + name combination
TermSchema.index({ schoolId: 1, name: 1 }, { unique: true });

export default mongoose.model<ITerm>('Term', TermSchema);
