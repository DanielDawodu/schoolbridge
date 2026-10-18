import { Router } from 'express';
import {
  createClass,
  getClasses,
  getClass,
  updateClass,
  deleteClass,
} from '../controllers/classGroupController';
import { authenticate } from '../middleware/auth';
import { requireAdmin, requireTeacherOrAdmin } from '../middleware/permissions';
import { requireClassAccess } from '../middleware/teacherAccess';

const router = Router();

router.post('/', authenticate, requireAdmin, createClass);
router.get('/', authenticate, requireTeacherOrAdmin, getClasses);
router.get('/:id', authenticate, requireTeacherOrAdmin, requireClassAccess, getClass);
router.put('/:id', authenticate, requireAdmin, updateClass);
router.delete('/:id', authenticate, requireAdmin, deleteClass);

export default router;
