import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import { getSchool, setActiveTerm, updateSchoolSignature, updateSchool } from '../controllers/schoolController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get school info (for all authenticated users)
router.get('/me', getSchool);

// Update school (admin only)
router.put('/me', requireAdmin, updateSchool);

// Set active term (admin only)
router.put('/active-term', requireAdmin, setActiveTerm);

// Update school signature (admin only)
router.put('/signature', requireAdmin, updateSchoolSignature);

export default router;
