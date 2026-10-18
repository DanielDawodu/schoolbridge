import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdminOrTeacherForClass } from '../middleware/teacherAccess';
import {
  markAttendance,
  getClassAttendance,
  getStudentAttendance,
  getTodayAttendance,
} from '../controllers/attendanceController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Mark attendance (admin or teacher for their assigned class)
router.post('/', requireAdminOrTeacherForClass, markAttendance);

// Get attendance for a class (admin or teacher for their assigned class)
router.get('/class/:classId', requireAdminOrTeacherForClass, getClassAttendance);

// Get attendance for a student (admin or teacher for the student's class)
router.get('/student/:studentId', getStudentAttendance);

// Get today's attendance summary (admin only)
router.get('/today', getTodayAttendance);

export default router;
