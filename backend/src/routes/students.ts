import { Router } from 'express';
import {
  createStudent,
  getStudents,
  getStudent,
  updateStudent,
  updateStudentStatus,
  deleteStudent,
  searchStudents,
  exportStudentsCsv,
} from '../controllers/studentController';
import { authenticate } from '../middleware/auth';
import { requireAdmin, requireTeacherOrAdmin } from '../middleware/permissions';
import { requireStudentAccess } from '../middleware/teacherAccess';

const router = Router();

router.post('/', authenticate, requireAdmin, createStudent);
router.get('/', authenticate, requireTeacherOrAdmin, getStudents);
router.get('/search', authenticate, requireTeacherOrAdmin, searchStudents);
router.get('/export/csv', authenticate, requireTeacherOrAdmin, exportStudentsCsv);
router.get('/:id', authenticate, requireTeacherOrAdmin, requireStudentAccess, getStudent);
router.put('/:id', authenticate, requireAdmin, updateStudent);
router.put('/:id/status', authenticate, requireAdmin, updateStudentStatus);
router.delete('/:id', authenticate, requireAdmin, deleteStudent);

export default router;
