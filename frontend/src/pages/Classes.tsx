import React, { useEffect, useState } from 'react';
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
  const [selectedTrackerClass, setSelectedTrackerClass] = useState<string>('');
  const [selectedTrackerSession, setSelectedTrackerSession] = useState<string>('');
  const [selectedTrackerType, setSelectedTrackerType] = useState<'term' | 'mid-term'>('term');
  const [completionData, setCompletionData] = useState<any>(null);
  const [loadingCompletion, setLoadingCompletion] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    arm: '',
    sessionId: '',
  });

  useEffect(() => {
    fetchData();
  }, []); // Only fetch on mount

  const fetchData = async () => {
    try {
      const [classesRes, sessionsRes] = await Promise.all([
        api.get('/classes'),
        api.get('/academic-sessions'),
      ]);
      setClasses(classesRes.data);
      setSessions(sessionsRes.data);
      if (classesRes.data.length > 0 && sessionsRes.data.length > 0) {
        setSelectedTrackerClass(classesRes.data[0]._id);
        setSelectedTrackerSession(sessionsRes.data[0]._id);
      }
      if (classesRes.data.length > 0 && sessionsRes.data.length > 0) {
        setSelectedTrackerClass(classesRes.data[0]._id);
        setSelectedTrackerSession(sessionsRes.data[0]._id);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

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
    // Handle both string ID and populated object
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

  const fetchCompletion = async (clsId?: string, sessId?: string, perfType?: string) => {
    const cId = clsId || selectedTrackerClass;
    const sId = sessId || selectedTrackerSession;
    const pType = perfType || selectedTrackerType;
    if (!cId || !sId) return;
    try {
      setLoadingCompletion(true);
      const res = await api.get('/results/class/completion', {
        params: {
          classId: cId,
          sessionId: sId,
          performanceType: pType,
        },
      });
      setCompletionData(res.data);
    } catch (err) {
      console.error('Failed to fetch completion tracker:', err);
    } finally {
      setLoadingCompletion(false);
    }
  };

  useEffect(() => {
    if (selectedTrackerClass && selectedTrackerSession) {
      fetchCompletion(selectedTrackerClass, selectedTrackerSession, selectedTrackerType);
    }
  }, [selectedTrackerClass, selectedTrackerSession, selectedTrackerType]);

  const openModal = () => {
    setEditingClass(null);
    setFormData({ name: '', arm: '', sessionId: sessions[0]?._id || '' });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Report Completion Tracker Widget */}
      <div className="bg-white rounded-lg shadow mb-8 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 mb-4 gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Report Completion Tracker</h2>
            <p className="text-xs text-gray-500">Track which students have completed result entries for the term</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTrackerSession}
              onChange={(e) => setSelectedTrackerSession(e.target.value)}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-md"
            >
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>{s.year} - {s.currentTerm}</option>
              ))}
            </select>
            <select
              value={selectedTrackerClass}
              onChange={(e) => setSelectedTrackerClass(e.target.value)}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-md"
            >
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name} - {c.arm}</option>
              ))}
            </select>
            <select
              value={selectedTrackerType}
              onChange={(e) => setSelectedTrackerType(e.target.value as 'term' | 'mid-term')}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-md"
            >
              <option value="term">Full Term</option>
              <option value="mid-term">Mid-Term</option>
            </select>
            <button
              onClick={() => fetchCompletion()}
              disabled={loadingCompletion}
              className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-md hover:bg-indigo-100 font-medium"
            >
              {loadingCompletion ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {completionData && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="text-xs text-gray-500 font-medium">Total Students</span>
                <p className="text-xl font-bold text-gray-900">{completionData.totalStudents}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <span className="text-xs text-green-700 font-medium">Completed</span>
                <p className="text-xl font-bold text-green-700">{completionData.completedCount}</p>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <span className="text-xs text-amber-700 font-medium">Pending / Incomplete</span>
                <p className="text-xl font-bold text-amber-700">{completionData.pendingCount}</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                <span className="text-xs text-indigo-700 font-medium">Completion Rate</span>
                <p className="text-xl font-bold text-indigo-700">{completionData.completionRate}%</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${completionData.completionRate}%` }}
              ></div>
            </div>

            {/* Students completion list */}
            {completionData.students && completionData.students.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Student</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Admission No</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Subjects</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {completionData.students.map((st: any) => (
                      <tr key={st._id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{st.fullName}</td>
                        <td className="px-3 py-2 text-gray-500">{st.admissionNo}</td>
                        <td className="px-3 py-2 text-center text-gray-500">
                          {st.completedSubjects} / {st.registeredSubjects}
                        </td>
                        <td className="px-3 py-2 text-right">
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report Completion Tracker Widget */}
      <div className="bg-white rounded-lg shadow mb-8 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 mb-4 gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Report Completion Tracker</h2>
            <p className="text-xs text-gray-500">Track which students have completed result entries for the term</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTrackerSession}
              onChange={(e) => setSelectedTrackerSession(e.target.value)}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-md"
            >
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>{s.year} - {s.currentTerm}</option>
              ))}
            </select>
            <select
              value={selectedTrackerClass}
              onChange={(e) => setSelectedTrackerClass(e.target.value)}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-md"
            >
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name} - {c.arm}</option>
              ))}
            </select>
            <select
              value={selectedTrackerType}
              onChange={(e) => setSelectedTrackerType(e.target.value as 'term' | 'mid-term')}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-md"
            >
              <option value="term">Full Term</option>
              <option value="mid-term">Mid-Term</option>
            </select>
            <button
              onClick={() => fetchCompletion()}
              disabled={loadingCompletion}
              className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-md hover:bg-indigo-100 font-medium"
            >
              {loadingCompletion ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {completionData && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="text-xs text-gray-500 font-medium">Total Students</span>
                <p className="text-xl font-bold text-gray-900">{completionData.totalStudents}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <span className="text-xs text-green-700 font-medium">Completed</span>
                <p className="text-xl font-bold text-green-700">{completionData.completedCount}</p>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <span className="text-xs text-amber-700 font-medium">Pending / Incomplete</span>
                <p className="text-xl font-bold text-amber-700">{completionData.pendingCount}</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                <span className="text-xs text-indigo-700 font-medium">Completion Rate</span>
                <p className="text-xl font-bold text-indigo-700">{completionData.completionRate}%</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${completionData.completionRate}%` }}
              ></div>
            </div>

            {/* Students completion list */}
            {completionData.students && completionData.students.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Student</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Admission No</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Subjects</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {completionData.students.map((st: any) => (
                      <tr key={st._id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{st.fullName}</td>
                        <td className="px-3 py-2 text-gray-500">{st.admissionNo}</td>
                        <td className="px-3 py-2 text-center text-gray-500">
                          {st.completedSubjects} / {st.registeredSubjects}
                        </td>
                        <td className="px-3 py-2 text-right">
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
        <button
          onClick={openModal}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          Add Class
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No classes found</p>
          <button
            onClick={openModal}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
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
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Arm
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Session
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {classes.map((classGroup) => {
                // Handle both string ID and populated object for sessionId
                const sessionId = typeof classGroup.sessionId === 'object' 
                  ? classGroup.sessionId._id 
                  : classGroup.sessionId;
                const session = sessions.find((s) => s._id === sessionId);
                return (
                  <tr key={classGroup._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {classGroup.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {classGroup.arm}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {session?.year} - {session?.currentTerm}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(classGroup)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
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
                  <option value="">Select a session</option>
                  {sessions.map((session) => (
                    <option key={session._id} value={session._id}>
                      {session.year} - {session.currentTerm}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
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
