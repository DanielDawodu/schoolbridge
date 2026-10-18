import React, { useEffect, useState } from 'react';
import api from '../services/api';

interface AcademicSession {
  _id: string;
  year: string;
  currentTerm: string;
  isActive?: boolean;
  daysOpen?: number;
  finalTerm?: string;
}

interface School {
  _id: string;
  name: string;
  address: string;
  signatureUrl?: string;
  reportCardMode?: 'mid-term-and-term' | 'term-only';
}

type SettingsTab = 'term' | 'report-card-mode' | 'class' | 'subject' | 'section' | 'period' | 'class-subject';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('term');
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null);
  const [formData, setFormData] = useState({
    year: '',
    currentTerm: 'first',
    daysOpen: 0,
    finalTerm: 'third',
  });
  const [carryOverClasses, setCarryOverClasses] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);

  useEffect(() => {
    fetchSessions();
    fetchSchool();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await api.get('/academic-sessions');
      setSessions(response.data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchool = async () => {
    try {
      const response = await api.get('/schools/me');
      setSchool(response.data);
    } catch (error) {
      console.error('Failed to fetch school:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSession) {
        await api.put(`/academic-sessions/${editingSession._id}`, formData);
      } else {
        await api.post('/academic-sessions', { ...formData, carryOverClasses });
      }
      setShowModal(false);
      setEditingSession(null);
      setFormData({ year: '', currentTerm: 'first', daysOpen: 0, finalTerm: 'third' });
      setCarryOverClasses(false);
      fetchSessions();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save session');
    }
  };

  const handleEdit = (session: AcademicSession) => {
    setEditingSession(session);
    setFormData({
      year: session.year,
      currentTerm: session.currentTerm,
      daysOpen: session.daysOpen || 0,
      finalTerm: session.finalTerm || 'third',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      await api.delete(`/academic-sessions/${id}`);
      fetchSessions();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete session');
    }
  };

  const handleSetActive = async (id: string) => {
    if (!confirm('Switching the active term will change what Attendance and Fees show by default across the whole system. Continue?')) {
      return;
    }

    try {
      await api.put('/schools/active-term', { termId: id });
      fetchSessions();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to set active term');
    }
  };

  const openModal = () => {
    setEditingSession(null);
    setFormData({ year: '', currentTerm: 'first', daysOpen: 0, finalTerm: 'third' });
    setCarryOverClasses(false);
    setShowModal(true);
  };

  const handleSignatureUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatureFile) {
      alert('Please select a signature image');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', signatureFile);
      formData.append('type', 'signature');

      const response = await api.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Update school with signature URL
      await api.put('/schools/signature', { signatureUrl: response.data.fileUrl });

      alert('Signature uploaded successfully');
      setShowSignatureModal(false);
      setSignatureFile(null);
      fetchSchool();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to upload signature');
    }
  };

  const handleReportCardModeChange = async (mode: 'mid-term-and-term' | 'term-only') => {
    try {
      await api.put('/schools/me', { reportCardMode: mode });
      fetchSchool();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update report card mode');
    }
  };

  const tabs = [
    { id: 'term' as SettingsTab, label: 'Term', icon: '📅' },
    { id: 'report-card-mode' as SettingsTab, label: 'Report Card Mode', icon: '📄' },
    { id: 'class' as SettingsTab, label: 'Class', icon: '🏫' },
    { id: 'subject' as SettingsTab, label: 'Subject', icon: '📚' },
    { id: 'section' as SettingsTab, label: 'Section', icon: '📑' },
    { id: 'period' as SettingsTab, label: 'Period', icon: '⏱️' },
    { id: 'class-subject' as SettingsTab, label: 'Class Subject', icon: '🔗' },
  ];

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage school configuration</p>
      </div>

      <div className="flex gap-6">
        {/* Left Sub-navigation */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === tab.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-3">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1">
          {activeTab === 'term' && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Academic Sessions & Terms</h2>
                <button
                  onClick={openModal}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                >
                  Add Session
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-gray-500 mb-4">No academic sessions found</p>
                  <button
                    onClick={openModal}
                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Create your first academic session
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Term</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Final Term</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Open</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sessions.map((session) => (
                        <tr key={session._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {session.year}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                            {session.currentTerm}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                            {session.finalTerm || 'third'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {session.daysOpen || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {session.isActive ? (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                Active
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSetActive(session._id)}
                                className="text-indigo-600 hover:text-indigo-900 text-xs font-medium"
                              >
                                Set Active
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleEdit(session)}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(session._id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'report-card-mode' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Card Mode</h2>
              <p className="text-sm text-gray-600 mb-6">
                Choose whether your school generates both mid-term and full term reports, or only full term reports.
              </p>
              <div className="space-y-4">
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="reportCardMode"
                    value="mid-term-and-term"
                    checked={school?.reportCardMode === 'mid-term-and-term' || !school?.reportCardMode}
                    onChange={() => handleReportCardModeChange('mid-term-and-term')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900">Mid-Term + Term</span>
                    <span className="block text-xs text-gray-500">Generate both half-term assessments and full term report cards</span>
                  </div>
                </label>
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="reportCardMode"
                    value="term-only"
                    checked={school?.reportCardMode === 'term-only'}
                    onChange={() => handleReportCardModeChange('term-only')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900">Term Only</span>
                    <span className="block text-xs text-gray-500">Generate only full term report cards</span>
                  </div>
                </label>
              </div>

              <div className="mt-8 pt-6 border-t">
                <h3 className="text-md font-semibold text-gray-900 mb-4">Principal's Signature</h3>
                <div className="flex items-center justify-between">
                  <div>
                    {school?.signatureUrl ? (
                      <img
                        src={school.signatureUrl}
                        alt="Principal's Signature"
                        className="h-16 border border-gray-300 rounded"
                      />
                    ) : (
                      <p className="text-gray-500 text-sm">No signature uploaded</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowSignatureModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                  >
                    {school?.signatureUrl ? 'Update Signature' : 'Upload Signature'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'class' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Class Management</h2>
              <p className="text-sm text-gray-600 mb-4">
                Manage classes and class groups. Go to the <a href="/classes" className="text-indigo-600 hover:underline">Classes page</a> for full management.
              </p>
              <a href="/classes" className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                Go to Classes
              </a>
            </div>
          )}

          {activeTab === 'subject' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Subject Management</h2>
              <p className="text-sm text-gray-600 mb-4">
                Manage subjects and their grading weights. Go to the <a href="/subjects" className="text-indigo-600 hover:underline">Subjects page</a> for full management.
              </p>
              <a href="/subjects" className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                Go to Subjects
              </a>
            </div>
          )}

          {activeTab === 'class-subject' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Class Subject Registration</h2>
              <p className="text-sm text-gray-600 mb-4">
                Register subjects for classes and assign teachers. Go to the <a href="/subject-registration" className="text-indigo-600 hover:underline">Subject Registration page</a> for full management.
              </p>
              <a href="/subject-registration" className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                Go to Subject Registration
              </a>
            </div>
          )}

          {activeTab === 'section' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Section Management</h2>
              <p className="text-sm text-gray-600">
                Section configuration coming soon. This will allow you to manage class sections and streams.
              </p>
            </div>
          )}

          {activeTab === 'period' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Period Management</h2>
              <p className="text-sm text-gray-600">
                Period configuration coming soon. This will allow you to manage school periods and timetables.
              </p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingSession ? 'Edit Session' : 'Add New Session'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Academic Year
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., 2026/2027"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Term
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.currentTerm}
                  onChange={(e) => setFormData({ ...formData, currentTerm: e.target.value })}
                >
                  <option value="first">First Term</option>
                  <option value="second">Second Term</option>
                  <option value="third">Third Term</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Final Term (for term comparison)
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.finalTerm}
                  onChange={(e) => setFormData({ ...formData, finalTerm: e.target.value })}
                >
                  <option value="first">First Term</option>
                  <option value="second">Second Term</option>
                  <option value="third">Third Term</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">The final term will show term-over-term comparison on report cards</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Days School Open (for attendance summary)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., 60"
                  value={formData.daysOpen}
                  onChange={(e) => setFormData({ ...formData, daysOpen: parseInt(e.target.value) || 0 })}
                />
              </div>
              {!editingSession && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="carryOverClasses"
                    checked={carryOverClasses}
                    onChange={(e) => setCarryOverClasses(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="carryOverClasses" className="ml-2 block text-sm text-gray-700">
                    Carry over class structure from previous term
                  </label>
                </div>
              )}
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
                  {editingSession ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSignatureModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Upload Principal's Signature</h3>
            </div>
            <form onSubmit={handleSignatureUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Signature Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-gray-500 mt-1">Recommended: PNG or JPG, max 500KB</p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSignatureModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
