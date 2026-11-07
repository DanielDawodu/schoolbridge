import { Response } from 'express';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { module, action, search, limit = 50, page = 1 } = req.query;

    const filter = addSchoolFilter(req);
    if (module && module !== 'all') {
      filter.module = module;
    }
    if (action) {
      filter.action = action;
    }
    if (search) {
      filter.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'name email role'),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      logs,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

