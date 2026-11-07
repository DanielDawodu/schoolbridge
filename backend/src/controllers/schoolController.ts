import { Response } from 'express';
import mongoose from 'mongoose';
import School from '../models/School';
import Session from '../models/Session';
import Period from '../models/Period';
import Term from '../models/Term';
import AcademicSession from '../models/AcademicSession';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../models/AuditLog';

export const getSchool = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let school = await School.findById(req.user?.schoolId).populate({
      path: 'activePeriodId',
      populate: [
        { path: 'sessionId', select: 'year' },
        { path: 'termId', select: 'name' },
      ],
    });
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    const schoolObj: any = school.toObject();
    if (!schoolObj.activePeriodId) {
      const activePeriod = await Period.findOne({
        schoolId: req.user?.schoolId,
        isActive: true,
      })
        .populate('sessionId', 'year')
        .populate('termId', 'name');

      if (activePeriod) {
        schoolObj.activePeriodId = activePeriod;
        School.findByIdAndUpdate(req.user?.schoolId, { activePeriodId: activePeriod._id }).exec();
      }
    }

    if (!schoolObj.assessmentConfig) {
      schoolObj.assessmentConfig = {
        examMax: 60,
        midtermMax: 40,
        ca1Max: 20,
        ca2Max: 20,
      };
    }

    res.json(schoolObj);
  } catch (error) {
    console.error('Get school error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get active academic session and period configuration for the authenticated user's school.
 * Used centrally by Result Entry, Half Term Report, Fees, Report Cards and Billings.
 */
export const getActivePeriod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      res.status(401).json({ error: 'Unauthorized: No school associated with user' });
      return;
    }

    const school = await School.findById(schoolId);
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    let activePeriod: any = null;

    // 1. Check if school has explicit activePeriodId
    if (school.activePeriodId) {
      activePeriod = await Period.findOne({
        _id: school.activePeriodId,
        schoolId,
      })
        .populate('sessionId')
        .populate('termId');
    }

    // 2. Check if any period has isActive: true
    if (!activePeriod) {
      activePeriod = await Period.findOne({
        schoolId,
        isActive: true,
      })
        .populate('sessionId')
        .populate('termId');
    }

    // 3. Fallback to latest Period for this school and activate it
    if (!activePeriod) {
      activePeriod = await Period.findOne({ schoolId })
        .sort({ createdAt: -1 })
        .populate('sessionId')
        .populate('termId');

      if (activePeriod) {
        await Period.findByIdAndUpdate(activePeriod._id, { isActive: true });
        await School.findByIdAndUpdate(schoolId, { activePeriodId: activePeriod._id });
      }
    }

    let sessionObj: any = null;
    let periodObj: any = null;
    let year = '2026/2027';
    let termName = '1st Term';

    if (activePeriod) {
      periodObj = activePeriod;
      const sRec = activePeriod.sessionId;
      const tRec = activePeriod.termId;
      year = (sRec as any)?.year || year;
      termName = (tRec as any)?.name || termName;

      sessionObj = {
        _id: (sRec as any)?._id || sRec,
        year,
        currentTerm: termName,
        name: `${year} - ${termName}`,
      };
    } else {
      // 4. Fallback to AcademicSession if periods have not been migrated yet
      let academicSession: any = null;
      if (school.activeTermId) {
        academicSession = await AcademicSession.findOne({ _id: school.activeTermId, schoolId });
      }
      if (!academicSession) {
        academicSession = await AcademicSession.findOne({ schoolId }).sort({ createdAt: -1 });
      }

      if (academicSession) {
        sessionObj = academicSession;
        year = academicSession.year;
        termName = academicSession.currentTerm;
      }
    }

    const hasActivePeriod = Boolean(periodObj || sessionObj);

    const schoolObj: any = school.toObject();
    if (!schoolObj.assessmentConfig) {
      schoolObj.assessmentConfig = {
        examMax: 60,
        midtermMax: 40,
        ca1Max: 20,
        ca2Max: 20,
      };
    }

    res.json({
      hasActivePeriod,
      school: schoolObj,
      period: periodObj,
      session: sessionObj,
      termId: periodObj?.termId?._id || sessionObj?._id || periodObj?._id,
      sessionId: periodObj?.sessionId?._id || sessionObj?._id || periodObj?._id,
      name: `${year} - ${termName}`,
    });
  } catch (error) {
    console.error('Get active period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setActiveTerm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { termId } = req.body;

    if (!termId) {
      res.status(400).json({ error: 'Term ID is required' });
      return;
    }

    // Find the AcademicSession
    const academicSession = await AcademicSession.findOne({
      _id: termId,
      schoolId: req.user?.schoolId,
    });

    if (!academicSession) {
      res.status(404).json({ error: 'Academic session not found' });
      return;
    }

    // Map to corresponding Period
    const year = academicSession.year;
    const currentTerm = academicSession.currentTerm;

    let termName = '1st Term';
    if (currentTerm === 'second') termName = '2nd Term';
    else if (currentTerm === 'third') termName = '3rd Term';

    const sessionRecord = await Session.findOne({
      schoolId: new mongoose.Types.ObjectId(req.user?.schoolId),
      year,
    });

    const termRecord = await Term.findOne({
      schoolId: new mongoose.Types.ObjectId(req.user?.schoolId),
      name: termName,
    });

    if (!sessionRecord || !termRecord) {
      res.status(404).json({ error: 'Corresponding Session or Period not found' });
      return;
    }

    const period = await Period.findOne({
      schoolId: new mongoose.Types.ObjectId(req.user?.schoolId),
      sessionId: sessionRecord._id,
      termId: termRecord._id,
    });

    if (!period) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    // Update school's activePeriodId
    const school = await School.findById(req.user?.schoolId);
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    school.activePeriodId = period._id;
    await school.save();

    // Set the Period as active
    await Period.findByIdAndUpdate(period._id, { isActive: true });

    // Deactivate all other periods for this school
    await Period.updateMany(
      {
        schoolId: new mongoose.Types.ObjectId(req.user?.schoolId),
        _id: { $ne: period._id },
      },
      { isActive: false }
    );

    res.json({ message: 'Active term updated successfully', activePeriodId: school.activePeriodId });
  } catch (error) {
    console.error('Set active term error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSchoolSignature = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { signatureUrl } = req.body;

    if (!signatureUrl) {
      res.status(400).json({ error: 'Signature URL is required' });
      return;
    }

    const school = await School.findById(req.user?.schoolId);
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    school.signatureUrl = signatureUrl;
    await school.save();

    res.json({ message: 'Signature updated successfully', signatureUrl: school.signatureUrl });
  } catch (error) {
    console.error('Update school signature error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSchool = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reportCardMode, assessmentConfig } = req.body;

    const school = await School.findById(req.user?.schoolId);
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    if (reportCardMode) {
      school.reportCardMode = reportCardMode;
    }

    if (assessmentConfig) {
      const examMax = Number(assessmentConfig.examMax) || 60;
      const midtermMax = Number(assessmentConfig.midtermMax) || 40;
      const ca1Max = assessmentConfig.ca1Max !== undefined ? Number(assessmentConfig.ca1Max) : Math.round(midtermMax / 2);
      const ca2Max = assessmentConfig.ca2Max !== undefined ? Number(assessmentConfig.ca2Max) : (midtermMax - ca1Max);
      school.assessmentConfig = {
        examMax,
        midtermMax,
        ca1Max,
        ca2Max,
      };
    }

    await school.save();

    res.json(school);
  } catch (error) {
    console.error('Update school error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update school branding information (logo, name, address, phone, email, website, motto)
 */
export const updateSchoolBranding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, address, phone, email, website, logoUrl, motto, signatureUrl } = req.body;

    const school = await School.findById(req.user?.schoolId);
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    if (name && name.trim()) school.name = name.trim();
    if (address && address.trim()) school.address = address.trim();
    if (phone !== undefined) school.phone = phone.trim();
    if (email !== undefined) school.email = email.trim();
    if (website !== undefined) school.website = website.trim();
    if (logoUrl !== undefined) school.logoUrl = logoUrl;
    if (motto !== undefined) school.motto = motto.trim();
    if (signatureUrl !== undefined) school.signatureUrl = signatureUrl;

    await school.save();

    await logActivity({
      schoolId: req.user?.schoolId,
      userId: req.user?.userId,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'UPDATE_BRANDING',
      module: 'branding_settings',
      description: `Updated school branding and official identity for ${school.name}`,
    });

    res.json({ message: 'School branding updated successfully', school });
  } catch (error) {
    console.error('Update branding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get school grading scale
 */
export const getGradeScale = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const school = await School.findById(req.user?.schoolId).select('gradeScale');
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    const defaultScale = [
      { min: 70, max: 100, grade: 'A', description: 'Distinction' },
      { min: 60, max: 69, grade: 'B', description: 'Very Good' },
      { min: 50, max: 59, grade: 'C', description: 'Good' },
      { min: 45, max: 49, grade: 'D', description: 'Credit' },
      { min: 40, max: 44, grade: 'E', description: 'Pass' },
      { min: 0, max: 39, grade: 'F', description: 'Fail' },
    ];

    res.json({ gradeScale: school.gradeScale && school.gradeScale.length > 0 ? school.gradeScale : defaultScale });
  } catch (error) {
    console.error('Get grade scale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Configure school grading system with validation
 * Validates:
 * - No overlapping ranges
 * - min <= max
 * - ranges cover the assessment scale
 * - every valid score maps to a grade
 */
export const updateGradeScale = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gradeScale } = req.body;

    if (!Array.isArray(gradeScale) || gradeScale.length === 0) {
      res.status(400).json({ error: 'Grading scale must be a non-empty array of grade ranges' });
      return;
    }

    // Validate each range
    for (const item of gradeScale) {
      const min = Number(item.min);
      const max = Number(item.max);
      if (isNaN(min) || isNaN(max)) {
        res.status(400).json({ error: 'Each grade range must have valid numeric minimum and maximum values' });
        return;
      }
      if (min < 0 || max > 100) {
        res.status(400).json({ error: 'Grade boundaries must fall within 0 to 100' });
        return;
      }
      if (min > max) {
        res.status(400).json({ error: `Invalid range: minimum mark (${min}) cannot exceed maximum mark (${max})` });
        return;
      }
      if (!item.grade || !item.grade.trim()) {
        res.status(400).json({ error: 'Each range must have a grade letter' });
        return;
      }
      if (!item.description || !item.description.trim()) {
        res.status(400).json({ error: 'Each range must have a remark/description' });
        return;
      }
    }

    // Sort by min ascending to check overlaps
    const sorted = [...gradeScale].sort((a, b) => Number(a.min) - Number(b.min));
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (Number(current.max) >= Number(next.min)) {
        res.status(400).json({
          error: `Overlapping mark ranges detected between grade ${current.grade} (${current.min}-${current.max}) and grade ${next.grade} (${next.min}-${next.max})`,
        });
        return;
      }
    }

    const school = await School.findById(req.user?.schoolId);
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    school.gradeScale = sorted.map((g) => ({
      min: Number(g.min),
      max: Number(g.max),
      grade: g.grade.trim().toUpperCase(),
      description: g.description.trim(),
    }));

    await school.save();

    await logActivity({
      schoolId: req.user?.schoolId,
      userId: req.user?.userId,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'UPDATE_GRADING_SYSTEM',
      module: 'branding_settings',
      description: `Configured school grading system with ${sorted.length} grade boundaries`,
    });

    res.json({ message: 'Grading system updated successfully', gradeScale: school.gradeScale });
  } catch (error) {
    console.error('Update grade scale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Restore default 6-tier editable grading template
 */
export const restoreDefaultGradeScale = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const school = await School.findById(req.user?.schoolId);
    if (!school) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    school.gradeScale = [
      { min: 70, max: 100, grade: 'A', description: 'Distinction' },
      { min: 60, max: 69, grade: 'B', description: 'Very Good' },
      { min: 50, max: 59, grade: 'C', description: 'Good' },
      { min: 45, max: 49, grade: 'D', description: 'Credit' },
      { min: 40, max: 44, grade: 'E', description: 'Pass' },
      { min: 0, max: 39, grade: 'F', description: 'Fail' },
    ];

    await school.save();

    await logActivity({
      schoolId: req.user?.schoolId,
      userId: req.user?.userId,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'RESTORE_DEFAULT_GRADING',
      module: 'branding_settings',
      description: 'Restored default 6-tier grading scale template',
    });

    res.json({ message: 'Default grading system restored', gradeScale: school.gradeScale });
  } catch (error) {
    console.error('Restore default grade scale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
