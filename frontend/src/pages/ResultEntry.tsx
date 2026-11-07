import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { ClassSelectionGrid } from '../components/ClassSelectionGrid';
import {
  Users,
  Search,
  ArrowLeft,
  CheckCircle,
  Clock,
  Save,
  Copy,
  ChevronRight,
  ShieldAlert,
  Lock,

  AlertCircle,
  RefreshCw,
  Trophy,
  X,
} from 'lucide-react';

interface Subject {
  _id: string;
  name: string;
  code: string;
  ca1Weight?: number;
  ca2Weight?: number;
  examWeight?: number;
}

interface SubjectRegistration {
  _id: string;
  subjectId: Subject;
  assignedTeacherId?: {
    _id: string;
    name?: string;
    fullName?: string;
  };
}

interface ClassGroup {
  _id: string;
  classLevelId?: { _id: string; name: string } | string;
  name?: string;
  arm: string;
  periodId?: { _id: string } | string;
  assignedTeachers?: string[];
  studentCount?: number;
}

interface Student {
  _id: string;
  fullName: string;
  admissionNo: string;
  classId: any;
  photo?: string;
  status?: string;
}

interface SubjectScore {
  subjectId: string;
  subjectName: string;
  ca1: number;
  ca2: number;
  exam: number;
  total: number;
  grade: string;
}

interface AssessmentConfig {
  examMax: number;
  midtermMax: number;
  ca1Max: number;
  ca2Max: number;
}

interface PsychomotorRating {
  trait: string;
  rating: number;
}

interface AffectiveRating {
  trait: string;
  rating: number;
}

const PSYCHOMOTOR_TRAITS = [
  'Handwriting',
  'Games & Sport',
  'Fluency',
  'Handling of Tools',
  'Drawing & Painting',
  'Craft',
];

const AFFECTIVE_TRAITS = [
  'Punctuality',
  'Neatness',
  'Leadership Trait',
  'Honesty',
  'Self Control',
  'Attentiveness in Class',
];

