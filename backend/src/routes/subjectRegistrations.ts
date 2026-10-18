import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import {
  createRegistration,
  getRegistrations,
  deleteRegistration,
  bulkCreateRegistrations,
  getStudentSubjects,
} from '../controllers/subjectRegistrationController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get student subjects (accessible by teachers and admins)
router.get('/student-subjects', getStudentSubjects);

// Admin-only routes
router.use(requireAdmin);

// Create single registration
router.post('/', createRegistration);

// Bulk create registrations
router.post('/bulk', bulkCreateRegistrations);

// Get registrations (with filters)
router.get('/', getRegistrations);

// Delete registration
router.delete('/:id', deleteRegistration);

export default router;
