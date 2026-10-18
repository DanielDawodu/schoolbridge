import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import { createClassLevel, getClassLevels, updateClassLevel, deleteClassLevel } from '../controllers/classLevelController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Admin-only routes
router.use(requireAdmin);

// Create class level
router.post('/', createClassLevel);

// Get class levels
router.get('/', getClassLevels);

// Update class level
router.put('/:id', updateClassLevel);

// Delete class level
router.delete('/:id', deleteClassLevel);

export default router;
