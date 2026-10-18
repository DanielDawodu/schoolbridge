import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import { generateReportCard, getClassReportCards } from '../controllers/reportCardController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Generate single student report card
router.get('/student', generateReportCard);

// Get class report cards (admin only)
router.get('/class', requireAdmin, getClassReportCards);

export default router;
