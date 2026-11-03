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
  activePeriodId?: string;
}

interface ClassLevel {
  _id: string;
  name: string;
  order: number;
}

interface SessionMaster {
  _id: string;
  year: string;
  isActive?: boolean;
}

interface TermMaster {
  _id: string;
  name: string;
  order: number;
  code?: string;
}

interface PeriodItem {
  _id: string;
  sessionId: { _id: string; year: string } | string;
  termId: { _id: string; name: string } | string;
  daysOpen: number;
  closeDate?: string;
  nextTermBeginDate?: string;
  isActive: boolean;
}

type SettingsTab = 'class' | 'subject' | 'section' | 'period' | 'term' | 'class-subject' | 'report-card-mode';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('class');
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<School | null>(null);

  // Class Levels
  const [classLevels, setClassLevels] = useState<ClassLevel[]>([]);
  const [newClassLevelName, setNewClassLevelName] = useState('');
  const [newClassLevelOrder, setNewClassLevelOrder] = useState(1);

  // Sessions (Sections)
  const [sessionsMaster, setSessionsMaster] = useState<SessionMaster[]>([]);
  const [newSessionYear, setNewSessionYear] = useState('');

  // Terms Master
  const [termsMaster, setTermsMaster] = useState<TermMaster[]>([]);
  const [newTermName, setNewTermName] = useState('');
  const [newTermOrder, setNewTermOrder] = useState(1);

  // Periods
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [periodForm, setPeriodForm] = useState({
    sessionId: '',
    termId: '',
    daysOpen: 90,
    closeDate: '',
    nextTermBeginDate: '',
  });

  // Legacy Academic Sessions
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null);
  const [sessionFormData, setSessionFormData] = useState({
    year: '',
    currentTerm: 'first',
    daysOpen: 0,
    finalTerm: 'third',
  });
  const [carryOverClasses, setCarryOverClasses] = useState(false);

  // Signature
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [schoolRes, sessionsRes, classLevelsRes, sessionsMasterRes, termsMasterRes, periodsRes] =
        await Promise.all([
          api.get('/schools/me'),
          api.get('/academic-sessions').catch(() => ({ data: [] })),
          api.get('/class-levels').catch(() => ({ data: [] })),
          api.get('/sessions').catch(() => ({ data: [] })),
          api.get('/terms').catch(() => ({ data: [] })),
          api.get('/periods').catch(() => ({ data: [] })),
        ]);
      setSchool(schoolRes.data);
      setSessions(sessionsRes.data || []);
      setClassLevels(classLevelsRes.data || []);
      setSessionsMaster(sessionsMasterRes.data || []);
      setTermsMaster(termsMasterRes.data || []);
      setPeriods(periodsRes.data || []);
    } catch (error) {
      console.error('Failed to load settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ClassLevel Handlers
  const handleCreateClassLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassLevelName.trim()) return;
    try {
      await api.post('/class-levels', {
        name: newClassLevelName.trim(),
        order: Number(newClassLevelOrder) || 1,
      });
      setNewClassLevelName('');
      setNewClassLevelOrder(classLevels.length + 2);
      const res = await api.get('/class-levels');
      setClassLevels(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create class level');
    }
  };

  const handleDeleteClassLevel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this class level?')) return;
    try {
      await api.delete(`/class-levels/${id}`);
      setClassLevels(prev => prev.filter(c => c._id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete class level');
    }
  };

  // Session (Section) Handlers
  const handleCreateSessionMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionYear.trim()) return;
    try {
      await api.post('/sessions', { year: newSessionYear.trim() });
      setNewSessionYear('');
      const res = await api.get('/sessions');
      setSessionsMaster(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create session');
    }
  };

  const handleDeleteSessionMaster = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      await api.delete(`/sessions/${id}`);
      setSessionsMaster(prev => prev.filter(s => s._id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete session');
    }
  };

  // Term Handlers
  const handleCreateTermMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTermName.trim()) return;
    try {
      await api.post('/terms', {
        name: newTermName.trim(),
        order: Number(newTermOrder) || 1,
      });
      setNewTermName('');
      setNewTermOrder(termsMaster.length + 2);
      const res = await api.get('/terms');
      setTermsMaster(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create term');
    }
  };

  const handleDeleteTermMaster = async (id: string) => {
    if (!confirm('Are you sure you want to delete this term?')) return;
    try {
      await api.delete(`/terms/${id}`);
      setTermsMaster(prev => prev.filter(t => t._id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete term');
    }
  };

  // Period Handlers
  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodForm.sessionId || !periodForm.termId) {
      alert('Please select both a Session and a Term');
      return;
    }
    try {
      await api.post('/periods', periodForm);
      setPeriodForm({
        sessionId: '',
        termId: '',
        daysOpen: 90,
        closeDate: '',
        nextTermBeginDate: '',
      });
      const res = await api.get('/periods');
      setPeriods(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create period');
    }
  };

  const handleSetActivePeriod = async (id: string) => {
    if (!confirm('Make this Period active? This will switch active term across the school system.')) {
      return;
    }
    try {
      await api.put(`/periods/${id}/set-active`, { periodId: id });
      const res = await api.get('/periods');
      setPeriods(res.data);
      alert('Active period updated successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to set active period');
    }
  };

  const handleDeletePeriod = async (id: string) => {
    if (!confirm('Are you sure you want to delete this period?')) return;
    try {
      await api.delete(`/periods/${id}`);
      setPeriods(prev => prev.filter(p => p._id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete period');
    }
  };

  // Legacy AcademicSession handlers
  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSession) {
        await api.put(`/academic-sessions/${editingSession._id}`, sessionFormData);
      } else {
        await api.post('/academic-sessions', { ...sessionFormData, carryOverClasses });
      }
      setShowSessionModal(false);
      setEditingSession(null);
      setSessionFormData({ year: '', currentTerm: 'first', daysOpen: 0, finalTerm: 'third' });
      setCarryOverClasses(false);
      const res = await api.get('/academic-sessions');
      setSessions(res.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save session');
    }
  };

  const handleSetActiveLegacy = async (id: string) => {
    if (!confirm('Switching active session will change active term across the whole system. Continue?')) {
      return;
    }
    try {
      await api.put('/schools/active-term', { termId: id });
      const res = await api.get('/academic-sessions');
      setSessions(res.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to set active term');
    }
  };

  // Report Card Mode Handler
  const handleReportCardModeChange = async (mode: 'mid-term-and-term' | 'term-only') => {
    try {
      await api.put('/schools/me', { reportCardMode: mode });
      setSchool(prev => prev ? { ...prev, reportCardMode: mode } : null);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update report card mode');
    }
  };

  // Signature Upload
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
      await api.put('/schools/signature', { signatureUrl: response.data.fileUrl });
      alert('Signature uploaded successfully');
      setShowSignatureModal(false);
      setSignatureFile(null);
      const schoolRes = await api.get('/schools/me');
      setSchool(schoolRes.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to upload signature');
    }
  };

  const tabs = [
    { id: 'class' as SettingsTab, label: 'Class', icon: '🏫' },
    { id: 'subject' as SettingsTab, label: 'Subject', icon: '📚' },
    { id: 'section' as SettingsTab, label: 'Section', icon: '📑' },
    { id: 'period' as SettingsTab, label: 'Period', icon: '⏱️' },
    { id: 'term' as SettingsTab, label: 'Term', icon: '📅' },
    { id: 'class-subject' as SettingsTab, label: 'Class Subject', icon: '🔗' },
    { id: 'report-card-mode' as SettingsTab, label: 'Report Card Mode', icon: '📄' },
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
        <p className="text-gray-600">Configure academic structure, classes, periods, and report cards</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Sub-navigation */}
        <div className="w-full md:w-60 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-3">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm'
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
          {/* TAB 1: CLASS (ClassLevel Master List) */}
          {activeTab === 'class' && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4 pb-3 border-b">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Class Master List</h2>
                  <p className="text-xs text-gray-500">
                    Master class levels across the school (e.g. Nursery, Basic 1-5, JSS 1-3, SSS 1-3)
                  </p>
                </div>
              </div>

              {/* Add Class Level Form */}
              <form onSubmit={handleCreateClassLevel} className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    required
                    placeholder="Class Level Name (e.g. JSS 1)"
                    value={newClassLevelName}
                    onChange={(e) => setNewClassLevelName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    min="1"
                    placeholder="Order"
                    value={newClassLevelOrder}
                    onChange={(e) => setNewClassLevelOrder(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 font-medium"
                >
                  Add Class Level
                </button>
              </form>

              {classLevels.length === 0 ? (
                <p className="text-gray-500 text-sm p-4 text-center">No class levels defined yet.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Order</th>
                      <th className="px-4 py-3 text-left">Class Level</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    {classLevels.map((cl) => (
                      <tr key={cl._id}>
                        <td className="px-4 py-3 font-mono text-gray-500">{cl.order}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{cl.name}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteClassLevel(cl._id)}
                            className="text-red-600 hover:text-red-900 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 2: SUBJECT */}
          {activeTab === 'subject' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Subject Management</h2>
              <p className="text-sm text-gray-600 mb-6">
                Configure curriculum subjects and assessment weights (CA1, CA2, Exam).
              </p>
              <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-indigo-900">Manage Subjects & Weights</h3>
                  <p className="text-xs text-indigo-700 mt-1">
                    Add new subjects, edit score weights, or manage course codes.
                  </p>
                </div>
                <a
                  href="/subjects"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 font-medium shadow-sm"
                >
                  Go to Subjects
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: SECTION (Academic Session Master List) */}
          {activeTab === 'section' && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4 pb-3 border-b">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Section (Academic Sessions)</h2>
                  <p className="text-xs text-gray-500">
                    Master list of academic years (e.g. 2026/2027) reused each year.
                  </p>
                </div>
              </div>

              {/* Add Session Master */}
              <form onSubmit={handleCreateSessionMaster} className="flex gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  required
                  placeholder="Academic Year (e.g. 2026/2027)"
                  value={newSessionYear}
                  onChange={(e) => setNewSessionYear(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 font-medium"
                >
                  Add Section
                </button>
              </form>

              {sessionsMaster.length === 0 ? (
                <p className="text-gray-500 text-sm p-4 text-center">No academic sessions added yet.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Academic Year</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    {sessionsMaster.map((sm) => (
                      <tr key={sm._id}>
                        <td className="px-4 py-3 font-semibold text-gray-900">{sm.year}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteSessionMaster(sm._id)}
                            className="text-red-600 hover:text-red-900 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 4: PERIOD (Session + Term with Days Open & Make Active) */}
          {activeTab === 'period' && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4 pb-3 border-b">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Period Management</h2>
                  <p className="text-xs text-gray-500">
                    Combine Session + Term into active periods with days open, close dates, and system status.
                  </p>
                </div>
              </div>

              {/* Add Period Form */}
              <form onSubmit={handleCreatePeriod} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Session</label>
                  <select
                    required
                    value={periodForm.sessionId}
                    onChange={(e) => setPeriodForm({ ...periodForm, sessionId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select Session</option>
                    {sessionsMaster.map((s) => (
                      <option key={s._id} value={s._id}>{s.year}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Term</label>
                  <select
                    required
                    value={periodForm.termId}
                    onChange={(e) => setPeriodForm({ ...periodForm, termId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select Term</option>
                    {termsMaster.map((t) => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Days Open</label>
                  <input
                    type="number"
                    min="1"
                    value={periodForm.daysOpen}
                    onChange={(e) => setPeriodForm({ ...periodForm, daysOpen: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Term Close Date</label>
                  <input
                    type="date"
                    value={periodForm.closeDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, closeDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Next Term Begins</label>
                  <input
                    type="date"
                    value={periodForm.nextTermBeginDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, nextTermBeginDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 font-medium"
                  >
                    Create Period
                  </button>
                </div>
              </form>

              {periods.length === 0 ? (
                <p className="text-gray-500 text-sm p-4 text-center">No periods configured yet.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Session</th>
                      <th className="px-4 py-3 text-left">Term</th>
                      <th className="px-4 py-3 text-center">Days Open</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    {periods.map((p) => {
                      const sessionYear = typeof p.sessionId === 'object' ? p.sessionId?.year : 'Unknown';
                      const termName = typeof p.termId === 'object' ? p.termId?.name : 'Unknown';
                      return (
                        <tr key={p._id}>
                          <td className="px-4 py-3 font-semibold text-gray-900">{sessionYear}</td>
                          <td className="px-4 py-3 text-gray-700">{termName}</td>
                          <td className="px-4 py-3 text-center font-mono">{p.daysOpen}</td>
                          <td className="px-4 py-3 text-center">
                            {p.isActive ? (
                              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-800">
                                Active
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSetActivePeriod(p._id)}
                                className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-100 font-medium"
                              >
                                Make Active
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeletePeriod(p._id)}
                              className="text-red-600 hover:text-red-900 text-xs"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 5: TERM */}
          {activeTab === 'term' && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4 pb-3 border-b">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Term Master List</h2>
                  <p className="text-xs text-gray-500">
                    Master list of term names (e.g. 1st Term, 2nd Term, 3rd Term) reused across sessions
                  </p>
                </div>
              </div>

              {/* Add Term Form */}
              <form onSubmit={handleCreateTermMaster} className="flex gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  required
                  placeholder="Term Name (e.g. 1st Term)"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Order"
                  value={newTermOrder}
                  onChange={(e) => setNewTermOrder(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 font-medium"
                >
                  Add Term
                </button>
              </form>

              {termsMaster.length === 0 ? (
                <p className="text-gray-500 text-sm p-4 text-center">No terms defined yet.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 mb-8">
                  <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Order</th>
                      <th className="px-4 py-3 text-left">Term Name</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    {termsMaster.map((tm) => (
                      <tr key={tm._id}>
                        <td className="px-4 py-3 font-mono text-gray-500">{tm.order}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{tm.name}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteTermMaster(tm._id)}
                            className="text-red-600 hover:text-red-900 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Legacy Academic Sessions table */}
              <div className="pt-6 border-t">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-md font-bold text-gray-800">Academic Sessions (Active / Legacy)</h3>
                  <button
                    onClick={() => {
                      setEditingSession(null);
                      setSessionFormData({ year: '', currentTerm: 'first', daysOpen: 0, finalTerm: 'third' });
                      setShowSessionModal(true);
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-md font-medium"
                  >
                    + New Academic Session
                  </button>
                </div>
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Year</th>
                      <th className="px-4 py-2 text-left">Current Term</th>
                      <th className="px-4 py-2 text-left">Final Term</th>
                      <th className="px-4 py-2 text-center">Days Open</th>
                      <th className="px-4 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sessions.map((s) => (
                      <tr key={s._id}>
                        <td className="px-4 py-2 font-medium">{s.year}</td>
                        <td className="px-4 py-2 capitalize">{s.currentTerm}</td>
                        <td className="px-4 py-2 capitalize">{s.finalTerm || 'third'}</td>
                        <td className="px-4 py-2 text-center">{s.daysOpen || 0}</td>
                        <td className="px-4 py-2 text-center">
                          {s.isActive ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                              Active
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSetActiveLegacy(s._id)}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              Set Active
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: CLASS SUBJECT */}
          {activeTab === 'class-subject' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Class Subject Registration</h2>
              <p className="text-sm text-gray-600 mb-6">
                Register subjects for class groups and assign subject teachers.
              </p>
              <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-indigo-900">Manage Class Subjects & Teacher Allocations</h3>
                  <p className="text-xs text-indigo-700 mt-1">
                    Assign which subjects are taught in each class and who teaches them.
                  </p>
                </div>
                <a
                  href="/subject-registration"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 font-medium shadow-sm"
                >
                  Go to Subject Registration
                </a>
              </div>
            </div>
          )}

          {/* TAB 7: REPORT CARD MODE */}
          {activeTab === 'report-card-mode' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Report Card Mode</h2>
              <p className="text-sm text-gray-600 mb-6">
                Choose whether your school generates both mid-term and full term reports, or only full term reports.
              </p>
              <div className="space-y-4 max-w-lg mb-8">
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="reportCardMode"
                    value="mid-term-and-term"
                    checked={school?.reportCardMode === 'mid-term-and-term' || !school?.reportCardMode}
                    onChange={() => handleReportCardModeChange('mid-term-and-term')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-semibold text-gray-900">Mid-Term + Term</span>
                    <span className="block text-xs text-gray-500">Generate both half-term assessments and full term report cards</span>
                  </div>
                </label>
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="reportCardMode"
                    value="term-only"
                    checked={school?.reportCardMode === 'term-only'}
                    onChange={() => handleReportCardModeChange('term-only')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-semibold text-gray-900">Term Only</span>
                    <span className="block text-xs text-gray-500">Generate only full term report cards</span>
                  </div>
                </label>
              </div>

              {/* Principal Signature Upload */}
              <div className="pt-6 border-t max-w-lg">
                <h3 className="text-md font-semibold text-gray-900 mb-3">Principal's Signature</h3>
                <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div>
                    {school?.signatureUrl ? (
                      <img
                        src={school.signatureUrl}
                        alt="Principal's Signature"
                        className="h-14 border border-gray-300 rounded bg-white p-1"
                      />
                    ) : (
                      <p className="text-gray-500 text-xs">No signature uploaded yet</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowSignatureModal(true)}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-xs hover:bg-indigo-700 font-medium"
                  >
                    {school?.signatureUrl ? 'Update Signature' : 'Upload Signature'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Principal Signature</h3>
            <form onSubmit={handleSignatureUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Image (PNG, JPG)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  required
                  onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSignatureModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Legacy Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingSession ? 'Edit Academic Session' : 'Add Academic Session'}
            </h3>
            <form onSubmit={handleSaveSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026/2027"
                  value={sessionFormData.year}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, year: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Term</label>
                <select
                  value={sessionFormData.currentTerm}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, currentTerm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="first">First Term</option>
                  <option value="second">Second Term</option>
                  <option value="third">Third Term</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Final Term</label>
                <select
                  value={sessionFormData.finalTerm}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, finalTerm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="first">First Term</option>
                  <option value="second">Second Term</option>
                  <option value="third">Third Term</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days School Opened</label>
                <input
                  type="number"
                  min="0"
                  value={sessionFormData.daysOpen}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, daysOpen: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
                >
                  Save
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
