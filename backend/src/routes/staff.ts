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
  updateStaffStatus,
  resetStaffPassword,
  exportStaffCsv,
} from '../controllers/staffController';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Export staff CSV (must precede /:id)
router.get('/export/csv', exportStaffCsv);

// Create staff member
router.post('/', createStaff);

// Get all staff members (with optional role filter)
router.get('/', getStaff);

// Get specific staff member
router.get('/:id', getStaffMember);

// Update staff member
router.put('/:id', updateStaff);

// Update staff status (activate / deactivate)
router.put('/:id/status', updateStaffStatus);

// Reset staff password
router.post('/:id/reset-password', resetStaffPassword);

// Deactivate staff member
router.delete('/:id', deactivateStaff);

// Assign classes to teacher
router.put('/:id/classes', assignClassesToStaff);

export default router;
