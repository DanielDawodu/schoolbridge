import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import { runSessionTermPeriodMigration } from '../controllers/sessionTermPeriodMigrationController';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(requireAdmin);

// Run Session/Term/Period migration (dry-run or live)
router.post('/session-term-period', runSessionTermPeriodMigration);

export default router;
