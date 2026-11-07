import React, { useEffect, useState } from 'react';
import api from '../services/api';
import DocumentHeader from '../components/DocumentHeader';
import { printElement } from '../utils/printHelper';
import {
  BookOpen,
  Users,
  Search,
  ArrowLeft,
  CheckCircle,
  Clock,
  Printer,
  ChevronRight,
  ShieldAlert,
  Save,
  AlertCircle,
} from 'lucide-react';

interface ClassStatus {
  _id: string;
  name: string;
  className: string;
  arm: string;
  assignedTeachers: string[];
  studentCount: number;
  completedResultsCount: number;
  awaitingHeadCommentCount: number;
  approvedCount: number;
}

interface StudentReportStatus {
  studentId: string;
  fullName: string;
  admissionNo: string;
  gender?: string;
  resultId: string | null;
  isCompleted: boolean;
  isApproved: boolean;
  hasTeacherComment: boolean;
  hasHeadComment: boolean;
  headOfSchoolComment?: string;
  teacherComment?: string;
  overallPercentage: number;
  classPosition: number;
  classAverage: number;
  reportAvailability: 'ready' | 'awaiting_head_comment' | 'incomplete';
  completedAt?: string;
  approvedAt?: string;
}

interface SubjectScore {
  subjectId: string;
  subjectName: string;
  ca1: number;
  ca2: number;
  exam: number;
  total: number;
  grade: string;
  gradeDescription?: string;
  position?: number;
}

interface PsychomotorRating {
  trait: string;
  rating: number;
}

interface AffectiveRating {
  trait: string;
  rating: number;
}

