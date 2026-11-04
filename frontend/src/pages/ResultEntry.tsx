import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import {
  BookOpen,
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
  UserCheck
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
  classId: string;
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

const GRADE_SCALE = [
  { min: 70, max: 100, grade: 'A' },
  { min: 60, max: 69, grade: 'B' },
  { min: 50, max: 59, grade: 'C' },
  { min: 40, max: 49, grade: 'D' },
  { min: 0, max: 39, grade: 'F' },
];

const calculateGrade = (score: number): string => {
  for (const { min, max, grade } of GRADE_SCALE) {
    if (score >= min && score <= max) {
      return grade;
    }
  }
  return 'F';
};

const ResultEntry: React.FC = () => {
  // Navigation step: 'classes' -> 'students' -> 'entry'
  const [currentStep, setCurrentStep] = useState<'classes' | 'students' | 'entry'>('classes');

  // School & Active Period Context
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [activeSessionYear, setActiveSessionYear] = useState<string>('');
  const [activeTermName, setActiveTermName] = useState<string>('');
  const [assessmentConfig, setAssessmentConfig] = useState<AssessmentConfig>({
    examMax: 60,
    midtermMax: 40,
    ca1Max: 20,
    ca2Max: 20,
  });
  const [hasActiveTerm, setHasActiveTerm] = useState<boolean>(true);

  // Class Selection state
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classSearch, setClassSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);

  // Student Selection state
  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [completionMap, setCompletionMap] = useState<Record<string, any>>({});
  const [studentFilter, setStudentFilter] = useState<'all' | 'completed' | 'pending'>('all');

  // Result Entry state
  const [performanceType, setPerformanceType] = useState<'mid-term' | 'term'>('term');
  const [subjectRegistrations, setSubjectRegistrations] = useState<SubjectRegistration[]>([]);
  const [subjectScores, setSubjectScores] = useState<Record<string, SubjectScore>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [psychomotorSkills, setPsychomotorSkills] = useState<PsychomotorRating[]>([]);
  const [affectiveDomain, setAffectiveDomain] = useState<AffectiveRating[]>([]);
  const [teacherComment, setTeacherComment] = useState('');
  const [headOfSchoolComment, setHeadOfSchoolComment] = useState('');
  const [verificationCode, setVerificationCode] = useState<string>('');

  // Loading & notification states
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initial load: current user, active period from Settings/School, and classes
  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // Fetch user profile
      const userRes = await api.get('/auth/me');
      setCurrentUser(userRes.data);

      // Fetch school info for active period and assessmentConfig
      const schoolRes = await api.get('/schools/me');
      const school = schoolRes.data;

      if (school.assessmentConfig) {
        setAssessmentConfig({
          examMax: school.assessmentConfig.examMax ?? 60,
          midtermMax: school.assessmentConfig.midtermMax ?? 40,
          ca1Max: school.assessmentConfig.ca1Max ?? 20,
          ca2Max: school.assessmentConfig.ca2Max ?? 20,
        });
      }

      if (school.activePeriodId) {
        setActivePeriod(school.activePeriodId);
        const periodObj = school.activePeriodId;
        const year = typeof periodObj.sessionId === 'object' ? periodObj.sessionId.year : '';
        const term = typeof periodObj.termId === 'object' ? periodObj.termId.name : '';
        setActiveSessionYear(year);
        setActiveTermName(term);
        setHasActiveTerm(true);
      } else {
        // Fallback: check /periods to see if an active one exists
        try {
          const periodsRes = await api.get('/periods');
          const activeP = (periodsRes.data || []).find((p: any) => p.isActive);
          if (activeP) {
            setActivePeriod(activeP);
            const year = typeof activeP.sessionId === 'object' ? activeP.sessionId.year : '';
            const term = typeof activeP.termId === 'object' ? activeP.termId.name : '';
            setActiveSessionYear(year);
            setActiveTermName(term);
            setHasActiveTerm(true);
          } else {
            setHasActiveTerm(false);
          }
        } catch {
          setHasActiveTerm(false);
        }
      }

      // Fetch classes available to this user (backend handles role-based filtering)
      const classesRes = await api.get('/classes');
      setClasses(classesRes.data || []);
    } catch (err: any) {
      console.error('Initialization error:', err);
      setErrorMessage('Failed to initialize page data.');
    } finally {
      setLoading(false);
    }
  };

  // When a class is selected, fetch students and completion info
  const handleSelectClass = async (cls: ClassGroup) => {
    setSelectedClass(cls);
    setCurrentStep('students');
    setStudentSearch('');
    try {
      setLoading(true);
      const [studentsRes, completionRes] = await Promise.all([
        api.get('/students', { params: { classId: cls._id } }),
        api.get('/results/completion', {
          params: {
            classId: cls._id,
            periodId: activePeriod?._id || (typeof activePeriod === 'string' ? activePeriod : undefined),
            performanceType,
          },
        }).catch(() => ({ data: { students: [] } })),
      ]);

      const classStudents = (studentsRes.data || []).filter(
        (s: Student) => s.classId?.toString() === cls._id.toString() && (s.status === 'active' || !s.status)
      );
      setStudents(classStudents);

      const cMap: Record<string, any> = {};
      (completionRes.data?.students || []).forEach((item: any) => {
        cMap[item.studentId] = item;
      });
      setCompletionMap(cMap);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  // When a student is selected, load subject registrations and existing result
  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setCurrentStep('entry');
    setSaveSuccess(null);
    setValidationErrors({});
    await loadStudentData(student._id);
  };

  const loadStudentData = async (studentId: string) => {
    if (!selectedClass) return;
    try {
      setLoading(true);
      const targetPeriodId = activePeriod?._id || (typeof activePeriod === 'string' ? activePeriod : undefined);

      // Fetch registered subjects for this class
      const regRes = await api.get('/subject-registrations/student-subjects', {
        params: {
          sessionId: targetPeriodId,
          studentId: studentId,
          classId: selectedClass._id,
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

      // Initialize psychomotor & affective domains with default neutral rating (3)
      setPsychomotorSkills(PSYCHOMOTOR_TRAITS.map((trait) => ({ trait, rating: 3 })));
      setAffectiveDomain(AFFECTIVE_TRAITS.map((trait) => ({ trait, rating: 3 })));
      setTeacherComment('');
      setHeadOfSchoolComment('');
      setVerificationCode('');

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
        }
      } catch {
        // No existing result is fine
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
    const errorKey = `${subjectId}_${field}`;
    const newErrors = { ...validationErrors };

    // Empty input handling: allow empty typing, but treat as 0 for calculation
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
    if (currentUser?.role === 'admin') return true;
    if (currentUser?.role === 'teacher') {
      const currentUserId = currentUser._id || currentUser.userId;
      const assignedId = reg.assignedTeacherId?._id;
      return assignedId?.toString() === currentUserId?.toString();
    }
    return false;
  };

  // Save results
  const handleSave = async () => {
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

      // Only submit editable scores if teacher, or all if admin
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
      setSaveSuccess('Result saved successfully!');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      console.error('Save result error:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to save student result.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      const name = typeof cls.classLevelId === 'object' ? cls.classLevelId.name : cls.name || '';
      const arm = cls.arm || '';
      const full = `${name} ${arm}`.toLowerCase();
      const teachers = (cls.assignedTeachers || []).join(' ').toLowerCase();
      return full.includes(classSearch.toLowerCase()) || teachers.includes(classSearch.toLowerCase());
    });
  }, [classes, classSearch]);

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
                Result Entry requires an active academic session and current term to be configured centrally by the school administrator.
                Currently, no active term is configured for your school.
              </p>
              {currentUser?.role === 'admin' ? (
                <div className="mt-4">
                  <a
                    href="/settings"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Go to Settings to Configure Active Term
                  </a>
                </div>
              ) : (
                <p className="mt-3 text-xs text-amber-700 font-medium">
                  Please notify your school administrator to configure the active session and term in Settings.
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
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <nav className="flex items-center space-x-2 text-xs text-gray-500 mb-1">
            <button
              onClick={() => {
                setCurrentStep('classes');
                setSelectedClass(null);
                setSelectedStudent(null);
              }}
              className={`hover:text-indigo-600 font-medium ${currentStep === 'classes' ? 'text-indigo-600 font-bold' : ''}`}
            >
              Classes
            </button>
            {selectedClass && (
              <>
                <ChevronRight className="h-3 w-3 text-gray-400" />
                <button
                  onClick={() => {
                    setCurrentStep('students');
                    setSelectedStudent(null);
                  }}
                  className={`hover:text-indigo-600 font-medium ${currentStep === 'students' ? 'text-indigo-600 font-bold' : ''}`}
                >
                  {typeof selectedClass.classLevelId === 'object' ? selectedClass.classLevelId.name : selectedClass.name || 'Class'} - {selectedClass.arm}
                </button>
              </>
            )}
            {selectedStudent && (
              <>
                <ChevronRight className="h-3 w-3 text-gray-400" />
                <span className="text-gray-900 font-bold">{selectedStudent.fullName}</span>
              </>
            )}
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">
            {currentStep === 'classes' && 'Result Entry — Select Class'}
            {currentStep === 'students' && `Students — ${typeof selectedClass?.classLevelId === 'object' ? selectedClass?.classLevelId.name : selectedClass?.name} ${selectedClass?.arm}`}
            {currentStep === 'entry' && `Score Entry — ${selectedStudent?.fullName}`}
          </h1>
        </div>

        {/* Active Session & Term Badge (Locked) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-indigo-50 border border-indigo-200 text-indigo-800 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs">
            <Clock className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
            <span>
              Active Term: {activeSessionYear ? `${activeSessionYear} — ` : ''}{activeTermName || 'Current Term'}
            </span>
          </div>
          <div className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-md border border-gray-200">
            Exam: <strong className="text-gray-900">{assessmentConfig.examMax}</strong> | Mid-Term: <strong className="text-gray-900">{assessmentConfig.midtermMax}</strong>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded text-sm text-red-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-500 font-bold hover:text-red-700">✕</button>
        </div>
      )}
      {saveSuccess && (
        <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded text-sm text-green-700 flex items-center justify-between">
          <span className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            {saveSuccess}
          </span>
          <button onClick={() => setSaveSuccess(null)} className="text-green-500 font-bold hover:text-green-700">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: CLASS SELECTION */}
      {/* ========================================================================= */}
      {currentStep === 'classes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search class name or assigned teacher..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <p className="text-xs text-gray-500">
              Showing {filteredClasses.length} {filteredClasses.length === 1 ? 'class' : 'classes'}
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading classes...</div>
          ) : filteredClasses.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-lg border border-gray-200">
              <BookOpen className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-700 font-medium">No classes found</p>
              <p className="text-xs text-gray-500 mt-1">
                {currentUser?.role === 'teacher'
                  ? 'You have not been assigned to any classes for result entry.'
                  : 'No classes match your search query.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClasses.map((cls) => {
                const className = typeof cls.classLevelId === 'object' ? cls.classLevelId.name : cls.name || 'Class';
                const teachers = cls.assignedTeachers && cls.assignedTeachers.length > 0
                  ? cls.assignedTeachers.join(', ')
                  : 'No teacher assigned';
                const studentCount = cls.studentCount ?? 0;

                return (
                  <div
                    key={cls._id}
                    onClick={() => handleSelectClass(cls)}
                    className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          {className.substring(0, 3)}
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                          Arm: {cls.arm}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {className} - {cls.arm}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                        <UserCheck className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
                        {teachers}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex items-center">
                        <Users className="h-3.5 w-3.5 mr-1 text-gray-400" />
                        {studentCount} Students
                      </span>
                      <span className="text-xs font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                        Enter Scores <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: STUDENT SELECTION */}
      {/* ========================================================================= */}
      {currentStep === 'students' && selectedClass && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setCurrentStep('classes');
                setSelectedClass(null);
              }}
              className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-indigo-600"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Classes
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Performance Type:</span>
              <div className="inline-flex rounded-md shadow-xs" role="group">
                <button
                  type="button"
                  onClick={() => setPerformanceType('term')}
                  className={`px-3 py-1 text-xs font-semibold rounded-l-md border ${
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
                  className={`px-3 py-1 text-xs font-semibold rounded-r-md border ${
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

          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search student by name or admission number..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              {(['all', 'completed', 'pending'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStudentFilter(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                    studentFilter === tab
                      ? 'bg-indigo-100 text-indigo-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading students...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-lg border border-gray-200">
              <Users className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-700 font-medium">No students found</p>
              <p className="text-xs text-gray-500 mt-1">
                There are no active students in this class matching your filter.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Admission No
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Verification Code
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student) => {
                    const cInfo = completionMap[student._id];
                    const isComplete = cInfo?.isComplete;
                    const enteredCount = cInfo?.enteredCount || 0;
                    const vCode = cInfo?.verificationCode || '';

                    return (
                      <tr
                        key={student._id}
                        onClick={() => handleSelectStudent(student)}
                        className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center">
                            {student.photo ? (
                              <img
                                src={student.photo}
                                alt={student.fullName}
                                className="h-9 w-9 rounded-full object-cover mr-3 border"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs mr-3">
                                {student.fullName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="text-sm font-semibold text-gray-900">{student.fullName}</div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600 font-mono">
                          {student.admissionNo}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm">
                          {isComplete ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" /> Completed
                            </span>
                          ) : enteredCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                              <Clock className="h-3 w-3 mr-1" /> In Progress ({enteredCount})
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">
                              Not Started
                            </span>
                          )}
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
      {/* STEP 3: SCORE ENTRY & COMMENTS */}
      {/* ========================================================================= */}
      {currentStep === 'entry' && selectedStudent && selectedClass && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
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
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
                <h2 className="text-lg font-bold text-gray-900">{selectedStudent.fullName}</h2>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span>Admission No: <strong className="font-mono text-gray-700">{selectedStudent.admissionNo}</strong></span>
                  <span>•</span>
                  <span>Class: <strong className="text-gray-700">{typeof selectedClass.classLevelId === 'object' ? selectedClass.classLevelId.name : selectedClass.name} - {selectedClass.arm}</strong></span>
                </div>
              </div>
            </div>

            {verificationCode && (
              <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold self-start md:self-auto">
                <span>Code: {verificationCode}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(verificationCode);
                    alert('Verification code copied to clipboard!');
                  }}
                  className="p-1 hover:bg-indigo-100 rounded text-indigo-600"
                  title="Copy verification code"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Subject Scores Table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
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
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-md font-bold text-gray-900 mb-3">Psychomotor Skills (Scale: 1-5)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {psychomotorSkills.map((item, index) => (
                    <div key={item.trait} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-xs font-medium text-gray-700">{item.trait}</span>
                      <select
                        value={item.rating}
                        onChange={(e) => {
                          const updated = [...psychomotorSkills];
                          updated[index].rating = parseInt(e.target.value);
                          setPsychomotorSkills(updated);
                        }}
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                      >
                        {[1, 2, 3, 4, 5].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-md font-bold text-gray-900 mb-3">Affective Domain (Scale: 1-5)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {affectiveDomain.map((item, index) => (
                    <div key={item.trait} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-xs font-medium text-gray-700">{item.trait}</span>
                      <select
                        value={item.rating}
                        onChange={(e) => {
                          const updated = [...affectiveDomain];
                          updated[index].rating = parseInt(e.target.value);
                          setAffectiveDomain(updated);
                        }}
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
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
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Teacher's Remark / Comment</h3>
              <textarea
                rows={3}
                placeholder="Enter teacher remark regarding student progress..."
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {currentUser?.role === 'admin' && (
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
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

          {/* Action Bar */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setCurrentStep('students');
                setSelectedStudent(null);
              }}
              className="px-4 py-2 border border-gray-300 text-xs font-semibold rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || Object.keys(validationErrors).length > 0}
              className="inline-flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md shadow-sm disabled:bg-gray-400 cursor-pointer"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? 'Saving...' : 'Save Student Result'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultEntry;
