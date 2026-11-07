import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import {
  generateReportCard,
  getClassReportCards,
  getClassReportCardsStatus,
  getClassStudentsReportStatus,
} from '../controllers/reportCardController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Phase 3 Step 1: Get class summary status for report cards
router.get('/class-status', getClassReportCardsStatus);

// Phase 3 Step 2: Get student list for a class with report card completion status
router.get('/class-students', getClassStudentsReportStatus);

// Generate single student report card
router.get('/student', generateReportCard);

// Legacy / bulk: Get class report cards (admin only)
router.get('/class', requireAdmin, getClassReportCards);

export default router;
