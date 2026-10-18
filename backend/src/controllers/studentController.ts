import { Response } from 'express';
import Student from '../models/Student';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      fullName,
      admissionNo,
      classId,
      gender,
      dateOfBirth,
      guardianName,
      guardianPhone,
      address,
      status,
      photoUrl,
    } = req.body;

    if (!fullName || !admissionNo || !classId || !gender || !dateOfBirth || !guardianName || !guardianPhone || !address) {
      res.status(400).json({ error: 'All required fields must be provided' });
      return;
    }

    const existingStudent = await Student.findOne({
      schoolId: req.user?.schoolId,
      admissionNo,
    });

    if (existingStudent) {
      res.status(400).json({ error: 'Admission number already exists in this school' });
      return;
    }

    const student = new Student({
      schoolId: req.user?.schoolId,
      fullName,
      admissionNo,
      classId,
      gender,
      dateOfBirth,
      guardianName,
      guardianPhone,
      address,
      status: status || 'active',
      photoUrl,
    });
    await student.save();

    const savedStudent = await Student.findById(student._id).populate('classId');
    res.status(201).json(savedStudent);
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, status } = req.query;
    let filter = addSchoolFilter(req);
    
    // If user is a teacher, filter by their assigned classes
    if (req.user?.role === 'teacher') {
      const teacher = await User.findById(req.user.userId);
      if (teacher && teacher.assignedClasses.length > 0) {
        filter.classId = { $in: teacher.assignedClasses };
      } else {
        // Teacher with no assigned classes sees no students
        filter.classId = { $in: [] };
      }
    }
    
    if (classId) {
      filter.classId = classId;
    }
    
    if (status) {
      filter.status = status;
    }

    const students = await Student.find(filter).populate('classId').sort({ fullName: 1 });
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const student = await Student.findOne(filter).populate('classId');

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    res.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      fullName,
      admissionNo,
      classId,
      gender,
      dateOfBirth,
      guardianName,
      guardianPhone,
      address,
      status,
      photoUrl,
    } = req.body;

    const filter = addSchoolFilter(req, { _id: id });
    
    if (admissionNo) {
      const existingStudent = await Student.findOne({
        schoolId: req.user?.schoolId,
        admissionNo,
        _id: { $ne: id },
      });

      if (existingStudent) {
        res.status(400).json({ error: 'Admission number already exists in this school' });
        return;
      }
    }

    const student = await Student.findOneAndUpdate(
      filter,
      {
        fullName,
        admissionNo,
        classId,
        gender,
        dateOfBirth,
        guardianName,
        guardianPhone,
        address,
        status,
        photoUrl,
      },
      { new: true }
    ).populate('classId');

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    res.json(student);
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const student = await Student.findOneAndDelete(filter);

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
