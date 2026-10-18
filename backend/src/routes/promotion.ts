import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import { getPromotionCandidates, promoteStudents } from '../controllers/promotionController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// All promotion routes require admin access
router.use(requireAdmin);

// Get students eligible for promotion from a source class
router.get('/candidates/:sourceClassId', getPromotionCandidates);

// Promote selected students to target class
router.post('/promote', promoteStudents);

export default router;
