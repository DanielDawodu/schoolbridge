import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import {
  createStaff,
  getStaff,
  getStaffMember,
  updateStaff,
  deactivateStaff,
  assignClassesToStaff,
} from '../controllers/staffController';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Create staff member
router.post('/', createStaff);

// Get all staff members (with optional role filter)
router.get('/', getStaff);

// Get specific staff member
router.get('/:id', getStaffMember);

// Update staff member
router.put('/:id', updateStaff);

// Deactivate staff member
router.delete('/:id', deactivateStaff);

// Assign classes to teacher
router.put('/:id/classes', assignClassesToStaff);

export default router;
