import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { ClassSelectionGrid } from '../components/ClassSelectionGrid';
import DocumentHeader from '../components/DocumentHeader';
import { printElement } from '../utils/printHelper';
import {
  Printer,
  ChevronRight,
  ArrowLeft,
  Users,
  Search,
  ShieldAlert,
  Save,
  CheckCircle,
  Clock,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface Subject {
  _id: string;
  name: string;
  code: string;
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

interface SubjectScore {
  subjectId: string;
  subjectName: string;
  ca1: number;
  ca2: number;
  exam: number;
  total: number;
  grade: string;
}

interface StudentResult {
  _id: string;
  subjectScores: SubjectScore[];
  teacherComment: string;
  headOfSchoolComment: string;
  verificationCode?: string;
  isCompleted?: boolean;
  completedAt?: string;
  completedBy?: any;
  classPosition?: number;
  classAverage?: number;
  percentage?: number;
  totalScore?: number;
  totalAvailableMarks?: number;
}

interface Student {
  _id: string;
  fullName: string;
  admissionNo: string;
  classId: any;
  photo?: string;
  status?: string;
}

interface ClassGroup {
  _id: string;
  classLevelId?: { _id: string; name: string } | string;
  name?: string;
  arm: string;
  assignedTeachers?: string[];
  studentCount?: number;
}

interface School {
  _id: string;
  name: string;
  address: string;
  signatureUrl?: string;
  activePeriodId?: any;
  assessmentConfig?: {
    examMax: number;
    midtermMax: number;
    ca1Max: number;
    ca2Max: number;
  };
  gradeScale?: Array<{ min: number; max: number; grade: string; description: string }>;
}

const HalfTermReport: React.FC = () => {
  const [step, setStep] = useState<'classes' | 'students' | 'report'>('classes');
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [result, setResult] = useState<StudentResult | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [subjectRegistrations, setSubjectRegistrations] = useState<SubjectRegistration[]>([]);
  const [scores, setScores] = useState<Record<string, SubjectScore>>({});
  const [teacherComment, setTeacherComment] = useState<string>('');
  const [headOfSchoolComment, setHeadOfSchoolComment] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Phase 1 Completion state
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [classPosition, setClassPosition] = useState<number | null>(null);
  const [classAverage, setClassAverage] = useState<number | null>(null);
  const [studentPercentage, setStudentPercentage] = useState<number | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [completing, setCompleting] = useState<boolean>(false);
  const [reopening, setReopening] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasActiveTerm, setHasActiveTerm] = useState<boolean>(true);

  // Search & Tracker
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [completionMap, setCompletionMap] = useState<Record<string, any>>({});
  const [classProgressMap, setClassProgressMap] = useState<Record<string, { completed: number; total: number }>>({});

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      setLoading(true);
      const userRes = await api.get('/auth/me');
      setCurrentUser(userRes.data?.user || userRes.data);

      const periodRes = await api.get('/schools/active-period');
      const pData = periodRes.data;

      if (!pData || !pData.hasActivePeriod) {
        setHasActiveTerm(false);
        setLoading(false);
        return;
      }

      setHasActiveTerm(true);
      setSchool(pData.school);
      setSessionInfo(pData.session);

      const classesRes = await api.get('/classes');
      setClasses(classesRes.data || []);

      const targetPeriodId = pData.period?._id || pData.session?._id;
      if (targetPeriodId && classesRes.data?.length > 0) {
        loadClassProgress(classesRes.data, targetPeriodId);
      }
    } catch (err) {
      console.error('Failed to initialize HalfTermReport:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadClassProgress = async (classList: ClassGroup[], targetId: string) => {
    const progress: Record<string, { completed: number; total: number }> = {};
    for (const cls of classList) {
      try {
        const res = await api.get('/results/completion', {
          params: { sessionId: targetId, classId: cls._id, performanceType: 'mid-term' },
        });
        progress[cls._id] = {
          completed: res.data.completedCount || 0,
          total: res.data.totalStudents || 0,
        };
      } catch {
        progress[cls._id] = { completed: 0, total: 0 };
      }
    }
    setClassProgressMap(progress);
  };

  const ca1Max = school?.assessmentConfig?.ca1Max ?? 20;
  const ca2Max = school?.assessmentConfig?.ca2Max ?? 20;
  const midtermMax = school?.assessmentConfig?.midtermMax ?? 40;

  const calculateGrade = (total: number): string => {
    const scale = school?.gradeScale && school.gradeScale.length > 0
      ? school.gradeScale
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

  const getStudentClassId = (student: any): string => {
    if (!student || !student.classId) return '';
    if (typeof student.classId === 'string') return student.classId;
    if (student.classId._id) return student.classId._id.toString();
    return student.classId.toString();
  };

  const handleSelectClass = async (cls: ClassGroup) => {
    setSelectedClass(cls);
    setStep('students');
    setStudentSearch('');

    try {
      setLoading(true);
      const res = await api.get('/students');
      const allStudents: Student[] = res.data || [];
      const classStudents = allStudents.filter((s) => {
        const rawClassId = getStudentClassId(s);
        return rawClassId === cls._id.toString();
      });
      setStudents(classStudents);

      const periodId = school?.activePeriodId?._id || school?.activePeriodId;
      if (periodId) {
        const trackerRes = await api.get('/results/completion', {
          params: { sessionId: periodId, classId: cls._id, performanceType: 'mid-term' },
        });
        const map: Record<string, any> = {};
        (trackerRes.data?.students || []).forEach((st: any) => {
          map[st.studentId] = st;
        });
        setCompletionMap(map);
      }
    } catch (err) {
      console.error('Failed to load class students:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setStep('report');
    setValidationErrors({});
    setSaveSuccess(null);
    setErrorMessage(null);
    await loadStudentReport(student._id);
  };

  const loadStudentReport = async (studentId: string) => {
    if (!selectedClass || !school?.activePeriodId) return;

    try {
      setLoading(true);
      const periodId = school.activePeriodId._id || school.activePeriodId;

      const regRes = await api.get('/subject-registrations/student-subjects', {
        params: { classId: selectedClass._id, sessionId: periodId },
      });
      const registrations: SubjectRegistration[] = regRes.data || [];
      setSubjectRegistrations(registrations);

      const baseScores: Record<string, SubjectScore> = {};
      registrations.forEach((reg) => {
        baseScores[reg.subjectId._id] = {
          subjectId: reg.subjectId._id,
          subjectName: reg.subjectId.name,
          ca1: 0,
          ca2: 0,
          exam: 0,
          total: 0,
          grade: 'F',
        };
      });

      setIsCompleted(false);
      setClassPosition(null);
      setClassAverage(null);
      setStudentPercentage(null);

      // Fetch existing mid-term result
      try {
        const res = await api.get('/results/student', {
          params: { sessionId: periodId, studentId, performanceType: 'mid-term' },
        });

        if (res.data) {
          const resObj: StudentResult = res.data;
          setResult(resObj);
          (resObj.subjectScores || []).forEach((score) => {
            baseScores[score.subjectId] = score;
          });
          setTeacherComment(resObj.teacherComment || '');
          setHeadOfSchoolComment(resObj.headOfSchoolComment || '');
          setIsCompleted(Boolean(resObj.isCompleted));
          setClassPosition(resObj.classPosition || null);
          setClassAverage(resObj.classAverage || null);
          setStudentPercentage(resObj.percentage || null);
        } else {
          setResult(null);
          setTeacherComment('');
          setHeadOfSchoolComment('');
        }
      } catch {
        setResult(null);
        setTeacherComment('');
        setHeadOfSchoolComment('');
      }

      setScores(baseScores);
    } catch (err) {
      console.error('Failed to load student report:', err);
    } finally {
      setLoading(false);
    }
  };

  const canEditSubject = (reg: SubjectRegistration): boolean => {
    if (isCompleted && currentUser?.role !== 'admin') return false;
    if (currentUser?.role === 'admin') return true;
    if (currentUser?.role === 'teacher') {
      const currentUserId = (currentUser._id || currentUser.userId || '').toString();
      const assignedId = typeof reg.assignedTeacherId === 'object' && reg.assignedTeacherId?._id
        ? reg.assignedTeacherId._id.toString()
        : reg.assignedTeacherId ? reg.assignedTeacherId.toString() : '';

      // Direct assignment to subject
      if (assignedId && assignedId === currentUserId) return true;

      // Or teacher assigned to class
      const userAssignedClasses = (currentUser.assignedClasses || []).map((c: any) =>
        typeof c === 'object' && c._id ? c._id.toString() : c.toString()
      );
      const activeClassId = selectedClass?._id;
      if (activeClassId && userAssignedClasses.includes(activeClassId.toString())) {
        return true;
      }

      // If subject has no teacher assigned at all, class teacher or authorized teacher can enter
      if (!assignedId && selectedClass?.assignedTeachers?.some((t: any) => (t._id || t).toString() === currentUserId)) {
        return true;
      }

      return false;
    }
    return false;
  };

  const handleScoreChange = (subjectId: string, field: 'ca1' | 'ca2', rawVal: string) => {
    if (isCompleted && currentUser?.role !== 'admin') {
      alert('This result has been completed. An administrator must reopen it before changes can be made.');
      return;
    }

    const errorKey = `${subjectId}_${field}`;
    const newErrors = { ...validationErrors };
    const num = rawVal === '' ? 0 : parseInt(rawVal, 10);
    const maxAllowed = field === 'ca1' ? ca1Max : ca2Max;

    if (isNaN(num)) {
      newErrors[errorKey] = 'Invalid number';
    } else if (num < 0) {
      newErrors[errorKey] = 'Cannot be negative';
    } else if (num > maxAllowed) {
      newErrors[errorKey] = `Max is ${maxAllowed}`;
    } else {
      delete newErrors[errorKey];
    }
    setValidationErrors(newErrors);

    const updated = { ...scores };
    const current = { ...(updated[subjectId] || { ca1: 0, ca2: 0, exam: 0, total: 0, grade: 'F' }) };
    current[field] = isNaN(num) ? 0 : num;

    const caSum = current.ca1 + current.ca2;
    const scaledTotal = midtermMax > 0 && midtermMax !== 100
      ? Math.round((caSum / midtermMax) * 100)
      : caSum;

    current.total = scaledTotal;
    current.grade = calculateGrade(scaledTotal);
    updated[subjectId] = current;
    setScores(updated);
  };

  // Completion requirements checklist for Mid-Term
  const completionValidation = useMemo(() => {
    const missing: string[] = [];
    subjectRegistrations.forEach((reg) => {
      const s = scores[reg.subjectId._id];
      if (!s) {
        missing.push(reg.subjectId.name);
      } else {
        if (s.ca1 === undefined || s.ca1 === null || isNaN(s.ca1)) missing.push(`${reg.subjectId.name} (CA1)`);
        if (s.ca2 === undefined || s.ca2 === null || isNaN(s.ca2)) missing.push(`${reg.subjectId.name} (CA2)`);
      }
    });

    const isScoresComplete = subjectRegistrations.length > 0 && missing.length === 0;
    const isTeacherCommentComplete = Boolean(teacherComment && teacherComment.trim().length > 0);
    const hasScoreErrors = Object.keys(validationErrors).length > 0;

    const canComplete = isScoresComplete && isTeacherCommentComplete && !hasScoreErrors && !isCompleted;

    return {
      missing,
      isScoresComplete,
      isTeacherCommentComplete,
      hasScoreErrors,
      canComplete,
    };
  }, [subjectRegistrations, scores, teacherComment, validationErrors, isCompleted]);

  // Save Draft
  const handleSaveScores = async () => {
    if (Object.keys(validationErrors).length > 0) {
      alert('Please fix invalid scores before saving.');
      return;
    }

    if (!selectedStudent || !school?.activePeriodId) return;

    try {
      setSaving(true);
      const periodId = school.activePeriodId._id || school.activePeriodId;

      const scoresToSubmit = Object.values(scores).filter((s) => {
        if (currentUser?.role === 'admin') return true;
        const reg = subjectRegistrations.find((r) => r.subjectId._id === s.subjectId);
        return reg ? canEditSubject(reg) : false;
      });

      const payload = {
        sessionId: periodId,
        studentId: selectedStudent._id,
        subjectScores: scoresToSubmit,
        teacherComment,
        headOfSchoolComment: currentUser?.role === 'admin' ? headOfSchoolComment : undefined,
        performanceType: 'mid-term',
      };

      const res = await api.post('/results/save', payload);
      setResult(res.data);
      setSaveSuccess('Half-term assessment scores saved successfully!');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  // Phase 1: Complete Mid-Term Result Action
  const handleCompleteResult = async () => {
    if (!completionValidation.canComplete) {
      alert('Please enter all required subject scores and teacher remark before completing.');
      return;
    }

    if (!selectedStudent || !selectedClass || !school?.activePeriodId) return;

    try {
      setCompleting(true);
      setErrorMessage(null);
      setSaveSuccess(null);

      const periodId = school.activePeriodId._id || school.activePeriodId;

      const payload = {
        sessionId: periodId,
        studentId: selectedStudent._id,
        classId: selectedClass._id,
        performanceType: 'mid-term',
        subjectScores: Object.values(scores),
        teacherComment,
      };

      const res = await api.post('/results/complete', payload);
      setIsCompleted(true);
      setResult(res.data.result);
      setClassPosition(res.data.classPosition || res.data.result?.classPosition);
      setClassAverage(res.data.classAverage || res.data.result?.classAverage);
      setStudentPercentage(res.data.percentage || res.data.result?.percentage);
      setSaveSuccess('Mid-Term report marked as COMPLETED! Rankings and class averages calculated.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to complete result.');
    } finally {
      setCompleting(false);
    }
  };

  // Reopen result for editing (Admin only)
  const handleReopenResult = async () => {
    if (!selectedStudent || !selectedClass || !school?.activePeriodId) return;
    if (!window.confirm('Reopen this completed mid-term result for editing?')) return;

    try {
      setReopening(true);
      const periodId = school.activePeriodId._id || school.activePeriodId;

      await api.post('/results/reopen', {
        studentId: selectedStudent._id,
        sessionId: periodId,
        performanceType: 'mid-term',
      });

      setIsCompleted(false);
      setClassPosition(null);
      setSaveSuccess('Result reopened for editing.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reopen result.');
    } finally {
      setReopening(false);
    }
  };

  const handlePrint = () => {
    printElement('printable-half-term-report', `Half-Term Report - ${selectedStudent?.fullName || 'Student'}`);
  };

  const filteredStudents = useMemo(() => {
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.admissionNo.toLowerCase().includes(studentSearch.toLowerCase())
    );
  }, [students, studentSearch]);

  if (!loading && !hasActiveTerm) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg shadow-sm flex items-start">
          <ShieldAlert className="h-7 w-7 text-amber-500 mr-4 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-amber-900">Active Academic Session Required</h2>
            <p className="mt-2 text-sm text-amber-800">
              Half-Term Reports require an active academic session and current term to be configured in Settings.
            </p>
            {currentUser?.role === 'admin' ? (
              <a
                href="/settings"
                className="mt-3 inline-block px-4 py-2 bg-amber-600 text-white rounded font-semibold text-xs"
              >
                Go to Settings →
              </a>
            ) : (
              <p className="mt-2 text-xs text-amber-700 italic">Please contact the school administrator.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header (Hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Half-Term Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 'classes' && 'Select a class to generate, edit, or print student half-term assessment reports.'}
            {step === 'students' && selectedClass && (
              <>
                Class:{' '}
                <strong className="text-indigo-600">
                  {typeof selectedClass.classLevelId === 'object' ? selectedClass.classLevelId.name : selectedClass.name} - {selectedClass.arm}
                </strong>
                {' '}• Select a student
              </>
            )}
            {step === 'report' && selectedStudent && (
              <>
                Report for <strong className="text-indigo-600">{selectedStudent.fullName}</strong> ({selectedStudent.admissionNo})
              </>
            )}
          </p>
        </div>

        {hasActiveTerm && sessionInfo && (
          <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3.5 py-1.5 rounded-full text-xs font-semibold self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              Active Period: {sessionInfo.year} · Term {sessionInfo.currentTerm}
            </span>
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex items-center print:hidden">
          <CheckCircle className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0" />
          <span className="text-sm font-medium">{saveSuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg flex items-center print:hidden">
          <span className="text-sm font-medium">{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: CLASS SELECTION */}
      {step === 'classes' && (
        <ClassSelectionGrid
          classes={classes}
          loading={loading}
          error={errorMessage}
          onRetry={init}
          onSelectClass={handleSelectClass}
          actionText="Open class students"
          renderProgressOrMeta={(cls) => {
            const progress = classProgressMap[cls._id] || { completed: 0, total: 0 };
            const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
            return (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Completion</span>
                  <span className="font-semibold text-indigo-600">{pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          }}
        />
      )}

      {/* STEP 2: STUDENT SELECTION */}
      {step === 'students' && selectedClass && (
        <div className="space-y-5">
          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
            <button
              onClick={() => {
                setStep('classes');
                setSelectedClass(null);
              }}
              className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-indigo-600"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Classes
            </button>
            <span className="text-xs text-gray-500">
              Class:{' '}
              <strong className="text-gray-800">
                {typeof selectedClass.classLevelId === 'object' ? selectedClass.classLevelId.name : selectedClass.name} - {selectedClass.arm}
              </strong>
            </span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-gray-200 max-w-md relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search student by name or admission number..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading students...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-lg border border-gray-200 text-gray-500">
              <Users className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="font-semibold">No students found</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-5 py-3 text-left">Student</th>
                    <th className="px-5 py-3 text-left">Admission No</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Rank</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStudents.map((s) => {
                    const cInfo = completionMap[s._id];
                    const isDone = Boolean(cInfo?.isComplete);

                    return (
                      <tr
                        key={s._id}
                        onClick={() => handleSelectStudent(s)}
                        className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs mr-3">
                              {s.fullName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{s.fullName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600 font-mono">
                          {s.admissionNo}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {isDone ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle className="h-3 w-3 mr-1 text-emerald-600" /> Completed
                            </span>
                          ) : cInfo?.enteredCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              <Clock className="h-3 w-3 mr-1 text-amber-600" /> In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                              Not Started
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-bold text-gray-800">
                          {isDone && cInfo?.classPosition ? `#${cInfo.classPosition}` : '—'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm">
                          <span className="text-indigo-600 font-semibold text-xs inline-flex items-center">
                            View & Edit Report <ChevronRight className="h-3 w-3 ml-0.5" />
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
      )}

      {/* STEP 3: HALF TERM REPORT & EDITING */}
      {step === 'report' && selectedStudent && selectedClass && school && (
        <div className="space-y-6">
          <div className="flex items-center justify-between print:hidden">
            <button
              onClick={() => {
                setStep('students');
                setSelectedStudent(null);
              }}
              className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-indigo-600"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Students
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-sm"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Print Report
              </button>
            </div>
          </div>

          {/* Completed Banner */}
          {isCompleted && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between print:hidden">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0" />
                <div className="text-xs text-emerald-900">
                  <span className="font-bold">This mid-term result has been completed.</span>
                  {classPosition ? ` Rank: #${classPosition} | Class Average: ${classAverage}%` : ''}
                </div>
              </div>

              {currentUser?.role === 'admin' && (
                <button
                  type="button"
                  onClick={handleReopenResult}
                  disabled={reopening}
                  className="px-3 py-1 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold rounded shadow-2xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1 inline" />
                  {reopening ? 'Reopening...' : 'Reopen for Corrections'}
                </button>
              )}
            </div>
          )}

          {/* EDITABLE SCORE SECTION (Hidden on print) */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm print:hidden space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-md font-bold text-gray-900">Enter / Update Half-Term Assessment Scores</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  CA1 Max: {ca1Max} | CA2 Max: {ca2Max} | Total Mid-Term Max: {midtermMax}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!isCompleted && (
                  <button
                    onClick={handleSaveScores}
                    disabled={saving || Object.keys(validationErrors).length > 0}
                    className="inline-flex items-center px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-md disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                )}

                <button
                  onClick={handleCompleteResult}
                  disabled={!completionValidation.canComplete || completing || isCompleted}
                  className="inline-flex items-center px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md shadow-xs disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  {completing ? 'Completing...' : isCompleted ? 'Completed' : 'Complete Result'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50 font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Subject</th>
                    <th className="px-4 py-2 text-left">Teacher</th>
                    <th className="px-4 py-2 text-left">CA 1 ({ca1Max})</th>
                    <th className="px-4 py-2 text-left">CA 2 ({ca2Max})</th>
                    <th className="px-4 py-2 text-left">Scaled Total (%)</th>
                    <th className="px-4 py-2 text-left">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {subjectRegistrations.map((reg) => {
                    const sid = reg.subjectId._id;
                    const score = scores[sid] || { ca1: 0, ca2: 0, exam: 0, total: 0, grade: 'F' };
                    const editable = canEditSubject(reg);
                    const ca1Err = validationErrors[`${sid}_ca1`];
                    const ca2Err = validationErrors[`${sid}_ca2`];

                    return (
                      <tr key={sid} className={editable ? '' : 'bg-gray-50/70'}>
                        <td className="px-4 py-2 font-semibold text-gray-900">
                          {reg.subjectId.name}
                          {!editable && (
                            <span className="ml-2 text-[10px] text-gray-400 font-normal">
                              <Lock className="inline h-2.5 w-2.5 mr-0.5" /> Read-Only
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {reg.assignedTeacherId?.fullName || reg.assignedTeacherId?.name || 'Unassigned'}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            max={ca1Max}
                            disabled={!editable}
                            value={score.ca1}
                            onChange={(e) => handleScoreChange(sid, 'ca1', e.target.value)}
                            className="w-16 px-2 py-1 border rounded text-xs disabled:bg-gray-100"
                          />
                          {ca1Err && <div className="text-[10px] text-red-600">{ca1Err}</div>}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            max={ca2Max}
                            disabled={!editable}
                            value={score.ca2}
                            onChange={(e) => handleScoreChange(sid, 'ca2', e.target.value)}
                            className="w-16 px-2 py-1 border rounded text-xs disabled:bg-gray-100"
                          />
                          {ca2Err && <div className="text-[10px] text-red-600">{ca2Err}</div>}
                        </td>
                        <td className="px-4 py-2 font-bold text-gray-900">{score.total}%</td>
                        <td className="px-4 py-2 font-semibold">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] ${
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Teacher's Comment (Required to Complete)</label>
                <textarea
                  disabled={isCompleted && currentUser?.role !== 'admin'}
                  rows={2}
                  value={teacherComment}
                  onChange={(e) => setTeacherComment(e.target.value)}
                  className="w-full text-xs p-2 border rounded disabled:bg-gray-100"
                  placeholder="Enter teacher remark..."
                />
              </div>
              {currentUser?.role === 'admin' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Head of School's Comment</label>
                  <textarea
                    rows={2}
                    value={headOfSchoolComment}
                    onChange={(e) => setHeadOfSchoolComment(e.target.value)}
                    className="w-full text-xs p-2 border rounded"
                    placeholder="Enter head of school remark..."
                  />
                </div>
              )}
            </div>

            {/* Checklist */}
            {!isCompleted && (
              <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs flex items-center justify-between">
                <span>
                  All {subjectRegistrations.length} subjects have scores entered:{' '}
                  <strong>{completionValidation.isScoresComplete ? 'Yes ✓' : `No (${completionValidation.missing.length} missing)`}</strong>
                </span>
                <span>
                  Teacher comment entered: <strong>{completionValidation.isTeacherCommentComplete ? 'Yes ✓' : 'Required'}</strong>
                </span>
              </div>
            )}
          </div>

          {/* OFFICIAL HALF-TERM REPORT CARD (Used for Print & Preview) */}
          <div
            id="printable-half-term-report"
            className="bg-white rounded-lg shadow-sm p-8 border border-gray-200 print:shadow-none print:rounded-none print:border-none print:p-0"
          >
            {/* Universal Document Header */}
            <DocumentHeader
              title="HALF TERM ASSESSMENT REPORT"
              documentNumber={result?.verificationCode || ''}
              date={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            />

            {sessionInfo && (
              <div className="text-center py-2 mb-4 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-xs font-bold text-gray-700 tracking-wide uppercase">
                  Academic Session: {sessionInfo.year} &nbsp;•&nbsp; Term: {sessionInfo.currentTerm.toUpperCase()}
                </span>
              </div>
            )}

            {/* Student Info Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6 text-xs">
              <div>
                <span className="text-gray-500 block">Student Name</span>
                <span className="font-bold text-gray-900 text-sm">{selectedStudent.fullName}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Admission Number</span>
                <span className="font-mono font-bold text-gray-900">{selectedStudent.admissionNo}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Class</span>
                <span className="font-bold text-gray-900">
                  {typeof selectedClass.classLevelId === 'object' ? selectedClass.classLevelId.name : selectedClass.name} - {selectedClass.arm}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Rank / Class Average</span>
                <span className="font-bold text-indigo-700">
                  {classPosition ? `#${classPosition}` : '—'} {studentPercentage !== null ? `(${studentPercentage}%)` : ''} {classAverage ? `• Avg: ${classAverage}%` : ''}
                </span>
              </div>
            </div>

            {/* Scores Table */}
            <table className="min-w-full divide-y-2 divide-gray-200 border border-gray-200 text-xs mb-6">
              <thead className="bg-gray-100 font-bold text-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left">Subject</th>
                  <th className="px-4 py-2 text-center">CA 1 ({ca1Max})</th>
                  <th className="px-4 py-2 text-center">CA 2 ({ca2Max})</th>
                  <th className="px-4 py-2 text-center">Scaled Total (%)</th>
                  <th className="px-4 py-2 text-center">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {subjectRegistrations.map((reg) => {
                  const sid = reg.subjectId._id;
                  const score = scores[sid] || { ca1: 0, ca2: 0, total: 0, grade: 'F' };
                  return (
                    <tr key={sid}>
                      <td className="px-4 py-2 font-medium text-gray-900">{reg.subjectId.name}</td>
                      <td className="px-4 py-2 text-center">{score.ca1}</td>
                      <td className="px-4 py-2 text-center">{score.ca2}</td>
                      <td className="px-4 py-2 text-center font-bold text-gray-900">{score.total}%</td>
                      <td className="px-4 py-2 text-center font-bold">{score.grade}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Comments & Signatures */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-200 text-xs">
              <div className="border p-3 rounded bg-gray-50/50">
                <span className="font-bold text-gray-800 block mb-1">Teacher's Remark:</span>
                <p className="italic text-gray-700">{teacherComment || 'No remark provided.'}</p>
                <div className="mt-6 pt-2 border-t border-gray-300 flex justify-between text-gray-500">
                  <span>Class Teacher's Signature</span>
                </div>
              </div>

              <div className="border p-3 rounded bg-gray-50/50">
                <span className="font-bold text-gray-800 block mb-1">Head of School's Remark:</span>
                <p className="italic text-gray-700">{headOfSchoolComment || result?.headOfSchoolComment || 'Awaiting Head Teacher review.'}</p>
                <div className="mt-6 pt-2 border-t border-gray-300 flex justify-between text-gray-500">
                  <span>Principal / Head Teacher Signature</span>
                  {school.signatureUrl && (
                    <img src={school.signatureUrl} alt="Signature" className="h-6 object-contain" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HalfTermReport;
