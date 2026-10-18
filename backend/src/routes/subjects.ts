import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import {
  createSubject,
  getSubjects,
  getSubject,
  updateSubject,
  deleteSubject,
} from '../controllers/subjectController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// All subject routes require admin access
router.use(requireAdmin);

// Create subject
router.post('/', createSubject);

// Get all subjects
router.get('/', getSubjects);

// Get single subject
router.get('/:id', getSubject);

// Update subject
router.put('/:id', updateSubject);

// Delete subject
router.delete('/:id', deleteSubject);

export default router;
