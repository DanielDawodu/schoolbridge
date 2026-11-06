import React, { useEffect, useState } from 'react';
import { Trophy, CheckCircle2, BarChart3 } from 'lucide-react';
import api from '../services/api';

interface ClassGroup {
  _id: string;
  name: string;
  arm: string;
  sessionId: string | { _id: string }; // Allow both string ID and populated object
}

interface AcademicSession {
  _id: string;
  year: string;
  currentTerm: string;
}

const Classes: React.FC = () => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);

  // Active Tab: 'classes' | 'completion' | 'leaderboard'
  const [activeTab, setActiveTab] = useState<'classes' | 'completion' | 'leaderboard'>('classes');

  // Filter states
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<'term' | 'mid-term'>('term');

  // Completion tracker data
  const [completionData, setCompletionData] = useState<any>(null);
  const [loadingCompletion, setLoadingCompletion] = useState(false);

  // Leaderboard data
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    arm: '',
    sessionId: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [classesRes, sessionsRes] = await Promise.all([
        api.get('/classes'),
        api.get('/academic-sessions'),
      ]);
      setClasses(classesRes.data);
      setSessions(sessionsRes.data);
      if (classesRes.data.length > 0) {
        setSelectedClassId(classesRes.data[0]._id);
      }
      if (sessionsRes.data.length > 0) {
        setSelectedSessionId(sessionsRes.data[0]._id);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletion = async (clsId?: string, sessId?: string, pType?: string) => {
    const cId = clsId || selectedClassId;
    const sId = sessId || selectedSessionId;
    const perfType = pType || selectedAssessmentType;
    if (!cId) return;

    try {
      setLoadingCompletion(true);
      const res = await api.get('/results/completion', {
        params: {
          classId: cId,
          sessionId: sId,
          performanceType: perfType,
        },
      });
      setCompletionData(res.data);
    } catch (err) {
      console.error('Failed to fetch completion tracker:', err);
    } finally {
      setLoadingCompletion(false);
    }
  };

  const fetchLeaderboard = async (clsId?: string, sessId?: string, pType?: string) => {
    const cId = clsId || selectedClassId;
    const sId = sessId || selectedSessionId;
    const perfType = pType || selectedAssessmentType;
    if (!cId) return;

    try {
      setLoadingLeaderboard(true);
      const res = await api.get('/results/leaderboard', {
        params: {
          classId: cId,
          sessionId: sId,
          performanceType: perfType,
        },
      });
      setLeaderboardData(res.data);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    if (selectedClassId) {
      if (activeTab === 'completion') {
        fetchCompletion();
      } else if (activeTab === 'leaderboard') {
        fetchLeaderboard();
      }
    }
  }, [selectedClassId, selectedSessionId, selectedAssessmentType, activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClass) {
        await api.put(`/classes/${editingClass._id}`, formData);
      } else {
        await api.post('/classes', formData);
      }
      setShowModal(false);
      setEditingClass(null);
      setFormData({ name: '', arm: '', sessionId: '' });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save class');
    }
  };

  const handleEdit = (classGroup: ClassGroup) => {
    setEditingClass(classGroup);
    const sessionId = typeof classGroup.sessionId === 'object'
      ? classGroup.sessionId._id
      : classGroup.sessionId;
    setFormData({
      name: classGroup.name,
      arm: classGroup.arm,
      sessionId: sessionId || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this class?')) return;
    try {
      await api.delete(`/classes/${id}`);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete class');
    }
  };

  const openModal = () => {
    setEditingClass(null);
    setFormData({ name: '', arm: '', sessionId: sessions[0]?._id || '' });
    setShowModal(true);
  };

  const viewClassLeaderboard = (classId: string) => {
    setSelectedClassId(classId);
    setActiveTab('leaderboard');
  };

  const viewClassCompletion = (classId: string) => {
    setSelectedClassId(classId);
    setActiveTab('completion');
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const selectedClass = classes.find((c) => c._id === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Management & Performance</h1>
          <p className="text-sm text-gray-500">
            Manage classes, inspect academic leaderboards, and monitor report completion
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {activeTab === 'classes' && (
            <button
              onClick={openModal}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm"
            >
              Add Class
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('classes')}
            className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'classes'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Classes ({classes.length})
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`py-3 px-1 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'leaderboard'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Class Leaderboard</span>
          </button>
          <button
            onClick={() => setActiveTab('completion')}
            className={`py-3 px-1 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'completion'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span>Completion Tracker</span>
          </button>
        </nav>
      </div>

      {/* TAB 1: ALL CLASSES TABLE */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          {classes.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500 mb-4">No classes found</p>
              <button
                onClick={openModal}
                className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
              >
                Create your first class
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Arm
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Academic Session
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance & Reports
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {classes.map((classGroup) => {
                    const sessionId = typeof classGroup.sessionId === 'object'
                      ? classGroup.sessionId._id
                      : classGroup.sessionId;
                    const session = sessions.find((s) => s._id === sessionId);
                    return (
                      <tr key={classGroup._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {classGroup.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {classGroup.arm}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {session ? `${session.year} - ${session.currentTerm}` : 'Not assigned'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          <div className="inline-flex items-center space-x-2">
                            <button
                              onClick={() => viewClassLeaderboard(classGroup._id)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors"
                            >
                              <Trophy className="w-3.5 h-3.5" />
                              <span>Leaderboard</span>
                            </button>
                            <button
                              onClick={() => viewClassCompletion(classGroup._id)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                              <span>Completion</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                          <button
                            onClick={() => handleEdit(classGroup)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(classGroup._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
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

      {/* SHARED CONTROLS BAR FOR LEADERBOARD & COMPLETION TABS */}
      {(activeTab === 'leaderboard' || activeTab === 'completion') && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Select Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500"
              >
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} - {c.arm}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Academic Session</label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500"
              >
                {sessions.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.year} - {s.currentTerm}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assessment Type</label>
              <select
                value={selectedAssessmentType}
                onChange={(e) => setSelectedAssessmentType(e.target.value as 'term' | 'mid-term')}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500"
              >
                <option value="term">Full Term</option>
                <option value="mid-term">Mid-Term</option>
              </select>
            </div>
          </div>

          <div>
            <button
              onClick={() => (activeTab === 'leaderboard' ? fetchLeaderboard() : fetchCompletion())}
              disabled={loadingLeaderboard || loadingCompletion}
              className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-3.5 py-2 rounded-md hover:bg-indigo-100 font-medium transition-colors"
            >
              {loadingLeaderboard || loadingCompletion ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: CLASS LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          {loadingLeaderboard ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
              <p className="text-sm text-gray-500">Calculating student rankings and class averages...</p>
            </div>
          ) : !leaderboardData || leaderboardData.leaderboard?.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center border border-dashed border-gray-300">
              <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900">No Published Rankings Available</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
                Student rankings appear once teachers complete results. Students with incomplete results are excluded from the official class leaderboard.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Leaderboard Summary Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
                  <span className="text-xs font-medium text-amber-800">Class Average Percentage</span>
                  <p className="text-2xl font-bold text-amber-900 mt-1">
                    {leaderboardData.classAveragePercentage}%
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">Average across all completed students</p>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4">
                  <span className="text-xs font-medium text-indigo-800">Ranked Students</span>
                  <p className="text-2xl font-bold text-indigo-900 mt-1">
                    {leaderboardData.completedStudentsCount} / {leaderboardData.totalStudentsInClass}
                  </p>
                  <p className="text-xs text-indigo-700 mt-0.5">Completed result sheets published</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
                  <span className="text-xs font-medium text-emerald-800">Top Position Score</span>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">
                    {leaderboardData.leaderboard[0]?.overallPercentage || 0}%
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {leaderboardData.leaderboard[0]?.fullName}
                  </p>
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Official Academic Rankings: {selectedClass ? `${selectedClass.name} - ${selectedClass.arm}` : ''}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Standard competition ranking (1st, 1st, 3rd) based on overall percentage
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-green-100 text-green-800 rounded-full">
                    Completed Results Only
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">
                          Rank
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                          Student Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                          Admission No
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                          Total Marks
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                          Overall %
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                          Class Avg %
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {leaderboardData.leaderboard.map((item: any) => {
                        return (
                          <tr
                            key={item.studentId}
                            className={`hover:bg-gray-50 transition-colors ${
                              item.position === 1 ? 'bg-amber-50/40' : ''
                            }`}
                          >
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex items-center justify-center font-bold rounded-full ${
                                  item.position === 1
                                    ? 'w-7 h-7 bg-amber-400 text-amber-950 text-xs shadow-sm'
                                    : item.position === 2
                                    ? 'w-7 h-7 bg-slate-300 text-slate-800 text-xs'
                                    : item.position === 3
                                    ? 'w-7 h-7 bg-amber-700 text-white text-xs'
                                    : 'text-gray-700 text-xs font-semibold'
                                }`}
                              >
                                {item.position === 1 ? '1st' : item.position === 2 ? '2nd' : item.position === 3 ? '3rd' : `${item.position}th`}
                              </span>
                            </td>
                            <td className="px-6 py-3 font-medium text-gray-900">
                              <div className="flex items-center space-x-2">
                                <span>{item.fullName}</span>
                                {item.position === 1 && (
                                  <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                              {item.admissionNo}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-gray-800">
                              {item.totalScore}
                              {item.totalAvailableMarks > 0 && (
                                <span className="text-gray-400 font-normal text-xs">
                                  {' '}/ {item.totalAvailableMarks}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-bold text-indigo-600 text-sm">
                                {item.overallPercentage}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-500 text-xs">
                              {item.classAveragePercentage}%
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  item.isApproved
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {item.isApproved ? 'Approved' : 'Completed'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COMPLETION TRACKER */}
      {activeTab === 'completion' && (
        <div className="space-y-4">
          {loadingCompletion ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
              <p className="text-sm text-gray-500">Checking class completion records...</p>
            </div>
          ) : !completionData ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500 text-sm">Select a class to view report completion details.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 mb-4 gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Result Completion: {selectedClass ? `${selectedClass.name} - ${selectedClass.arm}` : ''}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Track which students have completed teacher submissions and Head Teacher comments
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="text-xs text-gray-500 font-medium">Total Students</span>
                  <p className="text-xl font-bold text-gray-900">{completionData.totalStudents}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <span className="text-xs text-green-700 font-medium">Teacher Completed</span>
                  <p className="text-xl font-bold text-green-700">{completionData.completedCount}</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <span className="text-xs text-amber-700 font-medium">Pending / Incomplete</span>
                  <p className="text-xl font-bold text-amber-700">{completionData.pendingCount}</p>
                </div>
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                  <span className="text-xs text-indigo-700 font-medium">Completion Rate</span>
                  <p className="text-xl font-bold text-indigo-700">{completionData.completionPercentage}%</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${completionData.completionPercentage}%` }}
                ></div>
              </div>

              {/* Students completion list */}
              {completionData.students && completionData.students.length > 0 ? (
                <div className="overflow-x-auto border border-gray-200 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-500">Student</th>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-500">Admission No</th>
                        <th className="px-4 py-2.5 text-center font-medium text-gray-500">Teacher Result</th>
                        <th className="px-4 py-2.5 text-center font-medium text-gray-500">Head Teacher Comment</th>
                        <th className="px-4 py-2.5 text-center font-medium text-gray-500">Percentage</th>
                        <th className="px-4 py-2.5 text-center font-medium text-gray-500">Rank</th>
                        <th className="px-4 py-2.5 text-right font-medium text-gray-500">Printable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {completionData.students.map((st: any) => (
                        <tr key={st.studentId} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900">{st.fullName}</td>
                          <td className="px-4 py-2 text-gray-500 font-mono">{st.admissionNo}</td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                                st.isComplete
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {st.isComplete ? 'Complete' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                                st.hasHeadTeacherComment
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {st.hasHeadTeacherComment ? 'Added' : 'Awaiting'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center font-semibold text-gray-700">
                            {st.isComplete ? `${st.percentage}%` : '-'}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {st.isComplete && st.classPosition ? (
                              <span className="font-semibold text-indigo-700 text-xs">
                                #{st.classPosition}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span
                              className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                                st.isApproved
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {st.isApproved ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No active students in this class.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL FOR ADDING/EDITING CLASS */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingClass ? 'Edit Class' : 'Add New Class'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., JSS 1"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arm</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., A"
                  value={formData.arm}
                  onChange={(e) => setFormData({ ...formData, arm: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Academic Session
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.sessionId}
                  onChange={(e) => setFormData({ ...formData, sessionId: e.target.value })}
                >
                  <option value="">Select Session</option>
                  {sessions.map((session) => (
                    <option key={session._id} value={session._id}>
                      {session.year} - {session.currentTerm}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
                >
                  {editingClass ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Classes;
