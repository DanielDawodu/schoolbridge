import { createClass, updateClass } from '../controllers/classGroupController';
import ClassGroup from '../models/ClassGroup';
import ClassLevel from '../models/ClassLevel';
import Period from '../models/Period';
import AcademicSession from '../models/AcademicSession';
import Session from '../models/Session';
import Term from '../models/Term';
import School from '../models/School';
import mongoose from 'mongoose';

jest.mock('../models/ClassGroup');
jest.mock('../models/ClassLevel');
jest.mock('../models/Period');
jest.mock('../models/AcademicSession');
jest.mock('../models/Session');
jest.mock('../models/Term');
jest.mock('../models/School');
jest.mock('../models/AuditLog', () => ({
  logActivity: jest.fn().mockResolvedValue(true),
}));

describe('Class Creation and Update Controller Tests', () => {
  const schoolId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  const mockReq = (body: any = {}, params: any = {}): any => ({
    body,
    params,
    user: {
      userId,
      schoolId,
      role: 'admin',
      name: 'Test Admin',
    },
  });

  const mockRes = (): any => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createClass Validation', () => {
    it('should reject when arm is missing', async () => {
      const req = mockReq({ name: 'JSS 2', arm: '', sessionId: new mongoose.Types.ObjectId().toString() });
      const res = mockRes();

      await createClass(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Arm / Section is required' })
      );
    });

    it('should reject when both classLevelId and name are missing', async () => {
      const req = mockReq({ arm: 'Gold', sessionId: new mongoose.Types.ObjectId().toString() });
      const res = mockRes();

      await createClass(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Class name or class level is required' })
      );
    });

    it('should reject when no period or session can be resolved', async () => {
      const req = mockReq({ name: 'JSS 2', arm: 'Gold' });
      const res = mockRes();

      // Mock ClassLevel exists
      const mockLevel = { _id: new mongoose.Types.ObjectId(), name: 'JSS 2' };
      (ClassLevel.findOne as jest.Mock).mockResolvedValue(mockLevel);

      // Mock no period found anywhere
      (Period.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });
      (School.findById as jest.Mock).mockResolvedValue(null);
      (AcademicSession.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      await createClass(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Active academic period or session is required'),
        })
      );
    });
  });

  describe('createClass Successful Creation (JSS 2 / Gold scenario)', () => {
    it('should successfully create class when user submits name="JSS 2", arm="Gold", and AcademicSession sessionId', async () => {
      const academicSessionId = new mongoose.Types.ObjectId().toString();
      const resolvedPeriodId = new mongoose.Types.ObjectId();
      const existingLevelId = new mongoose.Types.ObjectId();

      const req = mockReq({
        name: 'JSS 2',
        arm: 'Gold',
        sessionId: academicSessionId,
        faction: '',
      });
      const res = mockRes();

      // 1. Resolve ClassLevel by name
      (ClassLevel.findOne as jest.Mock).mockResolvedValue({
        _id: existingLevelId,
        name: 'JSS 2',
      });

      // 2. Resolve Period from AcademicSession
      (Period.findOne as jest.Mock).mockImplementation((query: any) => {
        if (query?.sessionId && query?.termId) {
          return Promise.resolve({ _id: resolvedPeriodId, isActive: true });
        }
        return Promise.resolve(null);
      });

      (AcademicSession.findOne as jest.Mock).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(academicSessionId),
        year: '2026/2027',
        currentTerm: 'first',
      });

      (Session.findOne as jest.Mock).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        year: '2026/2027',
      });

      (Term.findOne as jest.Mock).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        name: '1st Term',
      });

      // 3. No duplicate class
      (ClassGroup.findOne as jest.Mock).mockResolvedValue(null);

      // 4. Mock ClassGroup instance save & populate
      const mockClassInstance: any = {
        _id: new mongoose.Types.ObjectId(),
        schoolId,
        classLevelId: { _id: existingLevelId, name: 'JSS 2' },
        arm: 'Gold',
        periodId: { _id: resolvedPeriodId },
        faction: null,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockImplementation(() => Promise.resolve(mockClassInstance)),
        toObject: jest.fn().mockReturnValue({
          _id: new mongoose.Types.ObjectId(),
          schoolId,
          classLevelId: { _id: existingLevelId, name: 'JSS 2' },
          arm: 'Gold',
          periodId: { _id: resolvedPeriodId },
          faction: null,
        }),
      };

      (ClassGroup as unknown as jest.Mock).mockImplementation(() => mockClassInstance);

      await createClass(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockClassInstance.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'JSS 2',
          arm: 'Gold',
          faction: null,
        })
      );
    });

    it('should reject when a duplicate class exists in the same period', async () => {
      const periodId = new mongoose.Types.ObjectId().toString();
      const levelId = new mongoose.Types.ObjectId().toString();

      const req = mockReq({
        classLevelId: levelId,
        arm: 'Gold',
        periodId,
      });
      const res = mockRes();

      (ClassLevel.findOne as jest.Mock).mockResolvedValue({ _id: levelId, name: 'JSS 2' });
      (Period.findOne as jest.Mock).mockResolvedValue({ _id: periodId, isActive: true });

      // Simulate duplicate found
      (ClassGroup.findOne as jest.Mock).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        classLevelId: levelId,
        arm: 'Gold',
        periodId,
      });

      await createClass(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'A class with this level and arm already exists for the selected academic period',
        })
      );
    });
  });

  describe('updateClass', () => {
    it('should update class and resolve payload cleanly', async () => {
      const classId = new mongoose.Types.ObjectId().toString();
      const req = mockReq(
        { name: 'JSS 2', arm: 'Diamond', faction: 'Science' },
        { id: classId }
      );
      const res = mockRes();

      const existingClass = {
        _id: classId,
        classLevelId: new mongoose.Types.ObjectId(),
        arm: 'Gold',
        periodId: new mongoose.Types.ObjectId(),
      };
      (ClassGroup.findOne as jest.Mock)
        .mockResolvedValueOnce(existingClass) // Find existing
        .mockResolvedValueOnce(null); // Duplicate check

      const updatedClass: any = {
        _id: classId,
        classLevelId: { _id: existingClass.classLevelId, name: 'JSS 2' },
        arm: 'Diamond',
        periodId: { _id: existingClass.periodId },
        faction: 'Science',
        populate: jest.fn().mockImplementation(() => Promise.resolve(updatedClass)),
        toObject: jest.fn().mockReturnValue({
          _id: classId,
          classLevelId: { _id: existingClass.classLevelId, name: 'JSS 2' },
          arm: 'Diamond',
          periodId: { _id: existingClass.periodId },
          faction: 'Science',
        }),
      };
      (ClassGroup.findOneAndUpdate as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(updatedClass),
        }),
      });

      await updateClass(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          arm: 'Diamond',
          faction: 'Science',
        })
      );
    });
  });
});
