import { Request, Response, NextFunction } from 'express';
import { StaffRole } from '../models/User';

// Define permissions for each role
// Admin has full access (override all checks)
const ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
  admin: ['*'], // Full access to everything
  teacher: ['attendance', 'students'], // Can access attendance and students (scoped to assigned classes)
  accountant: ['fees'], // Can access fees module only
  bookshop: [], // No functional permissions yet (role exists for future)
};

// Define module names for easier reference
export const MODULES = {
  STUDENTS: 'students',
  CLASSES: 'classes',
  ATTENDANCE: 'attendance',
  FEES: 'fees',
  MIGRATION: 'migration',
  SETTINGS: 'settings',
  TEACHERS: 'teachers',
  DASHBOARD: 'dashboard',
} as const;

/**
 * Check if a role has permission to access a module
 */
export const hasPermission = (role: StaffRole, module: string): boolean => {
  if (role === 'admin') return true; // Admin has full access
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes('*') || permissions.includes(module);
};

/**
 * Middleware to check if user has permission to access a module
 */
export const requirePermission = (module: string) => {
  return (req: any, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Admin always has access
    if (user.role === 'admin') {
      return next();
    }

    // Check if user's role has permission for the module
    if (hasPermission(user.role, module)) {
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = (req: any, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Middleware to require teacher or admin role
 */
export const requireTeacherOrAdmin = (req: any, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== 'teacher' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Teacher or admin access required' });
  }
  next();
};

/**
 * Middleware to require accountant or admin role
 */
export const requireAccountantOrAdmin = (req: any, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== 'accountant' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Accountant or admin access required' });
  }
  next();
};
