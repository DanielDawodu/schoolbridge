import { Response } from 'express';
import Subject from '../models/Subject';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';
import { logActivity } from '../models/AuditLog';

export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, ca1Weight, ca2Weight, examWeight, applicableClassIds, stream } = req.body;

    if (!name || !code) {
      res.status(400).json({ error: 'Subject name and code are required' });
      return;
    }

    const subject = new Subject({
      schoolId: req.user?.schoolId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      applicableClassIds: Array.isArray(applicableClassIds) ? applicableClassIds : [],
      stream: stream || null,
      ca1Weight: ca1Weight !== undefined ? Number(ca1Weight) : 20,
      ca2Weight: ca2Weight !== undefined ? Number(ca2Weight) : 20,
      examWeight: examWeight !== undefined ? Number(examWeight) : 60,
    });
    await subject.save();

    await logActivity({
      schoolId: req.user?.schoolId,
      userId: req.user?.userId,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'CREATE_SUBJECT',
      module: 'subjects_classes',
      recordId: subject._id.toString(),
      description: `Created subject: ${subject.name} (${subject.code})`,
    });

    res.status(201).json(subject);
  } catch (error: any) {
    console.error('Create subject error:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Subject code already exists in this school' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, stream } = req.query;
    const filter = addSchoolFilter(req);

    if (stream && stream !== 'all') {
      filter.$or = [
        { stream: stream },
        { stream: null },
        { stream: { $exists: false } },
      ];
    }

    let subjects = await Subject.find(filter)
      .populate('applicableClassIds')
      .sort({ name: 1 });

    // If classId specified, filter subjects that are either global (empty applicableClassIds) OR contain this classId
    if (classId) {
      subjects = subjects.filter((s: any) => {
        if (!s.applicableClassIds || s.applicableClassIds.length === 0) {
          return true;
        }
        return s.applicableClassIds.some((c: any) => {
          const id = c?._id ? c._id.toString() : c.toString();
          return id === classId.toString();
        });
      });
    }

    res.json(subjects);
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const subject = await Subject.findOne(filter).populate('applicableClassIds');

    if (!subject) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }

    res.json(subject);
  } catch (error) {
    console.error('Get subject error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, ca1Weight, ca2Weight, examWeight, applicableClassIds, stream } = req.body;

    const filter = addSchoolFilter(req, { _id: id });
    const updatePayload: any = {};
    if (name) updatePayload.name = name.trim();
    if (code) updatePayload.code = code.trim().toUpperCase();
    if (ca1Weight !== undefined) updatePayload.ca1Weight = Number(ca1Weight);
    if (ca2Weight !== undefined) updatePayload.ca2Weight = Number(ca2Weight);
    if (examWeight !== undefined) updatePayload.examWeight = Number(examWeight);
    if (stream !== undefined) updatePayload.stream = stream || null;

    if (applicableClassIds !== undefined) {
      updatePayload.applicableClassIds = Array.isArray(applicableClassIds) ? applicableClassIds : [];
    }

    const subject = await Subject.findOneAndUpdate(filter, updatePayload, { new: true });

    if (!subject) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }

    await logActivity({
      schoolId: req.user?.schoolId,
      userId: req.user?.userId,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'UPDATE_SUBJECT',
      module: 'subjects_classes',
      recordId: subject._id.toString(),
      description: `Updated subject details for: ${subject.name} (${subject.code})`,
    });

    res.json(subject);
  } catch (error) {
    console.error('Update subject error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const subject = await Subject.findOneAndDelete(filter);

    if (!subject) {
      res.status(404).json({ error: 'Subject not found' });
      return;
    }

    await logActivity({
      schoolId: req.user?.schoolId,
      userId: req.user?.userId,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'DELETE_SUBJECT',
      module: 'subjects_classes',
      recordId: String(id),
      description: `Deleted subject: ${subject.name} (${subject.code})`,
    });

    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
