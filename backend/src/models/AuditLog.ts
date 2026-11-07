import mongoose, { Schema, Document } from 'mongoose';

export type AuditModule =
  | 'students'
  | 'student'
  | 'staff'
  | 'academic'
  | 'results'
  | 'finance_billing'
  | 'finance_payment'
  | 'finance_voucher'
  | 'branding_settings'
  | 'subjects_classes'
  | 'security';

export interface IAuditLog extends Document {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userName?: string;
  userRole?: string;
  action: string;
  module: AuditModule;
  recordId?: string;
  description: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema: Schema = new Schema({
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
  },
  userRole: {
    type: String,
  },
  action: {
    type: String,
    required: true,
  },
  module: {
    type: String,
    required: true,
    index: true,
  },
  recordId: {
    type: String,
  },
  description: {
    type: String,
    required: true,
  },
  details: {
    type: Schema.Types.Mixed,
  },
  ipAddress: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

export const logActivity = async (
  first: any,
  action?: string,
  module?: AuditModule,
  recordId?: string,
  details?: any
) => {
  try {
    let params: any;
    if (typeof first === 'object' && first.schoolId) {
      // Called with options object: logActivity({ schoolId, userId, action, ... })
      params = first;
    } else if (first && first.user) {
      // Called with (req, action, module, recordId, details)
      params = {
        schoolId: first.user?.schoolId,
        userId: first.user?.userId,
        userName: first.user?.name || first.user?.role || 'User',
        userRole: first.user?.role,
        action: action || 'ACTION',
        module: module === 'student' ? 'students' : module || 'security',
        recordId: recordId,
        description: `${action} on ${module} ${recordId || ''}`.trim(),
        details: details,
        ipAddress: first.ip,
      };
    } else {
      return;
    }

    if (!params.schoolId || !params.userId) return;

    const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
    const log = new AuditLog({
      schoolId: params.schoolId,
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: params.action,
      module: params.module === 'student' ? 'students' : params.module,
      recordId: params.recordId,
      description: params.description || `${params.action} performed`,
      details: params.details,
      ipAddress: params.ipAddress,
      createdAt: new Date(),
    });
    await log.save();
  } catch (err) {
    console.error('Audit logging error (non-fatal):', err);
  }
};

export default mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