const ResultEntry: React.FC = () => {
  // Navigation / Workflow steps
  const [currentStep, setCurrentStep] = useState<'classes' | 'students' | 'entry'>('classes');

  // Selected Entities
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Data states
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjectRegistrations, setSubjectRegistrations] = useState<SubjectRegistration[]>([]);
  const [subjectScores, setSubjectScores] = useState<Record<string, SubjectScore>>({});

  // Active configuration (strictly centralized from Settings)
  const [activeSession, setActiveSession] = useState<any>(null);
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [hasActiveTerm, setHasActiveTerm] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Assessment config
  const [assessmentConfig, setAssessmentConfig] = useState<AssessmentConfig>({
    examMax: 60,
    midtermMax: 40,
    ca1Max: 20,
    ca2Max: 20,
  });
  const [schoolGradeScale, setSchoolGradeScale] = useState<any[]>([]);

  // Assessment domains & comments
  const [psychomotorSkills, setPsychomotorSkills] = useState<PsychomotorRating[]>([]);
  const [affectiveDomain, setAffectiveDomain] = useState<AffectiveRating[]>([]);
  const [teacherComment, setTeacherComment] = useState<string>('');
  const [headOfSchoolComment, setHeadOfSchoolComment] = useState<string>('');
  const [performanceType, setPerformanceType] = useState<'term' | 'mid-term'>('term');
  const [verificationCode, setVerificationCode] = useState<string>('');

  // Phase 1 Completion & Ranking States
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [completedBy, setCompletedBy] = useState<any>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [classPosition, setClassPosition] = useState<number | null>(null);
  const [classAverage, setClassAverage] = useState<number | null>(null);
  const [studentPercentage, setStudentPercentage] = useState<number | null>(null);
  const [totalMarksObtained, setTotalMarksObtained] = useState<number | null>(null);
  const [totalAvailableMarks, setTotalAvailableMarks] = useState<number | null>(null);

  // Leaderboard modal state
  const [showLeaderboardModal, setShowLeaderboardModal] = useState<boolean>(false);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);

  // Completion tracker map: studentId -> { isComplete, enteredCount, expectedCount, averageScore, verificationCode, percentage, classPosition }
  const [completionMap, setCompletionMap] = useState<Record<string, any>>({});
  const [classProgressMap, setClassProgressMap] = useState<Record<string, { completed: number; total: number }>>({});

  // UI / UX state
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [completing, setCompleting] = useState<boolean>(false);
  const [reopening, setReopening] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filter states
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'completed' | 'pending'>('all');

  // Load user profile, active settings & class lists on mount
  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // Fetch user profile
      const userRes = await api.get('/auth/me');
      setCurrentUser(userRes.data?.user || userRes.data);

      // Fetch school assessment config & active period
      const schoolRes = await api.get('/schools/active-period');
      const schoolData = schoolRes.data;

      if (!schoolData || !schoolData.hasActivePeriod) {
        setHasActiveTerm(false);
        setLoading(false);
        return;
      }

      setHasActiveTerm(true);
      setActiveSession(schoolData.session);
      setActivePeriod(schoolData.period);

      if (schoolData.school?.assessmentConfig) {
        const cfg = schoolData.school.assessmentConfig;
        const examMax = Number(cfg.examMax) || 60;
        const midtermMax = Number(cfg.midtermMax) || 40;
        const ca1Max = cfg.ca1Max !== undefined ? Number(cfg.ca1Max) : Math.round(midtermMax / 2);
        const ca2Max = cfg.ca2Max !== undefined ? Number(cfg.ca2Max) : midtermMax - ca1Max;
        setAssessmentConfig({ examMax, midtermMax, ca1Max, ca2Max });
      }

      if (schoolData.school?.gradeScale) {
        setSchoolGradeScale(schoolData.school.gradeScale);
      }

      // Fetch classes available to user
      const classesRes = await api.get('/classes');
      setClasses(classesRes.data || []);

      // Preload class student count & progress
      const targetPeriodId = schoolData.period?._id || schoolData.session?._id;
      if (targetPeriodId && classesRes.data?.length > 0) {
        loadClassProgressData(classesRes.data, targetPeriodId);
      }
    } catch (err: any) {
      console.error('Failed to initialize Result Entry:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to initialize Result Entry workflow.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to load progress statistics across classes
  const loadClassProgressData = async (classList: ClassGroup[], targetId: string) => {
    const progress: Record<string, { completed: number; total: number }> = {};
    for (const cls of classList) {
      try {
        const trackerRes = await api.get('/results/completion', {
          params: { sessionId: targetId, classId: cls._id, performanceType: 'term' },
        });
        progress[cls._id] = {
          completed: trackerRes.data.completedCount || 0,
          total: trackerRes.data.totalStudents || 0,
        };
      } catch {
        progress[cls._id] = { completed: 0, total: 0 };
      }
    }
    setClassProgressMap(progress);
  };

  // Calculate grade based on score
  const calculateGrade = (total: number): string => {
    const scale = schoolGradeScale.length > 0
      ? schoolGradeScale
      : [
          { min: 70, max: 100, grade: 'A' },
          { min: 60, max: 69, grade: 'B' },
          { min: 50, max: 59, grade: 'C' },
          { min: 40, max: 49, grade: 'D' },
          { min: 0, max: 39, grade: 'F' },
        ];

    for (const item of scale) {
      if (total >= item.min && total <= item.max) {
        return item.grade;
      }
    }
    return 'F';
  };

  // Handle Class Click -> Step 2
  const handleSelectClass = async (cls: ClassGroup) => {
    setSelectedClass(cls);
    setCurrentStep('students');
    setStudentSearch('');
    setStudentFilter('all');

    const targetPeriodId = activePeriod?._id || activeSession?._id;
    await Promise.all([
      loadStudentsForClass(cls._id),
      loadCompletionTracker(cls._id, targetPeriodId),
    ]);
  };

  const getStudentClassId = (student: any): string => {
    if (!student || !student.classId) return '';
    if (typeof student.classId === 'string') return student.classId;
    if (student.classId._id) return student.classId._id.toString();
    return student.classId.toString();
  };

  // Load students for selected class
  const loadStudentsForClass = async (classId: string) => {
    try {
      setLoading(true);
      const res = await api.get('/students');
      const allStudents: Student[] = res.data || [];
      const classStudents = allStudents.filter((s) => {
        const rawClassId = getStudentClassId(s);
        return rawClassId === classId.toString();
      });
      setStudents(classStudents);
    } catch (err) {
      console.error('Failed to load students for class:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load completion tracker for selected class
  const loadCompletionTracker = async (classId: string, targetId: string) => {
    try {
      const res = await api.get('/results/completion', {
        params: {
          sessionId: targetId,
          classId,
          performanceType,
        },
      });

      const map: Record<string, any> = {};
      (res.data?.students || []).forEach((item: any) => {
        map[item.studentId] = item;
      });
      setCompletionMap(map);
    } catch (err) {
      console.error('Failed to load completion tracker:', err);
    }
  };

  // Handle Student Click -> Step 3
  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setCurrentStep('entry');
    setValidationErrors({});
    setSaveSuccess(null);
    setErrorMessage(null);
    await loadStudentData(student._id);
  };

  // Load subjects and scores for selected student
  const loadStudentData = async (studentId: string) => {
    if (!selectedClass) return;

    try {
      setLoading(true);
      const targetPeriodId = activePeriod?._id || activeSession?._id;

      // Fetch registered subjects for this class
      const regRes = await api.get('/subject-registrations/student-subjects', {
        params: {
          classId: selectedClass._id,
          sessionId: targetPeriodId,
        },
      });

      const registrations: SubjectRegistration[] = regRes.data || [];
      setSubjectRegistrations(registrations);

      // Initialize base scores
      const initialScores: Record<string, SubjectScore> = {};
      registrations.forEach((reg) => {
        initialScores[reg.subjectId._id] = {
          subjectId: reg.subjectId._id,
          subjectName: reg.subjectId.name,
          ca1: 0,
          ca2: 0,
          exam: 0,
          total: 0,
          grade: 'F',
        };
      });

      // Default psychomotor & affective domains with rating 3
      setPsychomotorSkills(PSYCHOMOTOR_TRAITS.map((trait) => ({ trait, rating: 3 })));
      setAffectiveDomain(AFFECTIVE_TRAITS.map((trait) => ({ trait, rating: 3 })));
      setTeacherComment('');
      setHeadOfSchoolComment('');
      setVerificationCode('');
      setIsCompleted(false);
      setCompletedBy(null);
      setCompletedAt(null);
      setIsApproved(false);
      setClassPosition(null);
      setClassAverage(null);
      setStudentPercentage(null);
      setTotalMarksObtained(null);
      setTotalAvailableMarks(null);

      // Fetch existing result if available
      try {
        const resultRes = await api.get('/results/student', {
          params: {
            sessionId: targetPeriodId,
            studentId: studentId,
            performanceType,
          },
        });

        if (resultRes.data) {
          const existingData = resultRes.data;
          (existingData.subjectScores || []).forEach((score: SubjectScore) => {
            initialScores[score.subjectId] = score;
          });
          if (existingData.psychomotorSkills?.length) setPsychomotorSkills(existingData.psychomotorSkills);
          if (existingData.affectiveDomain?.length) setAffectiveDomain(existingData.affectiveDomain);
          setTeacherComment(existingData.teacherComment || '');
          setHeadOfSchoolComment(existingData.headOfSchoolComment || '');
          setVerificationCode(existingData.verificationCode || '');

          setIsCompleted(Boolean(existingData.isCompleted));
          setCompletedBy(existingData.completedBy || null);
          setCompletedAt(existingData.completedAt || null);
          setIsApproved(Boolean(existingData.isApproved));
          setClassPosition(existingData.classPosition || null);
          setClassAverage(existingData.classAverage || null);
          setStudentPercentage(existingData.percentage || existingData.averageScore || null);
          setTotalMarksObtained(existingData.totalScore || null);
          setTotalAvailableMarks(existingData.totalAvailableMarks || null);
        }
      } catch {
        // No existing result yet
      }

      setSubjectScores(initialScores);
    } catch (err) {
      console.error('Failed to load student result data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch existing result when performanceType is toggled in score entry
  useEffect(() => {
    if (currentStep === 'entry' && selectedStudent) {
      loadStudentData(selectedStudent._id);
    }
  }, [performanceType]);

  // Handle score input changes with real-time validation
  const handleScoreChange = (subjectId: string, field: 'ca1' | 'ca2' | 'exam', rawValue: string) => {
    if (isCompleted && currentUser?.role !== 'admin') {
      alert('This result has already been completed. An administrator must reopen it before changes can be made.');
      return;
    }

    const errorKey = `${subjectId}_${field}`;
    const newErrors = { ...validationErrors };

    const numValue = rawValue === '' ? 0 : parseInt(rawValue, 10);

    const maxAllowed =
      field === 'ca1'
        ? assessmentConfig.ca1Max
        : field === 'ca2'
        ? assessmentConfig.ca2Max
        : assessmentConfig.examMax;

    if (isNaN(numValue)) {
      newErrors[errorKey] = 'Must be a valid number';
    } else if (numValue < 0) {
      newErrors[errorKey] = 'Score cannot be negative';
    } else if (numValue > maxAllowed) {
      newErrors[errorKey] = `Max allowed is ${maxAllowed}`;
    } else {
      delete newErrors[errorKey];
    }
    setValidationErrors(newErrors);

    const updated = { ...subjectScores };
    const current = { ...(updated[subjectId] || { ca1: 0, ca2: 0, exam: 0, total: 0, grade: 'F' }) };
    current[field] = isNaN(numValue) ? 0 : numValue;

    // Calculate total according to configuration
    const totalMax =
      performanceType === 'mid-term'
        ? assessmentConfig.midtermMax
        : assessmentConfig.ca1Max + assessmentConfig.ca2Max + assessmentConfig.examMax;

    let total = 0;
    if (performanceType === 'mid-term') {
      const caSum = current.ca1 + current.ca2;
      total = assessmentConfig.midtermMax > 0 && assessmentConfig.midtermMax !== 100
        ? Math.round((caSum / assessmentConfig.midtermMax) * 100)
        : caSum;
    } else {
      const sum = current.ca1 + current.ca2 + current.exam;
      total = totalMax > 0 && totalMax !== 100
        ? Math.round((sum / totalMax) * 100)
        : sum;
    }

    current.total = total;
    current.grade = calculateGrade(total);
    updated[subjectId] = current;
    setSubjectScores(updated);
  };

  // Check if current user is authorized to edit a subject
  const canEditSubject = (reg: SubjectRegistration): boolean => {
    if (isCompleted && currentUser?.role !== 'admin') return false;
    if (currentUser?.role === 'admin') return true;
    if (currentUser?.role === 'teacher') {
      const currentUserId = currentUser._id || currentUser.userId;
      const assignedId = reg.assignedTeacherId?._id;
      return assignedId?.toString() === currentUserId?.toString();
    }
    return false;
  };

  // Phase 1: Real-time completion checklist validation
  const completionValidation = useMemo(() => {
    const missingSubjects: string[] = [];
    subjectRegistrations.forEach((reg) => {
      const score = subjectScores[reg.subjectId._id];
      if (!score) {
        missingSubjects.push(reg.subjectId.name);
      } else {
        if (score.ca1 === undefined || score.ca1 === null || isNaN(score.ca1)) {
          missingSubjects.push(`${reg.subjectId.name} (CA1)`);
        }
        if (score.ca2 === undefined || score.ca2 === null || isNaN(score.ca2)) {
          missingSubjects.push(`${reg.subjectId.name} (CA2)`);
        }
        if (performanceType === 'term') {
          if (score.exam === undefined || score.exam === null || isNaN(score.exam)) {
            missingSubjects.push(`${reg.subjectId.name} (Exam)`);
          }
        }
      }
    });

    const isScoresComplete = subjectRegistrations.length > 0 && missingSubjects.length === 0;
    const isAffectiveComplete =
      performanceType === 'mid-term' ||
      (affectiveDomain.length > 0 && affectiveDomain.every((a) => a.rating >= 1 && a.rating <= 5));
    const isPsychomotorComplete =
      performanceType === 'mid-term' ||
      (psychomotorSkills.length > 0 && psychomotorSkills.every((p) => p.rating >= 1 && p.rating <= 5));
    const isTeacherCommentComplete = Boolean(teacherComment && teacherComment.trim().length > 0);
    const hasScoreErrors = Object.keys(validationErrors).length > 0;

    const canComplete =
      isScoresComplete &&
      isAffectiveComplete &&
      isPsychomotorComplete &&
      isTeacherCommentComplete &&
      !hasScoreErrors &&
      !isCompleted;

    return {
      missingSubjects,
      isScoresComplete,
      isAffectiveComplete,
      isPsychomotorComplete,
      isTeacherCommentComplete,
      hasScoreErrors,
      canComplete,
    };
  }, [
    subjectRegistrations,
    subjectScores,
    performanceType,
    affectiveDomain,
    psychomotorSkills,
    teacherComment,
    validationErrors,
    isCompleted,
  ]);

  // Save draft results
  const handleSaveDraft = async () => {
    if (Object.keys(validationErrors).length > 0) {
      alert('Please fix all invalid scores before saving.');
      return;
    }

    if (!selectedStudent || !selectedClass) return;

    try {
      setSaving(true);
      setErrorMessage(null);
      setSaveSuccess(null);

      const targetPeriodId = activePeriod?._id || (typeof activePeriod === 'string' ? activePeriod : undefined);

      const scoresToSubmit = Object.values(subjectScores).filter((score) => {
        if (currentUser?.role === 'admin') return true;
        const reg = subjectRegistrations.find((r) => r.subjectId._id === score.subjectId);
        return reg ? canEditSubject(reg) : false;
      });

      const payload = {
        sessionId: targetPeriodId,
        studentId: selectedStudent._id,
        subjectScores: scoresToSubmit,
        psychomotorSkills: performanceType === 'term' ? psychomotorSkills : [],
        affectiveDomain: performanceType === 'term' ? affectiveDomain : [],
        teacherComment,
        headOfSchoolComment: currentUser?.role === 'admin' ? headOfSchoolComment : undefined,
        performanceType,
      };

      const res = await api.post('/results/save', payload);

      if (res.data?.verificationCode) {
        setVerificationCode(res.data.verificationCode);
      }
      setSaveSuccess('Draft result saved successfully!');
      setTimeout(() => setSaveSuccess(null), 4000);

      // Refresh completion tracker
      loadCompletionTracker(selectedClass._id, targetPeriodId);
    } catch (err: any) {
      console.error('Save draft error:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to save student result.');
    } finally {
      setSaving(false);
    }
  };

  // Phase 1: Complete Result Action
  const handleCompleteResult = async () => {
    if (!completionValidation.canComplete) {
      alert('Please satisfy all completion requirements before completing the result.');
      return;
    }

    if (!selectedStudent || !selectedClass) return;

    try {
      setCompleting(true);
      setErrorMessage(null);
      setSaveSuccess(null);

      const targetPeriodId = activePeriod?._id || (typeof activePeriod === 'string' ? activePeriod : undefined);

      const payload = {
        sessionId: targetPeriodId,
        studentId: selectedStudent._id,
        classId: selectedClass._id,
        performanceType,
        subjectScores: Object.values(subjectScores),
        psychomotorSkills: performanceType === 'term' ? psychomotorSkills : [],
        affectiveDomain: performanceType === 'term' ? affectiveDomain : [],
        teacherComment,
      };

      const res = await api.post('/results/complete', payload);

      setIsCompleted(true);
      setCompletedAt(res.data.result?.completedAt || new Date().toISOString());
      setClassPosition(res.data.classPosition || res.data.result?.classPosition);
      setClassAverage(res.data.classAverage || res.data.result?.classAverage);
      setStudentPercentage(res.data.percentage || res.data.result?.percentage);
      setTotalMarksObtained(res.data.result?.totalScore || null);
      setTotalAvailableMarks(res.data.result?.totalAvailableMarks || null);
      if (res.data.result?.verificationCode) {
        setVerificationCode(res.data.result.verificationCode);
      }

      setSaveSuccess('Result officially COMPLETED! Class ranking and positions have been automatically computed.');

      // Refresh tracker
      loadCompletionTracker(selectedClass._id, targetPeriodId);
    } catch (err: any) {
      console.error('Complete result error:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to complete result.');
    } finally {
      setCompleting(false);
    }
  };

  // Reopen result for editing (Admin only)
  const handleReopenResult = async () => {
    if (!selectedStudent || !selectedClass) return;
    if (!window.confirm('Reopen this completed result for editing? Completion will be required again after making changes.')) {
      return;
    }

    try {
      setReopening(true);
      setErrorMessage(null);
      setSaveSuccess(null);

      const targetPeriodId = activePeriod?._id || (typeof activePeriod === 'string' ? activePeriod : undefined);

      await api.post('/results/reopen', {
        studentId: selectedStudent._id,
        sessionId: targetPeriodId,
        performanceType,
      });

      setIsCompleted(false);
      setClassPosition(null);
      setSaveSuccess('Result reopened for editing. You can now modify scores and re-complete.');
      loadCompletionTracker(selectedClass._id, targetPeriodId);
    } catch (err: any) {
      console.error('Reopen result error:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to reopen result.');
    } finally {
      setReopening(false);
    }
  };

  // Open class leaderboard modal
  const handleOpenLeaderboard = async () => {
    if (!selectedClass) return;
    try {
      setShowLeaderboardModal(true);
      setLoadingLeaderboard(true);
      const targetPeriodId = activePeriod?._id || activeSession?._id;

      const res = await api.get('/results/leaderboard', {
        params: {
          classId: selectedClass._id,
          sessionId: targetPeriodId,
          performanceType,
        },
      });
      setLeaderboardData(res.data);
    } catch (err: any) {
      console.error('Failed to load leaderboard:', err);
      alert(err.response?.data?.error || 'Failed to load class leaderboard.');
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.admissionNo.toLowerCase().includes(studentSearch.toLowerCase());

      const cItem = completionMap[s._id];
      const isComplete = cItem?.isComplete;

      if (studentFilter === 'completed') return matchSearch && isComplete;
      if (studentFilter === 'pending') return matchSearch && !isComplete;
      return matchSearch;
    });
  }, [students, studentSearch, completionMap, studentFilter]);

  // If active period is not configured, show blocker alert
  if (!loading && !hasActiveTerm) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg shadow-sm">
          <div className="flex items-start">
            <ShieldAlert className="h-7 w-7 text-amber-500 mr-4 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-bold text-amber-900">Active Academic Session & Term Required</h2>
              <p className="mt-2 text-sm text-amber-800 leading-relaxed">
                Result Entry requires an active academic session and current term to be configured centrally in Settings.
                Currently, no active term is configured for your school.
              </p>
              {currentUser?.role === 'admin' ? (
                <div className="mt-4">
                  <a
                    href="/settings"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md shadow-xs text-white bg-amber-600 hover:bg-amber-700"
                  >
                    Go to Settings to Configure Active Term →
                  </a>
                </div>
              ) : (
                <p className="mt-3 text-xs text-amber-700 font-medium italic">
                  Please contact the School Administrator to set the current term before entering results.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Result Entry</h1>
          <p className="text-sm text-gray-500 mt-1">
            {currentStep === 'classes' && 'Select a class to manage and submit student academic results.'}
            {currentStep === 'students' && selectedClass && (
              <>
                Class:{' '}
                <strong className="text-indigo-600">
                  {typeof selectedClass.classLevelId === 'object' ? selectedClass.classLevelId.name : selectedClass.name} - {selectedClass.arm}
                </strong>
                {' '}• Select a student to enter scores
              </>
            )}
            {currentStep === 'entry' && selectedStudent && (
              <>
                Entering results for <strong className="text-indigo-600">{selectedStudent.fullName}</strong> ({selectedStudent.admissionNo})
              </>
            )}
          </p>
        </div>

        {/* Central Active Period Badge */}
        {hasActiveTerm && activeSession && (
          <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3.5 py-1.5 rounded-full text-xs font-semibold self-start sm:self-auto shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              Active Period: {activeSession.year} · Term {activeSession.currentTerm}
            </span>
          </div>
        )}
      </div>

      {/* Global Alerts */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex items-center shadow-xs">
          <CheckCircle className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0" />
          <span className="text-sm font-medium">{saveSuccess}</span>
        </div>
      )}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg flex items-center shadow-xs">
          <AlertCircle className="h-5 w-5 text-rose-500 mr-3 flex-shrink-0" />
          <span className="text-sm font-medium">{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: CLASS SELECTION */}
      {/* ========================================================================= */}
      {currentStep === 'classes' && (
        <ClassSelectionGrid
          classes={classes}
          loading={loading}
          error={errorMessage}
          onRetry={initPage}
          onSelectClass={handleSelectClass}
          actionText="Open class students"
          renderProgressOrMeta={(cls) => {
            const progress = classProgressMap[cls._id] || { completed: 0, total: 0 };
            const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
            return (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                  <span>Completion Progress</span>
                  <span className="font-semibold text-indigo-600">{percent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>
            );
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* STEP 2: STUDENT SELECTION IN CLASS */}
      {/* ========================================================================= */}
      {currentStep === 'students' && selectedClass && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setCurrentStep('classes');
                  setSelectedClass(null);
                }}
                className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-indigo-600"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Change Class
              </button>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500">
                Class:{' '}
                <strong className="text-gray-800">
                  {typeof selectedClass.classLevelId === 'object' ? selectedClass.classLevelId.name : selectedClass.name} - {selectedClass.arm}
                </strong>
              </span>
            </div>

            <button
              onClick={handleOpenLeaderboard}
              className="inline-flex items-center px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              <Trophy className="h-3.5 w-3.5 mr-1.5" />
              Class Leaderboard & Rankings
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search student by name or admission no..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStudentFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                  studentFilter === 'all'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                All ({students.length})
              </button>
              <button
                onClick={() => setStudentFilter('completed')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                  studentFilter === 'completed'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setStudentFilter('pending')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                  studentFilter === 'pending'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Pending
              </button>
            </div>
          </div>

          {/* Students Table */}
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
              <p>Loading class students...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="bg-white border rounded-lg p-10 text-center text-gray-500">
              <Users className="h-10 w-10 mx-auto text-gray-400 mb-2" />
              <p className="font-semibold text-gray-700">No students found</p>
              <p className="text-xs mt-1">There are no active students in this class matching your filter.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left">Student Name</th>
                    <th className="px-5 py-3 text-left">Admission No</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Position</th>
                    <th className="px-5 py-3 text-left">Overall %</th>
                    <th className="px-5 py-3 text-left">Verification Code</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStudents.map((student) => {
                    const cInfo = completionMap[student._id];
                    const isComplete = Boolean(cInfo?.isComplete);
                    const position = cInfo?.classPosition;
                    const percent = cInfo?.percentage || cInfo?.averageScore;
                    const vCode = cInfo?.verificationCode;

                    return (
                      <tr
                        key={student._id}
                        onClick={() => handleSelectStudent(student)}
                        className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs mr-3">
                              {student.fullName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{student.fullName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono text-gray-600">
                          {student.admissionNo}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {isComplete ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle className="h-3 w-3 mr-1 text-emerald-600" /> Completed
                            </span>
                          ) : cInfo?.enteredCount > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              <Clock className="h-3 w-3 mr-1 text-amber-600" /> In Progress ({cInfo.enteredCount}/{cInfo.expectedCount})
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                              Not Started
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-bold text-gray-800">
                          {isComplete && position ? `#${position}` : '—'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-800">
                          {isComplete && percent !== undefined ? `${percent}%` : '—'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono text-gray-500">
                          {vCode || '—'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm">
                          <button
                            type="button"
                            className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs inline-flex items-center"
                          >
                            Enter Scores <ChevronRight className="h-3 w-3 ml-0.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: SCORE ENTRY & COMPLETION */}
      {/* ========================================================================= */}
      {currentStep === 'entry' && selectedStudent && selectedClass && (
        <div className="space-y-6">
          {/* Top Bar with Navigation & Assessment Type Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
            <button
              onClick={() => {
                setCurrentStep('students');
                setSelectedStudent(null);
              }}
              className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-indigo-600"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Students
            </button>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-medium">Performance Type:</span>
              <div className="inline-flex rounded-md shadow-xs">
                <button
                  type="button"
                  onClick={() => setPerformanceType('term')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-l-md border ${
                    performanceType === 'term'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Full Term
                </button>
                <button
                  type="button"
                  onClick={() => setPerformanceType('mid-term')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-r-md border ${
                    performanceType === 'mid-term'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Mid-Term
                </button>
              </div>
            </div>
          </div>

          {/* Student Profile Card */}
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center">
              {selectedStudent.photo ? (
                <img
                  src={selectedStudent.photo}
                  alt={selectedStudent.fullName}
                  className="h-14 w-14 rounded-full object-cover mr-4 border"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg mr-4">
                  {selectedStudent.fullName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">{selectedStudent.fullName}</h2>
                  {isCompleted ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                      <Clock className="h-3.5 w-3.5 mr-1 text-amber-600" /> In Progress
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span>
                    Admission No: <strong className="font-mono text-gray-700">{selectedStudent.admissionNo}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Class:{' '}
                    <strong className="text-gray-700">
                      {typeof selectedClass.classLevelId === 'object' ? selectedClass.classLevelId.name : selectedClass.name} - {selectedClass.arm}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
              {isCompleted && classPosition && (
                <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-900">
                  Rank: <span className="text-indigo-600 font-bold">#{classPosition}</span> | Overall: <span className="text-indigo-600 font-bold">{studentPercentage}%</span>
                </div>
              )}
              {verificationCode && (
                <div className="inline-flex items-center space-x-2 bg-gray-50 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold">
                  <span>Code: {verificationCode}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(verificationCode);
                      alert('Verification code copied!');
                    }}
                    className="p-1 hover:bg-gray-200 rounded text-gray-600"
                    title="Copy code"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Completed Result Banner */}
          {isCompleted && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-emerald-600 mr-2.5 flex-shrink-0" />
                <div className="text-xs text-emerald-900">
                  <p className="font-bold">
                    This student result has been completed.{isApproved && ' (Approved)'}
                  </p>
                  <p className="text-emerald-700 mt-0.5">
                    Completed on {completedAt ? new Date(completedAt).toLocaleDateString() : 'N/A'}
                    {completedBy ? ` by ${completedBy.name || completedBy.fullName || 'Teacher'}` : ''}.
                    {classPosition ? ` Position: #${classPosition} | Class Average: ${classAverage}%` : ''}
                    {totalMarksObtained !== null && totalAvailableMarks !== null
                      ? ` | Score: ${totalMarksObtained}/${totalAvailableMarks}`
                      : ''}
                  </p>
                </div>
              </div>

              {currentUser?.role === 'admin' && (
                <button
                  type="button"
                  onClick={handleReopenResult}
                  disabled={reopening}
                  className="px-3.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold rounded-md shadow-2xs self-start sm:self-auto cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 inline" />
                  {reopening ? 'Reopening...' : 'Reopen for Corrections'}
                </button>
              )}
            </div>
          )}

          {/* Subject Scores Table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-md font-bold text-gray-900">
                  Subject Scores {performanceType === 'mid-term' ? '(Mid-Term Assessment)' : '(Term Examination)'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Dynamic assessment limits: CA1 (Max {assessmentConfig.ca1Max}), CA2 (Max {assessmentConfig.ca2Max})
                  {performanceType === 'term' ? `, Exam (Max ${assessmentConfig.examMax})` : ''}
                </p>
              </div>
              {currentUser?.role === 'teacher' && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
                  You can only modify scores for subjects assigned to you.
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading subjects...</div>
            ) : subjectRegistrations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No subjects registered for this class in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Subject</th>
                      <th className="px-4 py-3 text-left">Assigned Teacher</th>
                      <th className="px-4 py-3 text-left">CA 1 ({assessmentConfig.ca1Max})</th>
                      <th className="px-4 py-3 text-left">CA 2 ({assessmentConfig.ca2Max})</th>
                      {performanceType === 'term' && (
                        <th className="px-4 py-3 text-left">Exam ({assessmentConfig.examMax})</th>
                      )}
                      <th className="px-4 py-3 text-left">Total (%)</th>
                      <th className="px-4 py-3 text-left">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {subjectRegistrations.map((reg) => {
                      const subjectId = reg.subjectId._id;
                      const score = subjectScores[subjectId] || {
                        subjectId,
                        subjectName: reg.subjectId.name,
                        ca1: 0,
                        ca2: 0,
                        exam: 0,
                        total: 0,
                        grade: 'F',
                      };

                      const editable = canEditSubject(reg);
                      const ca1Error = validationErrors[`${subjectId}_ca1`];
                      const ca2Error = validationErrors[`${subjectId}_ca2`];
                      const examError = validationErrors[`${subjectId}_exam`];

                      const teacherName = reg.assignedTeacherId?.fullName || reg.assignedTeacherId?.name || 'Unassigned';

                      return (
                        <tr key={subjectId} className={editable ? '' : 'bg-gray-50/70'}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-semibold text-gray-900">{reg.subjectId.name}</span>
                            {!editable && (
                              <span className="ml-2 inline-flex items-center text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                <Lock className="h-2.5 w-2.5 mr-0.5" /> Read-Only
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                            {teacherName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col">
                              <input
                                type="number"
                                min="0"
                                max={assessmentConfig.ca1Max}
                                disabled={!editable}
                                value={score.ca1}
                                onChange={(e) => handleScoreChange(subjectId, 'ca1', e.target.value)}
                                className={`w-20 px-2 py-1 text-sm border rounded ${
                                  ca1Error ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300'
                                } disabled:bg-gray-100 disabled:text-gray-500`}
                              />
                              {ca1Error && <span className="text-[10px] text-red-600 mt-0.5">{ca1Error}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col">
                              <input
                                type="number"
                                min="0"
                                max={assessmentConfig.ca2Max}
                                disabled={!editable}
                                value={score.ca2}
                                onChange={(e) => handleScoreChange(subjectId, 'ca2', e.target.value)}
                                className={`w-20 px-2 py-1 text-sm border rounded ${
                                  ca2Error ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300'
                                } disabled:bg-gray-100 disabled:text-gray-500`}
                              />
                              {ca2Error && <span className="text-[10px] text-red-600 mt-0.5">{ca2Error}</span>}
                            </div>
                          </td>
                          {performanceType === 'term' && (
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex flex-col">
                                <input
                                  type="number"
                                  min="0"
                                  max={assessmentConfig.examMax}
                                  disabled={!editable}
                                  value={score.exam}
                                  onChange={(e) => handleScoreChange(subjectId, 'exam', e.target.value)}
                                  className={`w-20 px-2 py-1 text-sm border rounded ${
                                    examError ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300'
                                  } disabled:bg-gray-100 disabled:text-gray-500`}
                                />
                                {examError && <span className="text-[10px] text-red-600 mt-0.5">{examError}</span>}
                              </div>
                            </td>
                          )}
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                            {score.total}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold">
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                score.grade === 'A'
                                  ? 'bg-green-100 text-green-800'
                                  : score.grade === 'B'
                                  ? 'bg-blue-100 text-blue-800'
                                  : score.grade === 'C'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : score.grade === 'D'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {score.grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Psychomotor & Affective Domains (Full Term Only) */}
          {performanceType === 'term' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
                <h3 className="text-md font-bold text-gray-900 mb-3">Psychomotor Skills (Scale: 1-5)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {psychomotorSkills.map((item, index) => (
                    <div key={item.trait} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-xs font-medium text-gray-700">{item.trait}</span>
                      <select
                        disabled={isCompleted && currentUser?.role !== 'admin'}
                        value={item.rating}
                        onChange={(e) => {
                          const updated = [...psychomotorSkills];
                          updated[index].rating = parseInt(e.target.value);
                          setPsychomotorSkills(updated);
                        }}
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white disabled:bg-gray-100"
                      >
                        {[1, 2, 3, 4, 5].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
                <h3 className="text-md font-bold text-gray-900 mb-3">Affective Domain (Scale: 1-5)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {affectiveDomain.map((item, index) => (
                    <div key={item.trait} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-xs font-medium text-gray-700">{item.trait}</span>
                      <select
                        disabled={isCompleted && currentUser?.role !== 'admin'}
                        value={item.rating}
                        onChange={(e) => {
                          const updated = [...affectiveDomain];
                          updated[index].rating = parseInt(e.target.value);
                          setAffectiveDomain(updated);
                        }}
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white disabled:bg-gray-100"
                      >
                        {[1, 2, 3, 4, 5].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Teacher's Remark / Comment (Required for completion)</h3>
              <textarea
                disabled={isCompleted && currentUser?.role !== 'admin'}
                rows={3}
                placeholder="Enter teacher remark regarding student progress..."
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              />
            </div>

            {currentUser?.role === 'admin' && (
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Head of School's Comment (Admin Only)</h3>
                <textarea
                  rows={3}
                  placeholder="Enter principal / head of school remark..."
                  value={headOfSchoolComment}
                  onChange={(e) => setHeadOfSchoolComment(e.target.value)}
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Phase 1: Completion Requirements Status Box */}
          {!isCompleted && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2.5">
                Result Completion Checklist (All items required before completing)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className={`flex items-center gap-2 p-2 rounded ${completionValidation.isScoresComplete ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  {completionValidation.isScoresComplete ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
                  <span>Scores: {completionValidation.isScoresComplete ? 'All subjects entered' : `${completionValidation.missingSubjects.length} missing`}</span>
                </div>

                {performanceType === 'term' && (
                  <>
                    <div className={`flex items-center gap-2 p-2 rounded ${completionValidation.isPsychomotorComplete ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                      {completionValidation.isPsychomotorComplete ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
                      <span>Psychomotor: {completionValidation.isPsychomotorComplete ? 'All rated' : 'Incomplete'}</span>
                    </div>

                    <div className={`flex items-center gap-2 p-2 rounded ${completionValidation.isAffectiveComplete ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                      {completionValidation.isAffectiveComplete ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
                      <span>Affective: {completionValidation.isAffectiveComplete ? 'All rated' : 'Incomplete'}</span>
                    </div>
                  </>
                )}

                <div className={`flex items-center gap-2 p-2 rounded ${completionValidation.isTeacherCommentComplete ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  {completionValidation.isTeacherCommentComplete ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
                  <span>Teacher's Comment: {completionValidation.isTeacherCommentComplete ? 'Provided' : 'Required'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setCurrentStep('students');
                setSelectedStudent(null);
              }}
              className="px-4 py-2 border border-gray-300 text-xs font-semibold rounded-md text-gray-700 hover:bg-gray-50 self-start sm:self-auto cursor-pointer"
            >
              Back to Student List
            </button>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              {!isCompleted && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving || Object.keys(validationErrors).length > 0}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-md shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
              )}

              <button
                type="button"
                onClick={handleCompleteResult}
                disabled={!completionValidation.canComplete || completing || isCompleted}
                className="inline-flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title={!completionValidation.canComplete ? 'Complete all required subject scores, domains and teacher comment to enable' : 'Mark result as completed and compute class rankings'}
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                {completing ? 'Completing...' : isCompleted ? 'Result Completed' : 'Complete Result'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEADERBOARD MODAL (Phase 2 & Phase 5) */}
      {/* ========================================================================= */}
      {showLeaderboardModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Trophy className="h-6 w-6 text-amber-300" />
                <div>
                  <h3 className="text-lg font-bold">Class Academic Leaderboard</h3>
                  <p className="text-xs text-indigo-200">
                    {selectedClass ? `${typeof selectedClass.classLevelId === 'object' ? selectedClass.classLevelId.name : selectedClass.name} - ${selectedClass.arm}` : ''} · Official Competition Ranking
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLeaderboardModal(false)}
                className="text-indigo-200 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {loadingLeaderboard ? (
                <div className="py-12 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                  <p className="text-xs">Calculating class positions and rankings...</p>
                </div>
              ) : !leaderboardData || leaderboardData.leaderboard?.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  <Trophy className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                  <p className="font-bold text-gray-700">No completed results yet</p>
                  <p className="text-xs mt-1 text-gray-500">
                    Students will appear on the published leaderboard once their teacher completes their result sheet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-3 gap-4 bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 text-center">
                    <div>
                      <p className="text-xs text-indigo-600 font-medium">Eligible Ranked Students</p>
                      <p className="text-xl font-bold text-indigo-950">{leaderboardData.completedStudentsCount} / {leaderboardData.totalStudentsInClass}</p>
                    </div>
                    <div>
                      <p className="text-xs text-indigo-600 font-medium">Class Average Percentage</p>
                      <p className="text-xl font-bold text-indigo-950">{leaderboardData.classAveragePercentage}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-indigo-600 font-medium">Ranking Rule</p>
                      <p className="text-xs font-semibold text-indigo-900 mt-1">Competition (1st, 1st, 3rd)</p>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 font-semibold text-gray-500 sticky top-0">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Rank</th>
                          <th className="px-4 py-2.5 text-left">Student Name</th>
                          <th className="px-4 py-2.5 text-left">Admission No</th>
                          <th className="px-4 py-2.5 text-right">Marks</th>
                          <th className="px-4 py-2.5 text-right">Overall %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {leaderboardData.leaderboard.map((item: any) => (
                          <tr key={item.studentId} className={item.position === 1 ? 'bg-amber-50/40 font-semibold' : ''}>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full font-bold text-xs ${
                                item.position === 1 ? 'bg-amber-100 text-amber-800' :
                                item.position === 2 ? 'bg-slate-200 text-slate-800' :
                                item.position === 3 ? 'bg-amber-200/60 text-amber-900' : 'text-gray-700'
                              }`}>
                                {item.position}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-gray-900 font-medium">
                              {item.fullName}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap font-mono text-gray-500">
                              {item.admissionNo}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-right text-gray-700 font-medium">
                              {item.totalScore} / {item.totalAvailableMarks}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-right text-indigo-700 font-bold">
                              {item.overallPercentage}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-right">
              <button
                onClick={() => setShowLeaderboardModal(false)}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultEntry;
