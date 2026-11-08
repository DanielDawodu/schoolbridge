import mongoose from 'mongoose';
import { AuthRequest } from './auth';

export const addSchoolFilter = (req: AuthRequest, filter: any = {}): any => {
  if (!req.user) {
    throw new Error('Authentication required');
  }
  const sId = req.user.schoolId;
  const sIdVariants = [
    sId,
    sId ? sId.toString() : '',
    ...(sId && mongoose.Types.ObjectId.isValid(sId) ? [new mongoose.Types.ObjectId(sId)] : []),
  ].filter(Boolean);

  return {
    ...filter,
    schoolId: { $in: Array.from(new Set(sIdVariants)) },
  };
};
