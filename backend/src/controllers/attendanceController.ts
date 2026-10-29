import { Response } from 'express';
import Attendance from '../models/Attendance';
import Student from '../models/Student';
import ClassGroup from '../models/ClassGroup';
import { AuthRequest } from '../middleware/auth';

export const markAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, date, records } = req.body;

    if (!classId || !date || !records || !Array.isArray(records)) {
      res.status(400).json({ error: 'Class ID, date, and records are required' });
      return;
    }

    // Verify the class belongs to the school
    const classGroup = await ClassGroup.findOne({ _id: classId, schoolId: req.user?.schoolId });
    if (!classGroup) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    // Teacher access check: can only mark attendance for their assigned classes
    if (req.user?.role === 'teacher') {
      const assigned = (req.user.assignedClasses || []).map((id: any) => id.toString());
      if (!assigned.includes(classId.toString())) {
        res.status(403).json({ error: 'You can only mark attendance for your assigned classes' });
        return;
      }
    }

    // Normalize date to midnight to ensure uniqueness
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Check if attendance already exists for this class on this date
    const existingAttendance = await Attendance.findOne({
      schoolId: req.user?.schoolId,
      classId,
      date: attendanceDate,
    });

    if (existingAttendance) {
      // Update existing record
      existingAttendance.records = records;
      await existingAttendance.save();
      res.json(existingAttendance);
    } else {
      // Create new record
      const attendance = new Attendance({
        schoolId: req.user?.schoolId,
        classId,
        date: attendanceDate,
        records,
      });
      await attendance.save();
      res.status(201).json(attendance);
    }
  } catch (error: any) {
    console.error('Mark attendance error:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Attendance for this class and date already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export const getClassAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify the class belongs to the school
    const classGroup = await ClassGroup.findOne({ _id: classId, schoolId: req.user?.schoolId });
    if (!classGroup) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    // Teacher access check
    if (req.user?.role === 'teacher') {
      const assigned = (req.user.assignedClasses || []).map((id: any) => id.toString());
      if (!assigned.includes(classId.toString())) {
        res.status(403).json({ error: 'You can only view attendance for your assigned classes' });
        return;
      }
    }

    const query: any = {
      schoolId: req.user?.schoolId,
      classId,
    };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const attendance = await Attendance.find(query).sort({ date: -1 });
    res.json(attendance);
  } catch (error) {
    console.error('Get class attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStudentAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;

    // Verify the student belongs to the school
    const student = await Student.findOne({ _id: studentId, schoolId: req.user?.schoolId });
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const attendance = await Attendance.find({
      schoolId: req.user?.schoolId,
      'records.studentId': studentId,
    }).sort({ date: -1 });

    // Calculate attendance rate (only count marked days, not unmarked)
    let presentDays = 0;
    let totalMarkedDays = 0;

    attendance.forEach((record) => {
      const studentRecord = record.records.find((r) => r.studentId.toString() === studentId);
      if (studentRecord && studentRecord.status !== 'unmarked') {
        totalMarkedDays++;
        if (studentRecord.status === 'present' || studentRecord.status === 'late') {
          presentDays++;
        }
      }
    });

    const attendanceRate = totalMarkedDays > 0 ? (presentDays / totalMarkedDays) * 100 : 0;

    res.json({
      attendance,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      presentDays,
      totalMarkedDays,
    });
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTodayAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.find({
      schoolId: req.user?.schoolId,
      date: today,
    }).populate('classId');

    let totalMarked = 0;
    let present = 0;
    let absent = 0;
    let late = 0;
    let unmarked = 0;

    attendance.forEach((record) => {
      record.records.forEach((r) => {
        totalMarked++;
        if (r.status === 'present') present++;
        else if (r.status === 'absent') absent++;
        else if (r.status === 'late') late++;
        else if (r.status === 'unmarked') unmarked++;
      });
    });

    res.json({
      date: today,
      totalMarked,
      present,
      absent,
      late,
      unmarked,
      attendance,
    });
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