const ReportCard: React.FC = () => {
  // Workflow Step
  const [step, setStep] = useState<'classes' | 'students' | 'review'>('classes');

  // Selected Entities
  const [selectedClass, setSelectedClass] = useState<ClassStatus | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentReportStatus | null>(null);

  // Lists & Data
  const [classList, setClassList] = useState<ClassStatus[]>([]);
  const [studentList, setStudentList] = useState<StudentReportStatus[]>([]);
  const [reportData, setReportData] = useState<any>(null);

  // Central active period & auth
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [hasActiveTerm, setHasActiveTerm] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Head teacher comment form
  const [headComment, setHeadComment] = useState<string>('');
  const [savingComment, setSavingComment] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Loading & Search
  const [loading, setLoading] = useState<boolean>(true);
  const [classSearch, setClassSearch] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // Check current user
      const userRes = await api.get('/auth/me');
      setCurrentUser(userRes.data?.user || userRes.data);

      // Check active period
      const activeRes = await api.get('/schools/active-period');
      if (!activeRes.data || !activeRes.data.hasActivePeriod) {
        setHasActiveTerm(false);
        setLoading(false);
        return;
      }

      setHasActiveTerm(true);
      setActivePeriod(activeRes.data);

      // Load classes with report card progress summary
      await loadClassStatuses();
    } catch (err: any) {
      console.error('Failed to initialize report cards:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to load report cards workflow.');
    } finally {
      setLoading(false);
    }
  };

  const loadClassStatuses = async () => {
    try {
      const res = await api.get('/report-cards/class-status', {
        params: { performanceType: 'term' },
      });
      setClassList(res.data?.classes || []);
    } catch (err) {
      console.error('Failed to load class status:', err);
    }
  };

  // Step 1 -> Step 2
  const handleSelectClass = async (cls: ClassStatus) => {
    setSelectedClass(cls);
    setStep('students');
    setStudentSearch('');
    await loadClassStudents(cls._id);
  };

  const loadClassStudents = async (classId: string) => {
    try {
      setLoading(true);
      const res = await api.get('/report-cards/class-students', {
        params: { classId, performanceType: 'term' },
      });
      setStudentList(res.data?.students || []);
    } catch (err) {
      console.error('Failed to load class students:', err);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 -> Step 3
  const handleSelectStudent = async (student: StudentReportStatus) => {
    setSelectedStudent(student);
    setStep('review');
    setHeadComment(student.headOfSchoolComment || '');
    setSaveSuccess(null);
    setErrorMessage(null);
    await loadStudentFullReport(student.studentId);
  };

  const loadStudentFullReport = async (studentId: string) => {
    try {
      setLoading(true);
      const res = await api.get('/report-cards/student', {
        params: { studentId, performanceType: 'term' },
      });
      setReportData(res.data);
      if (res.data?.result?.headOfSchoolComment) {
        setHeadComment(res.data.result.headOfSchoolComment);
      }
    } catch (err: any) {
      console.error('Failed to load student full report:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to load student report card details.');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Save Comment & Approve
  const handleSaveComment = async () => {
    if (!headComment || !headComment.trim()) {
      alert("Please enter the Head Teacher's / Principal's comment.");
      return;
    }

    if (!reportData?.result?._id) return;

    try {
      setSavingComment(true);
      setErrorMessage(null);
      setSaveSuccess(null);

      await api.put('/results/head-comment', {
        resultId: reportData.result._id,
        comment: headComment.trim(),
      });

      setSaveSuccess("Head Teacher's comment saved and report card APPROVED for printing!");
      // Reload updated report card
      await loadStudentFullReport(selectedStudent!.studentId);

      // Also refresh student list in background
      if (selectedClass) {
        loadClassStudents(selectedClass._id);
      }
    } catch (err: any) {
      console.error('Save comment error:', err);
      setErrorMessage(err.response?.data?.error || "Failed to save comment.");
    } finally {
      setSavingComment(false);
    }
  };

  // Step 5: Print Report
  const handlePrint = () => {
    if (!canPrint) {
      alert('Printing is only permitted once the teacher has completed the result sheet and the Head Teacher has saved a comment.');
      return;
    }
    printElement('printable-report-card', `Report Card - ${selectedStudent?.fullName || 'Student'}`);
  };

  // Check if printing is enabled
  const canPrint = Boolean(
    reportData?.canPrint ||
    (reportData?.result?.isCompleted && reportData?.result?.isApproved && headComment?.trim())
  );

  const filteredClasses = classList.filter((cls) => {
    const q = classSearch.toLowerCase();
    return cls.name.toLowerCase().includes(q) || cls.assignedTeachers.join(' ').toLowerCase().includes(q);
  });

  const filteredStudents = studentList.filter((s) => {
    const q = studentSearch.toLowerCase();
    return s.fullName.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q);
  });

  if (!loading && !hasActiveTerm) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg shadow-sm">
          <div className="flex items-start">
            <ShieldAlert className="h-7 w-7 text-amber-500 mr-4 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-bold text-amber-900">Active Academic Session Required</h2>
              <p className="mt-2 text-sm text-amber-800 leading-relaxed">
                Report Cards require an active academic session and term to be configured centrally in Settings.
                Currently, no active session is configured.
              </p>
              {currentUser?.role === 'admin' && (
                <div className="mt-4">
                  <a
                    href="/settings"
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-md shadow-xs text-white bg-amber-600 hover:bg-amber-700"
                  >
                    Go to Settings →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header (Hidden when printing) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Cards</h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 'classes' && 'Step 1: Select a class to review student completion and Head Teacher approvals.'}
            {step === 'students' && selectedClass && (
              <>
                Step 2: Class <strong className="text-indigo-600">{selectedClass.name}</strong> • Select a student to review and approve report.
              </>
            )}
            {step === 'review' && selectedStudent && (
              <>
                Step 3 & 4: Reviewing Report Card for <strong className="text-indigo-600">{selectedStudent.fullName}</strong> ({selectedStudent.admissionNo})
              </>
            )}
          </p>
        </div>

        {hasActiveTerm && activePeriod && (
          <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3.5 py-1.5 rounded-full text-xs font-semibold self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              Active Period: {activePeriod.session?.year || 'Current'} · Term {activePeriod.session?.currentTerm || activePeriod.period?.termId?.name || 'Term'}
            </span>
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex items-center print:hidden shadow-xs">
          <CheckCircle className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0" />
          <span className="text-sm font-medium">{saveSuccess}</span>
        </div>
      )}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg flex items-center print:hidden shadow-xs">
          <AlertCircle className="h-5 w-5 text-rose-500 mr-3 flex-shrink-0" />
          <span className="text-sm font-medium">{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: SELECT CLASS */}
      {/* ========================================================================= */}
      {step === 'classes' && (
        <div className="space-y-5 print:hidden">
          <div className="relative max-w-md">
            <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search classes..."
              value={classSearch}
              onChange={(e) => setClassSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
              <p>Loading school classes and report status...</p>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-lg border border-gray-200 text-gray-500">
              <BookOpen className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="font-semibold text-gray-700">No classes found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredClasses.map((cls) => {
                return (
                  <div
                    key={cls._id}
                    onClick={() => handleSelectClass(cls)}
                    className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                          {cls.arm || 'C'}
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {cls.studentCount} Students
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 mt-3 group-hover:text-indigo-600 transition-colors">
                        {cls.name}
                      </h3>

                      <p className="text-xs text-gray-500 mt-1">
                        Teacher: <span className="text-gray-700 font-medium">{cls.assignedTeachers?.length ? cls.assignedTeachers.join(', ') : 'Unassigned'}</span>
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-gray-100 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Teacher Completed Results:</span>
                        <strong className="text-emerald-700">{cls.completedResultsCount} / {cls.studentCount}</strong>
                      </div>
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Awaiting Head Teacher Comment:</span>
                        <strong className="text-amber-700">{cls.awaitingHeadCommentCount}</strong>
                      </div>
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Approved & Ready to Print:</span>
                        <strong className="text-indigo-700">{cls.approvedCount}</strong>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-indigo-600 font-semibold">
                        <span>Select Class</span>
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: SELECT STUDENT */}
      {/* ========================================================================= */}
      {step === 'students' && selectedClass && (
        <div className="space-y-5 print:hidden">
          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
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
              Class: <strong className="text-gray-800">{selectedClass.name}</strong>
            </span>
          </div>

          <div className="relative max-w-md">
            <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search student by name or admission number..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
              <p>Loading class students...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-lg border border-gray-200 text-gray-500">
              <Users className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="font-semibold text-gray-700">No students found</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-5 py-3 text-left">Student Name</th>
                    <th className="px-5 py-3 text-left">Admission No</th>
                    <th className="px-5 py-3 text-left">Teacher Result Status</th>
                    <th className="px-5 py-3 text-left">Head Teacher Comment</th>
                    <th className="px-5 py-3 text-left">Report Availability</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStudents.map((s) => (
                    <tr
                      key={s.studentId}
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
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono text-gray-600">
                        {s.admissionNo}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {s.isCompleted ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="h-3 w-3 mr-1 text-emerald-600" /> Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <Clock className="h-3 w-3 mr-1 text-amber-600" /> Incomplete
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {s.hasHeadComment ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="h-3 w-3 mr-1 text-emerald-600" /> Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {s.reportAvailability === 'ready' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                            Ready to Print
                          </span>
                        ) : s.reportAvailability === 'awaiting_head_comment' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Awaiting Comment
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-400">
                            Pending Completion
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm">
                        <span className="text-indigo-600 font-semibold text-xs inline-flex items-center">
                          Review & Comment <ChevronRight className="h-3 w-3 ml-0.5" />
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

      {/* ========================================================================= */}
      {/* STEP 3 & 4: REVIEW & APPROVAL WORKFLOW */}
      {/* ========================================================================= */}
      {step === 'review' && selectedStudent && selectedClass && (
        <div className="space-y-6">
          {/* Action Bar (Hidden when printing) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-xs print:hidden">
            <button
              onClick={() => {
                setStep('students');
                setSelectedStudent(null);
                setReportData(null);
              }}
              className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-indigo-600"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Class Students
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                disabled={!canPrint}
                className="inline-flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title={!canPrint ? 'Print Report is only enabled once the result is completed and Head Teacher comment is saved' : 'Print Official A4 Report Card'}
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Print Report Card
              </button>
            </div>
          </div>

          {/* Pending Teacher Completion Alert */}
          {!reportData?.result?.isCompleted && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-xs print:hidden">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <h4 className="font-bold">Teacher Result Incomplete</h4>
                  <p className="mt-1">
                    The teacher has not completed this student's result sheet yet. The Head Teacher's comment and report approval can only be entered after the teacher clicks "Complete Result".
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Head Teacher's Comment Box (Hidden when printing) */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs print:hidden space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Head Teacher's / Principal's Remark & Approval</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Saving this remark marks the report as approved and enables official printing.
                </p>
              </div>
              {reportData?.result?.isApproved && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Approved
                </span>
              )}
            </div>

            <textarea
              disabled={!reportData?.result?.isCompleted}
              rows={3}
              placeholder={
                reportData?.result?.isCompleted
                  ? "Enter Head Teacher's / Principal's official evaluation..."
                  : "Awaiting teacher completion before comment can be entered."
              }
              value={headComment}
              onChange={(e) => setHeadComment(e.target.value)}
              className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveComment}
                disabled={!reportData?.result?.isCompleted || savingComment || !headComment.trim()}
                className="inline-flex items-center px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {savingComment ? 'Saving & Approving...' : 'Save Comment & Approve'}
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* STEP 5: OFFICIAL PRINTABLE REPORT CARD (A4 LAYOUT) */}
          {/* ========================================================================= */}
          {reportData && (
            <div
              id="printable-report-card"
              className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-4xl mx-auto print:shadow-none print:border-none print:p-0 print:max-w-none"
            >
              {/* Universal Document Header */}
              <DocumentHeader
                title="TERMINAL ACADEMIC REPORT CARD"
                documentNumber={reportData.result?.verificationCode || ''}
                date={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              />

              <div className="text-center py-2 mb-4 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-xs font-bold text-gray-700 tracking-wide uppercase">
                  Academic Session: {reportData.sessionInfo?.year} &nbsp;•&nbsp; Term: {reportData.sessionInfo?.term?.toUpperCase()}
                </span>
              </div>

              {/* Student Summary Info Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 border border-gray-200 p-4 rounded-lg mb-6 text-xs">
                <div>
                  <span className="text-gray-500 block">Student Name:</span>
                  <span className="font-bold text-gray-900 text-sm">{selectedStudent.fullName}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Admission Number:</span>
                  <span className="font-mono font-bold text-gray-900">{selectedStudent.admissionNo}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Class:</span>
                  <span className="font-bold text-gray-900">{selectedClass.name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Verification Code:</span>
                  <span className="font-mono font-bold text-indigo-700">{reportData.result?.verificationCode || '—'}</span>
                </div>
              </div>

              {/* Performance Metrics Highlight */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg mb-6 text-center text-xs">
                <div>
                  <span className="text-indigo-600 block font-medium">Marks Obtained</span>
                  <span className="text-base font-bold text-indigo-950">
                    {reportData.result?.totalScore} / {reportData.result?.totalAvailableMarks || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-indigo-600 block font-medium">Overall Percentage</span>
                  <span className="text-base font-bold text-indigo-950">
                    {reportData.result?.percentage || reportData.result?.averageScore}%
                  </span>
                </div>
                <div>
                  <span className="text-indigo-600 block font-medium">Class Position</span>
                  <span className="text-base font-bold text-indigo-950">
                    {reportData.result?.classPosition ? `#${reportData.result.classPosition}` : 'Unranked'}
                  </span>
                </div>
                <div>
                  <span className="text-indigo-600 block font-medium">Class Average</span>
                  <span className="text-base font-bold text-indigo-950">
                    {reportData.result?.classAverage ? `${reportData.result.classAverage}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Subject Scores Table */}
              <div className="mb-6">
                <table className="min-w-full divide-y-2 divide-gray-200 border border-gray-200 text-xs">
                  <thead className="bg-gray-100 font-bold text-gray-700 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Subject</th>
                      <th className="px-2 py-2 text-center">CA 1</th>
                      <th className="px-2 py-2 text-center">CA 2</th>
                      <th className="px-2 py-2 text-center">Exam</th>
                      <th className="px-2 py-2 text-center">Total (%)</th>
                      <th className="px-2 py-2 text-center">Grade</th>
                      <th className="px-3 py-2 text-left">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(reportData.result?.subjectScores || []).map((score: SubjectScore) => (
                      <tr key={score.subjectId}>
                        <td className="px-3 py-2 font-medium text-gray-900">{score.subjectName}</td>
                        <td className="px-2 py-2 text-center">{score.ca1}</td>
                        <td className="px-2 py-2 text-center">{score.ca2}</td>
                        <td className="px-2 py-2 text-center">{score.exam}</td>
                        <td className="px-2 py-2 text-center font-bold text-gray-900">{score.total}</td>
                        <td className="px-2 py-2 text-center font-bold">{score.grade}</td>
                        <td className="px-3 py-2 text-gray-600 italic">{score.gradeDescription || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Affective & Psychomotor Domains */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 text-xs">
                {reportData.result?.affectiveDomain?.length > 0 && (
                  <div className="border border-gray-200 rounded p-3 bg-gray-50/40">
                    <h4 className="font-bold text-gray-900 uppercase mb-2">Affective Domain (1-5)</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {reportData.result.affectiveDomain.map((a: AffectiveRating) => (
                        <div key={a.trait} className="flex justify-between border-b pb-1">
                          <span className="text-gray-600">{a.trait}:</span>
                          <span className="font-bold text-gray-900">{a.rating} / 5</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reportData.result?.psychomotorSkills?.length > 0 && (
                  <div className="border border-gray-200 rounded p-3 bg-gray-50/40">
                    <h4 className="font-bold text-gray-900 uppercase mb-2">Psychomotor Skills (1-5)</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {reportData.result.psychomotorSkills.map((p: PsychomotorRating) => (
                        <div key={p.trait} className="flex justify-between border-b pb-1">
                          <span className="text-gray-600">{p.trait}:</span>
                          <span className="font-bold text-gray-900">{p.rating} / 5</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Comments & Signatures */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t-2 border-gray-300 text-xs">
                <div className="border border-gray-200 p-4 rounded-lg bg-gray-50/50 flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block mb-1">Class Teacher's Remark:</span>
                    <p className="italic text-gray-700 min-h-[40px]">
                      {reportData.result?.teacherComment || 'No comment recorded.'}
                    </p>
                  </div>
                  <div className="mt-8 pt-2 border-t border-gray-400 flex justify-between text-gray-500 font-medium">
                    <span>Class Teacher's Signature</span>
                  </div>
                </div>

                <div className="border border-gray-200 p-4 rounded-lg bg-gray-50/50 flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block mb-1">Head of School / Principal's Remark:</span>
                    <p className="italic text-gray-700 min-h-[40px]">
                      {reportData.result?.headOfSchoolComment || headComment || 'Pending Head Teacher evaluation.'}
                    </p>
                  </div>
                  <div className="mt-8 pt-2 border-t border-gray-400 flex items-center justify-between text-gray-500 font-medium">
                    <span>Principal's Signature & Stamp</span>
                    {reportData.school?.signatureUrl && (
                      <img src={reportData.school.signatureUrl} alt="Signature" className="h-7 object-contain" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportCard;
