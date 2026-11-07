import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import { getAuditLogs } from '../controllers/auditLogController';

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/', getAuditLogs);

export default router;

