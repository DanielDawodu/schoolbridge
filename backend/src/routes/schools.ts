import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import {
  getSchool,
  getActivePeriod,
  setActiveTerm,
  updateSchoolSignature,
  updateSchool,
  updateSchoolBranding,
  getGradeScale,
  updateGradeScale,
  restoreDefaultGradeScale,
} from '../controllers/schoolController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get central active academic session & period configuration
router.get('/active-period', getActivePeriod);

// Get school info (for all authenticated users)
router.get('/me', getSchool);
router.get('/current', getSchool);

// Update school (admin only)
router.put('/me', requireAdmin, updateSchool);

// Update school branding & identity (admin only)
router.put('/branding', requireAdmin, updateSchoolBranding);

// Grading scale management
router.get('/grade-scale', getGradeScale);
router.put('/grade-scale', requireAdmin, updateGradeScale);
router.post('/grade-scale/reset', requireAdmin, restoreDefaultGradeScale);

// Set active term (admin only)
router.put('/active-term', requireAdmin, setActiveTerm);

// Update school signature (admin only)
router.put('/signature', requireAdmin, updateSchoolSignature);

export default router;
