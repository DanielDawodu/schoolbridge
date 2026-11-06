import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import {
  createOrUpdateResult,
  saveStudentResult,
  completeStudentResult,
  reopenStudentResult,
  getClassLeaderboard,
  getStudentResult,
  getStudentTermResults,
  getStudentAllResults,
  getClassCompletionTracker,
  getClassResults,
  updateHeadOfSchoolComment,
  releaseResults,
} from '../controllers/resultController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create or update result (legacy/standard endpoint)
router.post('/', createOrUpdateResult);

// Save student result (draft / incremental save)
router.post('/save', saveStudentResult);

// Phase 1: Complete student result with teacher validation & accountability
router.post('/complete', completeStudentResult);

// Reopen a completed result for corrections (Admin only)
router.post('/reopen', requireAdmin, reopenStudentResult);

// Phase 2: Class leaderboard (Teacher restricted to assigned classes, Admin unrestricted)
router.get('/leaderboard', getClassLeaderboard);

// Get student result
router.get('/student', getStudentResult);

// Get all historical results for a student across all sessions
router.get('/student/:studentId/all', getStudentAllResults);

// Get report completion tracker for a class
router.get('/completion', getClassCompletionTracker);

// Get student term results (for term-over-term comparison)
router.get('/student/terms', getStudentTermResults);

// Get class results (admin only)
router.get('/class', requireAdmin, getClassResults);

// Update head of school comment and approve report (admin only)
router.put('/head-comment', requireAdmin, updateHeadOfSchoolComment);

// Release results (admin only)
router.put('/release', requireAdmin, releaseResults);

export default router;
