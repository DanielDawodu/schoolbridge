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

  const createMockClassInstance = (levelId: any, levelName: string, arm: string, periodId: any, faction: any = null) => {
    const instance: any = {
      _id: new mongoose.Types.ObjectId(),
      schoolId,
      classLevelId: { _id: levelId, name: levelName },
      arm,
      periodId: { _id: periodId },
      faction,
      save: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockImplementation(() => Promise.resolve(instance)),
      toObject: jest.fn().mockReturnValue({
        _id: new mongoose.Types.ObjectId(),
        schoolId,
        classLevelId: { _id: levelId, name: levelName },
        arm,
        periodId: { _id: periodId },
        faction,
      }),
    };
    return instance;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation & Multi-Tenant Security Checks', () => {
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

    it('should reject when session belongs to another school or does not exist', async () => {
      const otherSchoolSessionId = new mongoose.Types.ObjectId().toString();
      const req = mockReq({ name: 'JSS 2', arm: 'Gold', sessionId: otherSchoolSessionId });
      const res = mockRes();

      // ClassLevel found for this school
      (ClassLevel.findOne as jest.Mock).mockResolvedValue({ _id: new mongoose.Types.ObjectId(), name: 'JSS 2' });

      // AcademicSession search scoped to this school returns null (because it belongs to other school)
      (AcademicSession.findOne as jest.Mock).mockResolvedValue(null);
      (Period.findOne as jest.Mock).mockResolvedValue(null);

      await createClass(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'The selected academic session or period does not exist or does not belong to your school',
        })
      );
    });

    it('should reject when given an invalid format for session ID', async () => {
      const req = mockReq({ name: 'JSS 2', arm: 'Gold', sessionId: 'not-a-valid-object-id' });
      const res = mockRes();

      (ClassLevel.findOne as jest.Mock).mockResolvedValue({ _id: new mongoose.Types.ObjectId(), name: 'JSS 2' });

      await createClass(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid academic session or period ID format',
        })
      );
    });

    it('should reject when class level ID belongs to another school', async () => {
      const foreignClassLevelId = new mongoose.Types.ObjectId().toString();
      const req = mockReq({ classLevelId: foreignClassLevelId, arm: 'Gold' });
      const res = mockRes();

      // ClassLevel findOne with addSchoolFilter returns null
      (ClassLevel.findOne as jest.Mock).mockResolvedValue(null);

      await createClass(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'The specified class level does not exist or does not belong to your school',
        })
      );
    });

    it('should reject when no session/period is passed and school has no active period configured', async () => {
      const req = mockReq({ name: 'JSS 2', arm: 'Gold' });
      const res = mockRes();

      (ClassLevel.findOne as jest.Mock).mockResolvedValue({ _id: new mongoose.Types.ObjectId(), name: 'JSS 2' });
      (School.findById as jest.Mock).mockResolvedValue({ _id: schoolId, activePeriodId: null });
      (Period.findOne as jest.Mock).mockResolvedValue(null);

      await createClass(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No academic session was selected, and no active academic period is configured for this school',
        })
      );
    });
  });

  describe('Required Class Creation Scenarios', () => {
    it('1. should successfully create JSS 2 / Gold / 2026/2027 first term', async () => {
      const academicSessionId = new mongoose.Types.ObjectId().toString();
      const firstTermPeriodId = new mongoose.Types.ObjectId();
      const levelId = new mongoose.Types.ObjectId();

      const req = mockReq({
        name: 'JSS 2',
        arm: 'Gold',
        sessionId: academicSessionId,
      });
      const res = mockRes();

      (ClassLevel.findOne as jest.Mock).mockResolvedValue({ _id: levelId, name: 'JSS 2' });

      (AcademicSession.findOne as jest.Mock).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(academicSessionId),
        schoolId,
        year: '2026/2027',
        currentTerm: 'first',
      });

      const sessionObj = { _id: new mongoose.Types.ObjectId(), year: '2026/2027' };
      const termObj = { _id: new mongoose.Types.ObjectId(), name: '1st Term' };

      (Session.findOne as jest.Mock).mockResolvedValue(sessionObj);
      (Term.findOne as jest.Mock).mockResolvedValue(termObj);
      (Period.findOne as jest.Mock).mockResolvedValue({ _id: firstTermPeriodId, isActive: true });

      // No duplicate
      (ClassGroup.findOne as jest.Mock).mockResolvedValue(null);

      const mockInstance = createMockClassInstance(levelId, 'JSS 2', 'Gold', firstTermPeriodId);
      (ClassGroup as unknown as jest.Mock).mockImplementation(() => mockInstance);

      await createClass(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'JSS 2',
          arm: 'Gold',
        })
      );
    });

    it('2. should successfully create JSS 2 / Silver / 2026/2027 first term (same level & period, different arm)', async () => {
      const academicSessionId = new mongoose.Types.ObjectId().toString();
      const firstTermPeriodId = new mongoose.Types.ObjectId();
      const levelId = new mongoose.Types.ObjectId();

      const req = mockReq({
        name: 'JSS 2',
        arm: 'Silver',
        sessionId: academicSessionId,
      });
      const res = mockRes();

      (ClassLevel.findOne as jest.Mock).mockResolvedValue({ _id: levelId, name: 'JSS 2' });
      (AcademicSession.findOne as jest.Mock).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(academicSessionId),
        schoolId,
        year: '2026/2027',
        currentTerm: 'first',
      });

      (Session.findOne as jest.Mock).mockResolvedValue({ _id: new mongoose.Types.ObjectId(), year: '2026/2027' });
      (Term.findOne as jest.Mock).mockResolvedValue({ _id: new mongoose.Types.ObjectId(), name: '1st Term' });
      (Period.findOne as jest.Mock).mockResolvedValue({ _id: firstTermPeriodId, isActive: true });

      // No duplicate for Silver
      (ClassGroup.findOne as jest.Mock).mockResolvedValue(null);

      const mockInstance = createMockClassInstance(levelId, 'JSS 2', 'Silver', firstTermPeriodId);
      (ClassGroup as unknown as jest.Mock).mockImplementation(() => mockInstance);

      await createClass(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'JSS 2',
          arm: 'Silver',
        })
      );
    });

    it('3. should successfully create JSS 2 / Gold / 2026/2027 second term (same level & arm, different period)', async () => {
      const secondTermSessionId = new mongoose.Types.ObjectId().toString();
      const secondTermPeriodId = new mongoose.Types.ObjectId();
      const levelId = new mongoose.Types.ObjectId();

      const req = mockReq({
        name: 'JSS 2',
        arm: 'Gold',
        sessionId: secondTermSessionId,
      });
      const res = mockRes();

      (ClassLevel.findOne as jest.Mock).mockResolvedValue({ _id: levelId, name: 'JSS 2' });
      (AcademicSession.findOne as jest.Mock).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(secondTermSessionId),
        schoolId,
        year: '2026/2027',
        currentTerm: 'second',
      });

      (Session.findOne as jest.Mock).mockResolvedValue({ _id: new mongoose.Types.ObjectId(), year: '2026/2027' });
      (Term.findOne as jest.Mock).mockResolvedValue({ _id: new mongoose.Types.ObjectId(), name: '2nd Term' });
      (Period.findOne as jest.Mock).mockResolvedValue({ _id: secondTermPeriodId, isActive: false });

      // No duplicate in second term period
      (ClassGroup.findOne as jest.Mock).mockResolvedValue(null);

      const mockInstance = createMockClassInstance(levelId, 'JSS 2', 'Gold', secondTermPeriodId);
      (ClassGroup as unknown as jest.Mock).mockImplementation(() => mockInstance);

      await createClass(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'JSS 2',
          arm: 'Gold',
        })
      );
    });

    it('4. should reject duplicate class creation within the same period', async () => {
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

      // Duplicate exists in same period
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

  describe('updateClass Tests', () => {
    it('should update class and reject cross-school or duplicate attempts', async () => {
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

      (ClassLevel.findOne as jest.Mock).mockResolvedValue({ _id: existingClass.classLevelId, name: 'JSS 2' });

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
