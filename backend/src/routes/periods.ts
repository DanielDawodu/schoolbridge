import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import { createPeriod, getPeriods, updatePeriod, deletePeriod, setActivePeriod } from '../controllers/periodController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Admin-only routes
router.use(requireAdmin);

// Create period
router.post('/', createPeriod);

// Get periods
router.get('/', getPeriods);

// Update period
router.put('/:id', updatePeriod);

// Delete period
router.delete('/:id', deletePeriod);

// Set active period
router.put('/:id/set-active', setActivePeriod);

export default router;
