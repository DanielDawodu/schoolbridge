import { Router } from 'express';
import {
  createTeacher,
  getTeachers,
  getTeacher,
  updateTeacher,
  deactivateTeacher,
  assignClassesToTeacher,
} from '../controllers/teacherController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, requireAdmin, createTeacher);
router.get('/', authenticate, getTeachers);
router.get('/:id', authenticate, getTeacher);
router.put('/:id', authenticate, requireAdmin, updateTeacher);
router.patch('/:id/deactivate', authenticate, requireAdmin, deactivateTeacher);
router.patch('/:id/assign-classes', authenticate, requireAdmin, assignClassesToTeacher);

export default router;
