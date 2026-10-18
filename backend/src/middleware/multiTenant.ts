import { AuthRequest } from './auth';

export const addSchoolFilter = (req: AuthRequest, filter: any = {}): any => {
  if (!req.user) {
    throw new Error('Authentication required');
  }
  return {
    ...filter,
    schoolId: req.user.schoolId,
  };
};
