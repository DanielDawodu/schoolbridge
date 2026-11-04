import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import {
  BookOpen,
  Users,
  Search,
  ArrowLeft,
  Printer,
  Save,
  CheckCircle,
  Clock,
  ShieldAlert,
  ChevronRight,
  Lock,
  UserCheck
} from 'lucide-react';

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
}

interface Student {
  _id: string;
  fullName: string;
  admissionNo: string;
  classId: string;
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
}

interface SubjectRegistration {
  _id: string;
  subjectId: {
    _id: string;
    name: string;
    code: string;
  };
  assignedTeacherId?: {
    _id: string;
    name?: string;
    fullName?: string;
  };
}

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

const HalfTermReport: React.FC = () => {
  // Navigation: 'classes' -> 'students' -> 'report'
  const [step, setStep] = useState<'classes' | 'students' | 'report'>('classes');

  // School context
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [activeSessionYear, setActiveSessionYear] = useState<string>('');
  const [activeTermName, setActiveTermName] = useState<string>('');
  const [hasActiveTerm, setHasActiveTerm] = useState<boolean>(true);

  // Assessment config
  const [midtermMax, setMidtermMax] = useState<number>(40);
  const [ca1Max, setCa1Max] = useState<number>(20);
  const [ca2Max, setCa2Max] = useState<number>(20);

  // Classes & Students
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classSearch, setClassSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Report & Scores
  const [result, setResult] = useState<StudentResult | null>(null);
  const [subjectRegistrations, setSubjectRegistrations] = useState<SubjectRegistration[]>([]);
  const [scores, setScores] = useState<Record<string, SubjectScore>>({});
  const [teacherComment, setTeacherComment] = useState('');
  const [headOfSchoolComment, setHeadOfSchoolComment] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Loading & states
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    try {
      setLoading(true);
      const [userRes, schoolRes, classesRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/schools/me'),
        api.get('/classes'),
      ]);

      setCurrentUser(userRes.data);
      const schoolData: School = schoolRes.data;
      setSchool(schoolData);

      if (schoolData.assessmentConfig) {
        setMidtermMax(schoolData.assessmentConfig.midtermMax || 40);
        setCa1Max(schoolData.assessmentConfig.ca1Max || 20);
        setCa2Max(schoolData.assessmentConfig.ca2Max || 20);
      }

      if (schoolData.activePeriodId) {
        const p = schoolData.activePeriodId;
        const year = typeof p.sessionId === 'object' ? p.sessionId.year : '';
        const term = typeof p.termId === 'object' ? p.termId.name : '';
        setActiveSessionYear(year);
        setActiveTermName(term);
        setHasActiveTerm(true);
      } else {
        setHasActiveTerm(false);
      }

      setClasses(classesRes.data || []);
    } catch (err) {
      console.error('Failed to init HalfTermReport:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClass = async (cls: ClassGroup) => {
    setSelectedClass(cls);
    setStep('students');
    setStudentSearch('');
    try {
      setLoading(true);
      const res = await api.get('/students', { params: { classId: cls._id } });
      const activeOnly = (res.data || []).filter(
        (s: Student) => s.classId?.toString() === cls._id.toString() && (s.status === 'active' || !s.status)
      );
      setStudents(activeOnly);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setStep('report');
    setSaveSuccess(null);
    setValidationErrors({});
    await loadStudentReport(student._id);
  };

  const loadStudentReport = async (studentId: string) => {
    if (!selectedClass || !school?.activePeriodId) return;
    try {
      setLoading(true);
      const periodId = school.activePeriodId._id || school.activePeriodId;

      // Fetch registered subjects
      const regRes = await api.get('/subject-registrations/student-subjects', {
        params: {
          sessionId: periodId,
          studentId,
          classId: selectedClass._id,
        },
      });
      const regs: SubjectRegistration[] = regRes.data || [];
      setSubjectRegistrations(regs);

      const baseScores: Record<string, SubjectScore> = {};
      regs.forEach((r) => {
        baseScores[r.subjectId._id] = {
          subjectId: r.subjectId._id,
          subjectName: r.subjectId.name,
          ca1: 0,
          ca2: 0,
          exam: 0,
          total: 0,
          grade: 'F',
        };
      });

      // Fetch existing mid-term result
      try {
        const res = await api.get('/report-cards', {
          params: { sessionId: periodId, studentId, performanceType: 'mid-term' },
        });

        if (res.data?.result) {
          const resObj: StudentResult = res.data.result;
          setResult(resObj);
          (resObj.subjectScores || []).forEach((score) => {
            baseScores[score.subjectId] = score;
          });
          setTeacherComment(resObj.teacherComment || '');
          setHeadOfSchoolComment(resObj.headOfSchoolComment || '');
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
    if (currentUser?.role === 'admin') return true;
    if (currentUser?.role === 'teacher') {
      const currentUserId = currentUser._id || currentUser.userId;
      const assignedId = reg.assignedTeacherId?._id;
      return assignedId?.toString() === currentUserId?.toString();
    }
    return false;
  };

  const handleScoreChange = (subjectId: string, field: 'ca1' | 'ca2', rawVal: string) => {
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

  const handlePrint = () => {
    window.print();
  };

  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      const name = typeof cls.classLevelId === 'object' ? cls.classLevelId.name : cls.name || '';
      const arm = cls.arm || '';
      const full = `${name} ${arm}`.toLowerCase();
      const teachers = (cls.assignedTeachers || []).join(' ').toLowerCase();
      return full.includes(classSearch.toLowerCase()) || teachers.includes(classSearch.toLowerCase());
    });
  }, [classes, classSearch]);

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
            {currentUser?.role === 'admin' && (
              <a
                href="/settings"
                className="mt-4 inline-flex items-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Go to Settings
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-4 print:hidden">
        <div>
          <nav className="flex items-center space-x-2 text-xs text-gray-500 mb-1">
            <button
              onClick={() => {
                setStep('classes');
                setSelectedClass(null);
                setSelectedStudent(null);
              }}
              className={`hover:text-indigo-600 font-medium ${step === 'classes' ? 'text-indigo-600 font-bold' : ''}`}
            >
              Classes
            </button>
            {selectedClass && (
              <>
                <ChevronRight className="h-3 w-3 text-gray-400" />
                <button
                  onClick={() => {
                    setStep('students');
                    setSelectedStudent(null);
                  }}
                  className={`hover:text-indigo-600 font-medium ${step === 'students' ? 'text-indigo-600 font-bold' : ''}`}
                >
                  {typeof selectedClass.classLevelId === 'object' ? selectedClass.classLevelId.name : selectedClass.name} - {selectedClass.arm}
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
            {step === 'classes' && 'Half Term Report — Select Class'}
            {step === 'students' && `Select Student — ${typeof selectedClass?.classLevelId === 'object' ? selectedClass?.classLevelId.name : selectedClass?.name} ${selectedClass?.arm}`}
            {step === 'report' && `Half Term Assessment Report — ${selectedStudent?.fullName}`}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-indigo-50 border border-indigo-200 text-indigo-800 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <Clock className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
            <span>Active Term: {activeSessionYear} {activeTermName}</span>
          </div>
          <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded border">
            Mid-Term Max: <strong className="text-gray-900">{midtermMax}</strong>
          </span>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded text-sm text-green-700 flex items-center justify-between print:hidden">
          <span className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            {saveSuccess}
          </span>
          <button onClick={() => setSaveSuccess(null)}>✕</button>
        </div>
      )}

      {/* STEP 1: CLASS SELECTION */}
      {step === 'classes' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 max-w-md relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3.5" />
            <input
              type="text"
              placeholder="Search class or assigned teacher..."
              value={classSearch}
              onChange={(e) => setClassSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading classes...</div>
          ) : filteredClasses.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-lg border border-gray-200">
              <BookOpen className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-700 font-medium">No classes found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClasses.map((cls) => {
                const className = typeof cls.classLevelId === 'object' ? cls.classLevelId.name : cls.name || 'Class';
                const teachers = cls.assignedTeachers && cls.assignedTeachers.length > 0
                  ? cls.assignedTeachers.join(', ')
                  : 'No teacher assigned';

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
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                          Arm: {cls.arm}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600">
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
                        {cls.studentCount ?? 0} Students
                      </span>
                      <span className="text-xs font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                        View Report <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: STUDENT SELECTION */}
      {step === 'students' && selectedClass && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
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
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 max-w-md relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3.5" />
            <input
              type="text"
              placeholder="Search student by name or admission number..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading students...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-lg border border-gray-200">
              <Users className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-700 font-medium">No students found</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-5 py-3 text-left">Student</th>
                    <th className="px-5 py-3 text-left">Admission No</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStudents.map((s) => (
                    <tr
                      key={s._id}
                      onClick={() => handleSelectStudent(s)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center">
                          {s.photo ? (
                            <img src={s.photo} alt={s.fullName} className="h-8 w-8 rounded-full mr-3 object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs mr-3">
                              {s.fullName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-semibold text-gray-900">{s.fullName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600 font-mono">
                        {s.admissionNo}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm">
                        <span className="text-indigo-600 font-semibold text-xs inline-flex items-center">
                          View & Edit Report <ChevronRight className="h-3 w-3 ml-0.5" />
                        </span>
                      </td>
                    </tr>
                  ))}
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

          {/* EDITABLE SCORE SECTION (Hidden on print) */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm print:hidden space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-md font-bold text-gray-900">Enter / Update Half-Term Assessment Scores</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  CA1 Max: {ca1Max} | CA2 Max: {ca2Max} | Total Mid-Term Max: {midtermMax}
                </p>
              </div>
              <button
                onClick={handleSaveScores}
                disabled={saving || Object.keys(validationErrors).length > 0}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md disabled:bg-gray-400"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {saving ? 'Saving...' : 'Save Mid-Term Scores'}
              </button>
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">Teacher's Comment</label>
                <textarea
                  rows={2}
                  value={teacherComment}
                  onChange={(e) => setTeacherComment(e.target.value)}
                  className="w-full text-xs p-2 border rounded"
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
          </div>

          {/* OFFICIAL HALF-TERM REPORT CARD (Used for Print & Preview) */}
          <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-200 print:shadow-none print:rounded-none print:border-none print:p-0">
            {/* School Header */}
            <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
              <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">{school.name}</h1>
              <p className="text-gray-600 text-sm mt-1">{school.address}</p>
              <h2 className="text-lg font-bold text-indigo-900 mt-2 tracking-wide uppercase">
                Half Term Assessment Report
              </h2>
            </div>

            {/* Student Info */}
            <div className="flex items-center mb-6">
              {selectedStudent.photo ? (
                <img
                  src={selectedStudent.photo}
                  alt={selectedStudent.fullName}
                  className="w-20 h-20 rounded-full mr-5 object-cover border"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-2xl mr-5">
                  {selectedStudent.fullName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{selectedStudent.fullName}</h3>
                <p className="text-xs text-gray-600 mt-0.5">Admission No: <strong className="font-mono text-gray-900">{selectedStudent.admissionNo}</strong></p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Class: <strong className="text-gray-900">{typeof selectedClass.classLevelId === 'object' ? selectedClass.classLevelId.name : selectedClass.name} - {selectedClass.arm}</strong>
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Session: <strong className="text-gray-900">{activeSessionYear} ({activeTermName})</strong>
                </p>
                {(result?.verificationCode || scores[Object.keys(scores)[0]]?.grade) && (
                  <p className="text-xs text-indigo-700 font-mono font-semibold mt-1">
                    Verification Code: {result?.verificationCode || 'GEN-PENDING'}
                  </p>
                )}
              </div>
            </div>

            {/* Subject Scores Table */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wider">Academic Performance</h3>
              <table className="min-w-full divide-y divide-gray-200 border border-gray-300 text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold text-gray-700 uppercase border-b">Subject</th>
                    <th className="px-4 py-2.5 text-center font-bold text-gray-700 uppercase border-b">Mark Obtainable</th>
                    <th className="px-4 py-2.5 text-center font-bold text-gray-700 uppercase border-b">Marks Obtained</th>
                    <th className="px-4 py-2.5 text-center font-bold text-gray-700 uppercase border-b">Percentage</th>
                    <th className="px-4 py-2.5 text-center font-bold text-gray-700 uppercase border-b">Grade</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subjectRegistrations.map((reg) => {
                    const sid = reg.subjectId._id;
                    const sc = scores[sid] || { ca1: 0, ca2: 0, exam: 0, total: 0, grade: 'F' };
                    const rawMarks = sc.ca1 + sc.ca2;

                    return (
                      <tr key={sid}>
                        <td className="px-4 py-2 text-gray-900 font-medium border-b">{reg.subjectId.name}</td>
                        <td className="px-4 py-2 text-center text-gray-700 border-b">{midtermMax}</td>
                        <td className="px-4 py-2 text-center font-semibold text-gray-900 border-b">{rawMarks}</td>
                        <td className="px-4 py-2 text-center text-gray-900 border-b">{sc.total}%</td>
                        <td className="px-4 py-2 text-center font-bold border-b">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              sc.grade === 'A'
                                ? 'bg-green-100 text-green-800'
                                : sc.grade === 'B'
                                ? 'bg-blue-100 text-blue-800'
                                : sc.grade === 'C'
                                ? 'bg-yellow-100 text-yellow-800'
                                : sc.grade === 'D'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {sc.grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Comments */}
            <div className="mb-4">
              <h4 className="text-xs font-bold text-gray-800 mb-1 uppercase">Teacher's Comment</h4>
              <div className="border border-gray-300 rounded p-3 min-h-[45px] bg-gray-50/50">
                <p className="text-xs text-gray-700">{teacherComment || 'No comment provided.'}</p>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-xs font-bold text-gray-800 mb-1 uppercase">Head of School's Comment</h4>
              <div className="border border-gray-300 rounded p-3 min-h-[45px] bg-gray-50/50">
                <p className="text-xs text-gray-700">{headOfSchoolComment || 'No comment provided.'}</p>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-6 pt-4 border-t">
              <div>
                <div className="h-12 mb-1">
                  {school.signatureUrl && (
                    <img src={school.signatureUrl} alt="Teacher Signature" className="h-full" />
                  )}
                </div>
                <p className="text-xs text-gray-600 font-medium border-t border-gray-300 pt-1 inline-block">
                  Teacher's Signature & Date
                </p>
              </div>
              <div>
                <div className="h-12 mb-1">
                  {school.signatureUrl && (
                    <img src={school.signatureUrl} alt="Principal Signature" className="h-full" />
                  )}
                </div>
                <p className="text-xs text-gray-600 font-medium border-t border-gray-300 pt-1 inline-block">
                  Principal's Signature & Date
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HalfTermReport;
