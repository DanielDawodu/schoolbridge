import mongoose, { Schema, Document } from 'mongoose';

export type StaffRole = 'admin' | 'teacher' | 'accountant' | 'bookshop';

export interface IUser extends Document {
  schoolId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: StaffRole;
  assignedClasses: mongoose.Types.ObjectId[];
  status: 'active' | 'inactive';
  temporaryPassword?: string;
  photoUrl?: string;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
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
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'accountant', 'bookshop'],
    required: true,
  },
  assignedClasses: [{
    type: Schema.Types.ObjectId,
    ref: 'ClassGroup',
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  temporaryPassword: {
    type: String,
  },
  photoUrl: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model<IUser>('User', UserSchema);
