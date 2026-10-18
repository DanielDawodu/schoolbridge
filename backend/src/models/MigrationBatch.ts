import mongoose, { Schema, Document } from 'mongoose';

export interface IMigrationBatch extends Document {
  schoolId: mongoose.Types.ObjectId;
  uploadedFileName: string;
  columnMapping: Record<string, string>;
  rowCount: number;
  errorCount: number;
  importedAt: Date;
  status: 'pending' | 'completed' | 'partial' | 'failed' | 'rolled_back';
  studentIds: mongoose.Types.ObjectId[];
  errorData?: any[];
}

const MigrationBatchSchema: Schema = new Schema({
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  uploadedFileName: {
    type: String,
    required: true,
  },
  columnMapping: {
    type: Schema.Types.Mixed,
    required: true,
  },
  rowCount: {
    type: Number,
    required: true,
  },
  errorCount: {
    type: Number,
    default: 0,
  },
  importedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'partial', 'failed', 'rolled_back'],
    default: 'pending',
  },
  studentIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Student',
  }],
  errorData: [{
    type: Schema.Types.Mixed,
  }],
});

export default mongoose.model<IMigrationBatch>('MigrationBatch', MigrationBatchSchema);
