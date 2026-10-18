import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import { createTerm, getTerms, updateTerm, deleteTerm } from '../controllers/termController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Admin-only routes
router.use(requireAdmin);

// Create term
router.post('/', createTerm);

// Get terms
router.get('/', getTerms);

// Update term
router.put('/:id', updateTerm);

// Delete term
router.delete('/:id', deleteTerm);

export default router;
