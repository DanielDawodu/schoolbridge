import React, { useEffect, useState } from 'react';
import { Trophy, CheckCircle2, BarChart3, Layers } from 'lucide-react';
import api from '../services/api';

interface ClassGroup {
  _id: string;
  name?: string;
  arm: string;
  faction?: 'Science' | 'Arts' | 'Commercial' | null;
  classLevelId?: { _id: string; name: string };
  sessionId?: string | { _id: string }; // Allow both string ID and populated object
  periodId?: any;
  studentCount?: number;
}

interface AcademicSession {
  _id: string;
  year: string;
  currentTerm: string;
}

interface ClassLevelItem {
  _id: string;
  name: string;
  levelOrder?: number;
}

const Classes: React.FC = () => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classLevels, setClassLevels] = useState<ClassLevelItem[]>([]);
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
    faction: '' as 'Science' | 'Arts' | 'Commercial' | '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [classesRes, sessionsRes, classLevelsRes] = await Promise.all([
        api.get('/classes'),
        api.get('/academic-sessions'),
        api.get('/class-levels').catch(() => ({ data: [] })),
      ]);
      setClasses(classesRes.data);
      setSessions(sessionsRes.data);
      setClassLevels(classLevelsRes.data || []);
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
      const matchingLevel = classLevels.find(
        (lvl) => lvl.name.trim().toLowerCase() === formData.name.trim().toLowerCase()
      );

      const payload = {
        name: formData.name.trim(),
        className: formData.name.trim(),
        classLevelId: matchingLevel?._id || editingClass?.classLevelId?._id,
        arm: formData.arm.trim(),
        sessionId: formData.sessionId,
        periodId: formData.sessionId,
        faction: formData.faction || null,
      };

      if (editingClass) {
        await api.put(`/classes/${editingClass._id}`, payload);
      } else {
        await api.post('/classes', payload);
      }
      setShowModal(false);
      setEditingClass(null);
      setFormData({ name: '', arm: '', sessionId: '', faction: '' });
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
    const className = classGroup.name || (classGroup.classLevelId as any)?.name || '';
    setFormData({
      name: className,
      arm: classGroup.arm,
      sessionId: sessionId || '',
      faction: classGroup.faction || '',
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
    setFormData({ name: '', arm: '', sessionId: sessions[0]?._id || '', faction: '' });
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
            Manage classes, specialisation streams (factions), academic leaderboards, and report completion
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {activeTab === 'classes' && (
            <button
              onClick={openModal}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium shadow-xs"
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
            <div className="bg-white rounded-lg shadow-xs p-12 text-center">
              <p className="text-gray-500 mb-4">No classes found</p>
              <button
                onClick={openModal}
                className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
              >
                Create your first class
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-xs overflow-hidden border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class Level & Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Arm
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stream / Faction
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
                    const displayName = classGroup.name || (classGroup.classLevelId as any)?.name || 'Class';
                    const sessionLabel = session
                      ? `${session.year} - ${session.currentTerm}`
                      : (classGroup as any).periodId?.sessionId?.year
                      ? `${(classGroup as any).periodId.sessionId.year} - ${(classGroup as any).periodId.termId?.name || 'Term'}`
                      : 'Not assigned';
                    return (
                      <tr key={classGroup._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {displayName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {classGroup.arm}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {classGroup.faction ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                              <Layers className="w-3 h-3 mr-1" />
                              {classGroup.faction}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">General</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sessionLabel}
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

      {/* TAB 2: CLASS LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg shadow-xs border border-gray-200 flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name || (c.classLevelId as any)?.name} - {c.arm} {c.faction ? `(${c.faction})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assessment Type</label>
              <select
                value={selectedAssessmentType}
                onChange={(e) => setSelectedAssessmentType(e.target.value as any)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="term">Full Term Report</option>
                <option value="mid-term">Mid-Term / Half-Term</option>
              </select>
            </div>
          </div>

          {loadingLeaderboard ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : leaderboardData && leaderboardData.leaderboard ? (
            <div className="bg-white rounded-lg shadow-xs overflow-hidden border border-gray-200">
              <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-sm">
                  Academic Rankings: {selectedClass?.name || (selectedClass?.classLevelId as any)?.name} - {selectedClass?.arm}
                </h3>
                <span className="text-xs text-gray-500">
                  Total Ranked: {leaderboardData.leaderboard.length} students
                </span>
              </div>
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-3 text-center w-16">Position</th>
                    <th className="px-6 py-3 text-left">Student</th>
                    <th className="px-6 py-3 text-left">Admission No</th>
                    <th className="px-6 py-3 text-right">Total Score</th>
                    <th className="px-6 py-3 text-right">Average (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {leaderboardData.leaderboard.map((item: any, idx: number) => (
                    <tr key={idx} className={idx < 3 ? 'bg-amber-50/40' : ''}>
                      <td className="px-6 py-3 text-center font-bold">
                        {item.position === 1 ? '🥇 1st' : item.position === 2 ? '🥈 2nd' : item.position === 3 ? '🥉 3rd' : `${item.position}th`}
                      </td>
                      <td className="px-6 py-3 font-semibold text-gray-900">{item.fullName}</td>
                      <td className="px-6 py-3 text-gray-500">{item.admissionNo}</td>
                      <td className="px-6 py-3 text-right font-medium">{item.totalScore}</td>
                      <td className="px-6 py-3 text-right font-bold text-indigo-700">{item.overallPercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow-xs border border-gray-200">
              No completed results available to generate leaderboard for this class.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COMPLETION TRACKER */}
      {activeTab === 'completion' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg shadow-xs border border-gray-200 flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name || (c.classLevelId as any)?.name} - {c.arm} {c.faction ? `(${c.faction})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assessment Type</label>
              <select
                value={selectedAssessmentType}
                onChange={(e) => setSelectedAssessmentType(e.target.value as any)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="term">Full Term Report</option>
                <option value="mid-term">Mid-Term / Half-Term</option>
              </select>
            </div>
          </div>

          {loadingCompletion ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : completionData ? (
            <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200 space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Result Completion Status: {completionData.className}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Total Students: {completionData.totalStudents} | Completed: {completionData.completedStudents} | Awaiting: {completionData.awaitingCompletion}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-indigo-600">
                    {completionData.completionPercentage}%
                  </span>
                  <span className="block text-[11px] text-gray-400 font-medium">COMPLETED</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${completionData.completionPercentage}%` }}
                />
              </div>

              {/* Student status table */}
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Student Name</th>
                    <th className="px-4 py-2 text-left">Admission No</th>
                    <th className="px-4 py-2 text-center">Result Status</th>
                    <th className="px-4 py-2 text-center">Head Teacher Remark</th>
                    <th className="px-4 py-2 text-center">Print Ready</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(completionData.students || []).map((s: any) => (
                    <tr key={s.studentId}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{s.fullName}</td>
                      <td className="px-4 py-2.5 text-gray-500">{s.admissionNo}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            s.isCompleted
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.isCompleted ? 'Completed' : 'Pending Scores'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            s.hasPrincipalComment
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {s.hasPrincipalComment ? 'Signed' : 'Awaiting'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            s.isPrintable
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {s.isPrintable ? 'Ready' : 'Locked'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow-xs border border-gray-200">
              No completion data found.
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
                  Class Name / Level
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="e.g., JSS 1, SS 2"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  list="class-level-suggestions"
                />
                <datalist id="class-level-suggestions">
                  {classLevels.map((lvl) => (
                    <option key={lvl._id} value={lvl.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arm / Section</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="e.g., Gold, A, Diamond"
                  value={formData.arm}
                  onChange={(e) => setFormData({ ...formData, arm: e.target.value })}
                />
              </div>

              {/* Faction / Specialisation Stream */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Academic Stream / Faction
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  value={formData.faction}
                  onChange={(e) => setFormData({ ...formData, faction: e.target.value as any })}
                >
                  <option value="">None / General (Junior Sec / Primary)</option>
                  <option value="Science">Science</option>
                  <option value="Arts">Arts / Humanities</option>
                  <option value="Commercial">Commercial / Business Studies</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  For Senior Secondary classes, setting a stream links curriculum subjects and automatically filters result entry.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Academic Session
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
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
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-semibold shadow-xs"
                >
                  {editingClass ? 'Update Class' : 'Create Class'}
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
