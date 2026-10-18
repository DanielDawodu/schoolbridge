import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import { createSession, getSessions, deleteSession } from '../controllers/sessionController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Admin-only routes
router.use(requireAdmin);

// Create session
router.post('/', createSession);

// Get sessions
router.get('/', getSessions);

// Delete session
router.delete('/:id', deleteSession);

export default router;
