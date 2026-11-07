import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  School,
  Trophy,
  CheckCircle2,
  Clock,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface ClassWithPeriod {
  _id: string;
  name?: string;
  classLevelId: string | { _id: string; name: string };
  arm: string;
  periodId: string | { _id: string };
  period?: {
    session?: {
      year: string;
    };
    term?: {
      name: string;
    };
  };
}

const Dashboard: React.FC = () => {
  const { school, user } = useAuth();
  const [stats, setStats] = useState<{
    totalStudents: number;
    totalClasses: number;
    attendanceSummary: any;
    feesSummary: any;
    academicStats?: any;
    adminAcademicStats?: any;
    onboardingChecklist?: any;
  }>({
    totalStudents: 0,
    totalClasses: 0,
    attendanceSummary: null,
    feesSummary: null,
    academicStats: null,
    adminAcademicStats: null,
    onboardingChecklist: null,
  });
  const [assignedClasses, setAssignedClasses] = useState<ClassWithPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChecklist, setShowChecklist] = useState<boolean>(true);

  // Teacher specific leaderboard filter
  const [selectedTeacherClassId, setSelectedTeacherClassId] = useState<string>('all');
  const [teacherSpecificLeaderboard, setTeacherSpecificLeaderboard] = useState<any[] | null>(null);
  const [loadingTeacherLeaderboard, setLoadingTeacherLeaderboard] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, classesRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/classes'),
      ]);
      setStats(statsRes.data);
      setAssignedClasses(classesRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherClassChange = async (classId: string) => {
    setSelectedTeacherClassId(classId);
    if (classId === 'all') {
      setTeacherSpecificLeaderboard(null);
      return;
    }

    try {
      setLoadingTeacherLeaderboard(true);
      const res = await api.get('/results/leaderboard', {
        params: { classId },
      });
      setTeacherSpecificLeaderboard(res.data.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch teacher class leaderboard:', error);
      setTeacherSpecificLeaderboard([]);
    } finally {
      setLoadingTeacherLeaderboard(false);
    }
  };

  const collectionPercent = stats.feesSummary?.totalExpected
    ? ((stats.feesSummary.totalCollected / stats.feesSummary.totalExpected) * 100).toFixed(1)
    : '0';

  const teacherLeaderboardDisplay =
    selectedTeacherClassId === 'all'
      ? stats.academicStats?.leaderboard || []
      : teacherSpecificLeaderboard || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-600">
            Welcome back, {user?.role === 'teacher' ? user?.name : school?.name}
          </p>
        </div>
        {user?.role === 'admin' && (
          <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
            Active Period: <span className="font-semibold text-gray-800">{stats.feesSummary?.termName || 'Central Session'}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Link to="/students" className="block">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {user?.role === 'teacher' ? 'My Students' : 'Total Students'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.totalStudents}</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link to="/classes" className="block">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <School className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {user?.role === 'teacher' ? 'My Classes' : 'Total Classes'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.totalClasses}</p>
                  </div>
                </div>
              </div>
            </Link>

            {/* Admin Metric: Awaiting Head Comments */}
            {user?.role === 'admin' && (
              <Link to="/report-cards" className="block">
                <div className="bg-white rounded-lg shadow-sm border border-amber-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">
                        Awaiting Comments
                      </p>
                      <p className="text-2xl font-bold text-amber-900 mt-0.5">
                        {stats.adminAcademicStats?.reportsAwaitingHeadComment || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Admin Metric: Approved & Printable Reports */}
            {user?.role === 'admin' && (
              <Link to="/report-cards" className="block">
                <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-xs font-medium text-blue-700 uppercase tracking-wider">
                        Printable Reports
                      </p>
                      <p className="text-2xl font-bold text-blue-900 mt-0.5">
                        {stats.adminAcademicStats?.completedAndPrintableReports || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Teacher Metric: Completed Results */}
            {user?.role === 'teacher' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed Results
                    </p>
                    <p className="text-2xl font-bold text-green-700 mt-0.5">
                      {stats.academicStats?.completedCount || 0}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Teacher Metric: Awaiting Completion */}
            {user?.role === 'teacher' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Awaiting Completion
                    </p>
                    <p className="text-2xl font-bold text-yellow-700 mt-0.5">
                      {stats.academicStats?.awaitingCount || 0}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dynamic 9-Step Onboarding Checklist for Administrator */}
          {user?.role === 'admin' && stats.onboardingChecklist && (
            <div className="bg-white rounded-xl shadow-xs border border-indigo-100 overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-indigo-50/70 via-white to-indigo-50/40 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
                      {stats.onboardingChecklist.completedCount}
                    </span>
                    <h2 className="text-base font-bold text-gray-900">
                      School Launch & Onboarding Checklist
                    </h2>
                    {stats.onboardingChecklist.isAllComplete ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Complete & Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        {stats.onboardingChecklist.completedCount} of {stats.onboardingChecklist.totalSteps} Steps Complete
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Follow these foundational setup steps to ensure your school is fully configured for academic and financial operations.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-32 hidden sm:block">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          stats.onboardingChecklist.isAllComplete ? 'bg-emerald-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${stats.onboardingChecklist.progressPercentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 font-semibold block text-right mt-0.5">
                      {stats.onboardingChecklist.progressPercentage}% Complete
                    </span>
                  </div>

                  <button
                    onClick={() => setShowChecklist(!showChecklist)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                  >
                    {showChecklist ? 'Hide Checklist' : 'Show Checklist'}
                  </button>
                </div>
              </div>

              {showChecklist && (
                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {stats.onboardingChecklist.steps.map((step: any) => (
                    <Link
                      key={step.id}
                      to={step.route}
                      className={`p-3.5 rounded-lg border transition-all flex items-start gap-3 group ${
                        step.isComplete
                          ? 'bg-gray-50/60 border-gray-200 hover:bg-gray-50'
                          : 'bg-indigo-50/30 border-indigo-200 hover:bg-indigo-50/70 hover:shadow-2xs'
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {step.isComplete ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-indigo-400 flex items-center justify-center text-[10px] font-bold text-indigo-700 bg-white">
                            {step.step}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4
                            className={`text-xs font-bold truncate ${
                              step.isComplete
                                ? 'text-gray-700 line-through decoration-gray-400'
                                : 'text-gray-900 group-hover:text-indigo-600'
                            }`}
                          >
                            {step.title}
                          </h4>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-600 flex-shrink-0" />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TEACHER SECTION: COMPLETION PROGRESS & CLASS LEADERBOARD */}
          {user?.role === 'teacher' && (
            <div className="space-y-6">
              {/* Completion Progress Bar */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Term Result Completion Progress
                    </h2>
                    <p className="text-xs text-gray-500">
                      Track completion across your assigned classes and subjects
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link
                      to="/results"
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      Enter Full Term Results
                    </Link>
                    <Link
                      to="/half-term"
                      className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 transition-colors shadow-sm"
                    >
                      Enter Mid-Term Results
                    </Link>
                  </div>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                  <div
                    className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${stats.academicStats?.completionPercentage || 0}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-xs text-gray-500 font-medium">
                  <span>
                    {stats.academicStats?.completedCount || 0} of {stats.totalStudents} Students Completed
                  </span>
                  <span>{stats.academicStats?.completionPercentage || 0}% Complete</span>
                </div>
              </div>

              {/* Teacher Dashboard Leaderboard */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <h2 className="text-lg font-bold text-gray-900">Class Academic Leaderboard</h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Published rankings of completed results for your assigned classes
                    </p>
                  </div>

                  {/* Class Selector for Teacher */}
                  {assignedClasses.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 font-medium">Class:</span>
                      <select
                        value={selectedTeacherClassId}
                        onChange={(e) => handleTeacherClassChange(e.target.value)}
                        className="text-xs border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="all">All Assigned Classes</option>
                        {assignedClasses.map((cls) => {
                          const name =
                            typeof cls.classLevelId === 'object'
                              ? cls.classLevelId.name
                              : cls.name || 'Class';
                          return (
                            <option key={cls._id} value={cls._id}>
                              {name} - {cls.arm}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>

                {loadingTeacherLeaderboard ? (
                  <div className="p-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mb-2"></div>
                    <p className="text-xs text-gray-500">Loading rankings...</p>
                  </div>
                ) : teacherLeaderboardDisplay.length === 0 ? (
                  <div className="p-8 text-center">
                    <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">No Published Rankings Yet</p>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                      Student rankings appear automatically when results are marked as Complete.
                      Incomplete results are excluded from the leaderboard.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase w-16">
                            Rank
                          </th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase">
                            Student Name
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase">
                            Admission No
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase">
                            Total Marks
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase">
                            Overall %
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase">
                            Class Avg %
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {teacherLeaderboardDisplay.map((item: any, idx: number) => {
                          const pos = item.position || idx + 1;
                          return (
                            <tr
                              key={item.studentId || idx}
                              className={`hover:bg-gray-50 ${pos === 1 ? 'bg-amber-50/30' : ''}`}
                            >
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-flex items-center justify-center font-bold rounded-full text-xs ${pos === 1
                                      ? 'w-6 h-6 bg-amber-400 text-amber-950 shadow-xs'
                                      : pos === 2
                                        ? 'w-6 h-6 bg-slate-300 text-slate-800'
                                        : pos === 3
                                          ? 'w-6 h-6 bg-amber-700 text-white'
                                          : 'text-gray-700'
                                    }`}
                                >
                                  {pos === 1 ? '1st' : pos === 2 ? '2nd' : pos === 3 ? '3rd' : `${pos}th`}
                                </span>
                              </td>
                              <td className="px-6 py-3 font-medium text-gray-900">
                                {item.fullName}
                              </td>
                              <td className="px-4 py-3 font-mono text-gray-500">
                                {item.admissionNo}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-gray-800">
                                {item.totalScore}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-bold text-indigo-600">
                                  {item.overallPercentage}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-gray-500">
                                {item.classAveragePercentage}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ADMIN SECTION: CLASS COMPLETION PROGRESS & LEADERBOARD SUMMARY */}
          {user?.role === 'admin' && stats.adminAcademicStats && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Class-by-Class Completion Tracker */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Class Result Progress</h2>
                    <p className="text-xs text-gray-500">Teacher submission status by class</p>
                  </div>
                  <Link
                    to="/report-cards"
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                  >
                    Manage Reports <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Link>
                </div>

                <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  {stats.adminAcademicStats.classProgress?.map((cls: any) => (
                    <div key={cls.classId} className="border border-gray-100 rounded-md p-3">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-medium text-gray-800">{cls.className}</span>
                        <span className="text-gray-500 font-semibold">
                          {cls.completedCount} / {cls.totalStudents} completed ({cls.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${cls.percentage === 100
                              ? 'bg-green-600'
                              : cls.percentage > 50
                                ? 'bg-indigo-600'
                                : 'bg-amber-500'
                            }`}
                          style={{ width: `${cls.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* School Top Performers */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <h2 className="text-base font-bold text-gray-900">Top Academic Performers</h2>
                  </div>
                  <Link
                    to="/classes"
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                  >
                    View All Rankings <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Link>
                </div>

                {stats.adminAcademicStats.topLeaderboard?.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-gray-500">
                      Rankings will appear once teachers submit completed result sheets.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {stats.adminAcademicStats.topLeaderboard?.map((student: any, idx: number) => (
                      <div
                        key={student.studentId || idx}
                        className="flex items-center justify-between p-2.5 bg-gray-50 rounded-md text-xs hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${idx === 0
                                ? 'bg-amber-400 text-amber-950'
                                : idx === 1
                                  ? 'bg-slate-300 text-slate-800'
                                  : idx === 2
                                    ? 'bg-amber-700 text-white'
                                    : 'bg-gray-200 text-gray-700'
                              }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-semibold text-gray-900">{student.fullName}</p>
                            <p className="text-gray-400 font-mono text-[10px]">{student.admissionNo}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-indigo-600">{student.overallPercentage}%</p>
                          <p className="text-gray-500 text-[10px]">Total: {student.totalScore}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Today's Attendance for Admin */}
          {user?.role === 'admin' && stats.attendanceSummary && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Today's Attendance</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-2xl font-bold text-green-700">{stats.attendanceSummary.present}</p>
                  <p className="text-xs text-green-800 font-medium">Present</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100">
                  <p className="text-2xl font-bold text-red-700">{stats.attendanceSummary.absent}</p>
                  <p className="text-xs text-red-800 font-medium">Absent</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                  <p className="text-2xl font-bold text-yellow-700">{stats.attendanceSummary.late}</p>
                  <p className="text-xs text-yellow-800 font-medium">Late</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-2xl font-bold text-gray-500">{stats.attendanceSummary.unmarked || 0}</p>
                  <p className="text-xs text-gray-600 font-medium">Unmarked</p>
                </div>
              </div>
              <p className="text-center text-xs text-gray-500 mt-3">
                Total marked: {stats.attendanceSummary.totalMarked}
              </p>
            </div>
          )}

          {/* Fees Summary for Admin / Accountant */}
          {(user?.role === 'admin' || user?.role === 'accountant') && stats.feesSummary && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Central Term Billing & Collections</h2>
                  <p className="text-xs text-gray-500">{stats.feesSummary.termName || 'Active Term'}</p>
                </div>
                <Link
                  to="/fees"
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                >
                  Fee Management <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
                  <p className="text-xl font-bold text-blue-700">
                    ₦{stats.feesSummary.totalExpected.toLocaleString()}
                  </p>
                  <p className="text-xs text-blue-800 font-medium">Total Invoiced</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-100 text-center">
                  <p className="text-xl font-bold text-green-700">
                    ₦{stats.feesSummary.totalCollected.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-800 font-medium">Total Collected</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-100 text-center">
                  <p className="text-xl font-bold text-red-700">
                    ₦{stats.feesSummary.totalOutstanding.toLocaleString()}
                  </p>
                  <p className="text-xs text-red-800 font-medium">Total Outstanding</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-center">
                  <p className="text-xl font-bold text-purple-700">
                    ₦{stats.feesSummary.totalCarryover ? stats.feesSummary.totalCarryover.toLocaleString() : '0'}
                  </p>
                  <p className="text-xs text-purple-800 font-medium">Previous Debt Carried</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Collection Progress</span>
                  <span className="font-semibold">{collectionPercent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(parseFloat(collectionPercent), 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
