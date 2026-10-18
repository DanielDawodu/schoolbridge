import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    schoolId: string;
    role: string;
    assignedClasses?: any[];
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      schoolId: string;
      role: string;
    };

    // Check if user is active
    const user = await User.findById(decoded.userId);

    if (!user || user.status === 'inactive') {
      res.status(401).json({ error: 'Account is inactive' });
      return;
    }

    req.user = {
      userId: decoded.userId,
      schoolId: decoded.schoolId,
      role: decoded.role,
      assignedClasses: user.assignedClasses || [],
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};

export const authenticate = verifyToken;
