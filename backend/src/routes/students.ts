import { Router } from 'express';
import {
  createStudent,
  getStudents,
  getStudent,
  updateStudent,
  deleteStudent,
} from '../controllers/studentController';
import { authenticate } from '../middleware/auth';
import { requireAdmin, requireTeacherOrAdmin } from '../middleware/permissions';
import { requireStudentAccess } from '../middleware/teacherAccess';

const router = Router();

router.post('/', authenticate, requireAdmin, createStudent);
router.get('/', authenticate, requireTeacherOrAdmin, getStudents);
router.get('/:id', authenticate, requireTeacherOrAdmin, requireStudentAccess, getStudent);
router.put('/:id', authenticate, requireAdmin, updateStudent);
router.delete('/:id', authenticate, requireAdmin, deleteStudent);

export default router;
