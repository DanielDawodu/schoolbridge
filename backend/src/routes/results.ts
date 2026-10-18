import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import {
  createOrUpdateResult,
  saveStudentResult,
  getStudentResult,
  getStudentTermResults,
  getClassResults,
  updateHeadOfSchoolComment,
  releaseResults,
} from '../controllers/resultController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create or update result (teacher for their assigned students, admin for all)
router.post('/', createOrUpdateResult);

// Save student result (new unified endpoint for the restructured UI)
router.post('/save', saveStudentResult);

// Get student result
router.get('/student', getStudentResult);

// Get student term results (for term-over-term comparison)
router.get('/student/terms', getStudentTermResults);

// Get class results (admin only)
router.get('/class', requireAdmin, getClassResults);

// Update head of school comment (admin only)
router.put('/head-comment', requireAdmin, updateHeadOfSchoolComment);

// Release results (admin only)
router.put('/release', requireAdmin, releaseResults);

export default router;
