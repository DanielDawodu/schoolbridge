import { Response } from 'express';
import SubjectRegistration from '../models/SubjectRegistration';
import ClassGroup from '../models/ClassGroup';
import Student from '../models/Student';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';
import { logActivity } from '../models/AuditLog';

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
      statusReason,
      photoUrl,
      stream,
    } = req.body;

    if (!fullName || !classId || !gender || !dateOfBirth || !guardianName || !guardianPhone || !address) {
      res.status(400).json({
        error: 'All required fields (Name, Class, Gender, Date of Birth, Guardian Name, Guardian Phone, Address) must be provided'
      });
      return;
    }

    // Verify class exists in school
    const classGroup = await ClassGroup.findOne({
      _id: classId,
      schoolId: req.user?.schoolId,
    });
    if (!classGroup) {
      res.status(400).json({ error: 'Selected class does not exist in this school' });
      return;
    }

    // Auto-derive stream/faction from classGroup if not explicitly set
    let finalStream = stream ? stream.trim() : undefined;
    if (!finalStream && classGroup.faction) {
      finalStream = classGroup.faction;
    }

    // Auto-generate admission number if missing/blank
    let finalAdmissionNo = (admissionNo || '').trim();
    if (!finalAdmissionNo) {
      const year = new Date().getFullYear();
      const count = await Student.countDocuments({ schoolId: req.user?.schoolId });
      let seq = count + 1;
      let candidate = `ADM/${year}/${String(seq).padStart(3, '0')}`;
      while (await Student.findOne({ schoolId: req.user?.schoolId, admissionNo: candidate })) {
        seq++;
        candidate = `ADM/${year}/${String(seq).padStart(3, '0')}`;
      }
      finalAdmissionNo = candidate;
    }

    // Check duplicate admission number case-insensitively
    const existingStudent = await Student.findOne({
      schoolId: req.user?.schoolId,
      admissionNo: { $regex: new RegExp(`^${finalAdmissionNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });

    if (existingStudent) {
      res.status(400).json({
        error: `Admission number "${finalAdmissionNo}" already exists in this school. Please use a unique admission number.`
      });
      return;
    }

    const student = new Student({
      schoolId: req.user?.schoolId,
      fullName: fullName.trim(),
      admissionNo: finalAdmissionNo,
      classId,
      gender,
      dateOfBirth: new Date(dateOfBirth),
      guardianName: guardianName.trim(),
      guardianPhone: guardianPhone.trim(),
      address: address.trim(),
      status: status || 'active',
      statusReason: statusReason || '',
      photoUrl: photoUrl && photoUrl.trim() ? photoUrl.trim() : undefined,
      stream: finalStream,
    });
    await student.save();

    await logActivity(
      req,
      'create',
      'student',
      student._id.toString(),
      {
        fullName: student.fullName,
        admissionNo: student.admissionNo,
        classId: student.classId,
        stream: student.stream,
      }
    );

    const savedStudent = await Student.findById(student._id).populate('classId');
    res.status(201).json(savedStudent);
  } catch (error: any) {
    if (error.code === 11000 || error.name === 'MongoServerError') {
      res.status(400).json({ error: 'Admission number already exists in this school. Please choose a different admission number.' });
      return;
    }
    if (error.name === 'ValidationError') {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Failed to create student: ' + (error.message || 'Internal server error') });
  }
};

export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, status, activeOnly, stream } = req.query;
    let filter = addSchoolFilter(req);
    
    // If user is a teacher, filter by their assigned classes or classes where they teach subjects
    if (req.user?.role === 'teacher') {
      const teacher = await User.findById(req.user.userId);
      const assigned = (teacher?.assignedClasses || []).map((id: any) => id.toString());
      const subjectRegistrations = await SubjectRegistration.find({
        schoolId: req.user.schoolId,
        assignedTeacherId: req.user.userId,
      }).distinct('classId');
      const subjectClassIds = subjectRegistrations.map((id: any) => id.toString());
      const allTeacherClassIds = Array.from(new Set([...assigned, ...subjectClassIds]));

      if (classId) {
        if (!allTeacherClassIds.includes(classId.toString())) {
          res.json([]);
          return;
        }
        filter.classId = classId;
      } else {
        filter.classId = { $in: allTeacherClassIds };
      }
    } else if (classId) {
      filter.classId = classId;
    }
    
    if (status && status !== 'all') {
      filter.status = status;
    } else if (activeOnly === 'true' && !status) {
      filter.status = 'active';
    }

    if (stream && stream !== 'all') {
      filter.stream = stream;
    }

    const students = await Student.find(filter).populate('classId').sort({ fullName: 1 });
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || !q.trim()) {
      res.json([]);
      return;
    }

    const queryStr = q.trim();
    let filter = addSchoolFilter(req);

    // If teacher, restrict to teacher classes
    if (req.user?.role === 'teacher') {
      const teacher = await User.findById(req.user.userId);
      const assigned = (teacher?.assignedClasses || []).map((id: any) => id.toString());
      const subjectRegistrations = await SubjectRegistration.find({
        schoolId: req.user.schoolId,
        assignedTeacherId: req.user.userId,
      }).distinct('classId');
      const subjectClassIds = subjectRegistrations.map((id: any) => id.toString());
      const allTeacherClassIds = Array.from(new Set([...assigned, ...subjectClassIds]));
      filter.classId = { $in: allTeacherClassIds };
    }

    const regex = new RegExp(queryStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { fullName: { $regex: regex } },
      { admissionNo: { $regex: regex } },
      { guardianName: { $regex: regex } },
      { guardianPhone: { $regex: regex } },
    ];

    const students = await Student.find(filter)
      .populate('classId')
      .limit(20)
      .sort({ fullName: 1 });

    res.json(students);
  } catch (error) {
    console.error('Search students error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportStudentsCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, status } = req.query;
    let filter = addSchoolFilter(req);

    if (classId) {
      filter.classId = classId;
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const students = await Student.find(filter)
      .populate({
        path: 'classId',
        populate: { path: 'classLevelId', select: 'name' },
      })
      .sort({ fullName: 1 });

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const headers = [
      'Admission No',
      'Full Name',
      'Class',
      'Arm',
      'Stream / Faction',
      'Gender',
      'Date of Birth',
      'Guardian Name',
      'Guardian Phone',
      'Address',
      'Status',
    ];

    const rows = students.map((s: any) => {
      const cls = s.classId;
      const className = cls?.classLevelId?.name || '';
      const arm = cls?.arm || '';
      const dob = s.dateOfBirth ? new Date(s.dateOfBirth).toISOString().split('T')[0] : '';
      return [
        escapeCsv(s.admissionNo),
        escapeCsv(s.fullName),
        escapeCsv(className),
        escapeCsv(arm),
        escapeCsv(s.stream || ''),
        escapeCsv(s.gender),
        escapeCsv(dob),
        escapeCsv(s.guardianName),
        escapeCsv(s.guardianPhone),
        escapeCsv(s.address),
        escapeCsv(s.status),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="students-export.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Export students CSV error:', error);
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
      statusReason,
      photoUrl,
      stream,
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

    let finalStream = stream !== undefined ? (stream ? stream.trim() : '') : undefined;
    if (finalStream === undefined && classId) {
      const classGroup = await ClassGroup.findOne({
        _id: classId,
        schoolId: req.user?.schoolId,
      });
      if (classGroup?.faction) {
        finalStream = classGroup.faction;
      }
    }

    const updatePayload: any = {
      fullName,
      admissionNo,
      classId,
      gender,
      dateOfBirth,
      guardianName,
      guardianPhone,
      address,
      status,
      statusReason,
      photoUrl,
    };
    if (finalStream !== undefined) {
      updatePayload.stream = finalStream;
    }

    const student = await Student.findOneAndUpdate(
      filter,
      updatePayload,
      { new: true }
    ).populate('classId');

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    await logActivity(
      req,
      'update',
      'student',
      student._id.toString(),
      {
        fullName: student.fullName,
        admissionNo: student.admissionNo,
        classId: student.classId,
        stream: student.stream,
        status: student.status,
      }
    );

    res.json(student);
  } catch (error: any) {
    if (error.code === 11000 || error.name === 'MongoServerError') {
      res.status(400).json({ error: 'Admission number already exists in this school' });
      return;
    }
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Internal server error: ' + (error.message || '') });
  }
};

export const updateStudentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, statusReason } = req.body;

    if (!status || !['active', 'inactive', 'withdrawn', 'graduated'].includes(status)) {
      res.status(400).json({ error: 'Valid status (active, inactive, withdrawn, graduated) is required' });
      return;
    }

    const filter = addSchoolFilter(req, { _id: id });
    const student = await Student.findOneAndUpdate(
      filter,
      { status, statusReason: statusReason || '' },
      { new: true }
    ).populate('classId');

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    await logActivity(
      req,
      'status_change',
      'student',
      student._id.toString(),
      { status, statusReason }
    );

    res.json(student);
  } catch (error) {
    console.error('Update student status error:', error);
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

    await logActivity(
      req,
      'delete',
      'student',
      student._id.toString(),
      { fullName: student.fullName, admissionNo: student.admissionNo }
    );

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
