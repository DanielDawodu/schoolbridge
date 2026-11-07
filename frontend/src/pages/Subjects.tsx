import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { BookOpen, Layers, Plus, Filter, CheckSquare, Square } from 'lucide-react';

interface ClassItem {
  _id: string;
  name?: string;
  arm: string;
  faction?: string;
  classLevelId?: { _id: string; name: string };
}

interface Subject {
  _id: string;
  name: string;
  code: string;
  category: 'core' | 'elective';
  stream?: string | null;
  applicableClassIds?: (string | ClassItem)[];
  isCompulsory: boolean;
  ca1Weight: number;
  ca2Weight: number;
  examWeight: number;
}

const Subjects: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Filter
  const [streamFilter, setStreamFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'core' as 'core' | 'elective',
    stream: '',
    applicableClassIds: [] as string[],
    isAllClasses: true,
    isCompulsory: true,
    ca1Weight: 20,
    ca2Weight: 20,
    examWeight: 60,
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [subjectsRes, classesRes] = await Promise.all([
        api.get('/subjects'),
        api.get('/classes'),
      ]);
      setSubjects(subjectsRes.data);
      setClasses(classesRes.data);
    } catch (error) {
      console.error('Failed to fetch subjects or classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await api.get('/subjects');
      setSubjects(response.data);
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        category: formData.category,
        stream: formData.stream || null,
        applicableClassIds: formData.isAllClasses ? [] : formData.applicableClassIds,
        isCompulsory: formData.isCompulsory,
        ca1Weight: formData.ca1Weight,
        ca2Weight: formData.ca2Weight,
        examWeight: formData.examWeight,
      };

      if (editingSubject) {
        await api.put(`/subjects/${editingSubject._id}`, payload);
      } else {
        await api.post('/subjects', payload);
      }
      setShowModal(false);
      setEditingSubject(null);
      setFormData({
        name: '',
        code: '',
        category: 'core',
        stream: '',
        applicableClassIds: [],
        isAllClasses: true,
        isCompulsory: true,
        ca1Weight: 20,
        ca2Weight: 20,
        examWeight: 60,
      });
      fetchSubjects();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save subject');
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    const rawClassIds = (subject.applicableClassIds || []).map((c: any) =>
      typeof c === 'object' && c._id ? c._id : String(c)
    );
    const isAll = rawClassIds.length === 0;

    setFormData({
      name: subject.name,
      code: subject.code,
      category: subject.category,
      stream: subject.stream || '',
      applicableClassIds: rawClassIds,
      isAllClasses: isAll,
      isCompulsory: subject.isCompulsory,
      ca1Weight: subject.ca1Weight,
      ca2Weight: subject.ca2Weight,
      examWeight: subject.examWeight,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    try {
      await api.delete(`/subjects/${id}`);
      fetchSubjects();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete subject');
    }
  };

  const openModal = () => {
    setEditingSubject(null);
    setFormData({
      name: '',
      code: '',
      category: 'core',
      stream: '',
      applicableClassIds: [],
      isAllClasses: true,
      isCompulsory: true,
      ca1Weight: 20,
      ca2Weight: 20,
      examWeight: 60,
    });
    setShowModal(true);
  };

  const toggleClassSelection = (classId: string) => {
    setFormData((prev) => {
      const exists = prev.applicableClassIds.includes(classId);
      const updated = exists
        ? prev.applicableClassIds.filter((id) => id !== classId)
        : [...prev.applicableClassIds, classId];
      return {
        ...prev,
        applicableClassIds: updated,
        isAllClasses: updated.length === 0,
      };
    });
  };

  const filteredSubjects = subjects.filter((s) => {
    if (streamFilter === 'all') return true;
    if (streamFilter === 'General') return !s.stream;
    return s.stream === streamFilter;
  });

  const getClassName = (cls: any) => {
    if (!cls) return 'Class';
    if (typeof cls === 'object') {
      const level = cls.classLevelId?.name || cls.name || 'Class';
      const arm = cls.arm ? ` ${cls.arm}` : '';
      return `${level}${arm}`;
    }
    const found = classes.find((c) => c._id === String(cls));
    if (found) {
      const level = found.classLevelId?.name || found.name || 'Class';
      const arm = found.arm ? ` ${found.arm}` : '';
      return `${level}${arm}`;
    }
    return 'Class';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-indigo-600" />
            Curriculum Subjects
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage curriculum subjects, class assignments, and Senior Secondary factions (Science, Arts, Commercial).
          </p>
        </div>

        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Subject</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Filter By Stream:</span>
          <div className="flex items-center gap-2">
            {['all', 'General', 'Science', 'Arts', 'Commercial'].map((opt) => (
              <button
                key={opt}
                onClick={() => setStreamFilter(opt)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  streamFilter === opt
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt === 'all' ? 'All Subjects' : opt}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Showing {filteredSubjects.length} of {subjects.length} subjects
        </div>
      </div>

      {/* Subjects Table */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        {filteredSubjects.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4 text-sm">No subjects found matching your filter</p>
            <button
              onClick={openModal}
              className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
            >
              Create a new subject
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Code</th>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Stream / Faction</th>
                  <th className="px-6 py-3 text-left">Applicable Classes</th>
                  <th className="px-6 py-3 text-left">Category</th>
                  <th className="px-6 py-3 text-left">Weights</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredSubjects.map((subject) => {
                  const classList = subject.applicableClassIds || [];
                  const isAll = classList.length === 0;

                  return (
                    <tr key={subject._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5 whitespace-nowrap font-bold text-gray-900">
                        {subject.code}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap font-medium text-gray-800">
                        {subject.name}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        {subject.stream ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <Layers className="w-3 h-3 mr-1" />
                            {subject.stream}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">General / All</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        {isAll ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            All Classes
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {classList.map((c: any, idx) => (
                              <span
                                key={idx}
                                className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200"
                              >
                                {getClassName(c)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span className="capitalize text-gray-600">{subject.category}</span>
                        {subject.isCompulsory && (
                          <span className="ml-2 text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-semibold uppercase">
                            Compulsory
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-xs text-gray-500">
                        CA1: {subject.ca1Weight}%, CA2: {subject.ca2Weight}%, Exam: {subject.examWeight}%
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <button
                          onClick={() => handleEdit(subject)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(subject._id)}
                          className="text-red-600 hover:text-red-900 font-medium"
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

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-gray-900">
                {editingSubject ? 'Edit Subject' : 'Add New Subject'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Subject Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Chemistry"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Subject Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., CHE"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              {/* Stream / Faction */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Academic Faction / Stream (SSS)
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.stream}
                  onChange={(e) => setFormData({ ...formData, stream: e.target.value })}
                >
                  <option value="">None / All Streams (General subjects like English, Math)</option>
                  <option value="Science">Science (Physics, Chemistry, Biology, Further Math)</option>
                  <option value="Arts">Arts / Humanities (Literature, Government, CRS/IRS, History)</option>
                  <option value="Commercial">Commercial / Business Studies (Accounting, Commerce, Economics)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Subjects with a designated faction will only be registered for students in classes or streams of that faction.
                </p>
              </div>

              {/* Class Selection: One, Multiple, or All */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700">
                  Applicable Classes
                </label>

                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        isAllClasses: true,
                        applicableClassIds: [],
                      })
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      formData.isAllClasses
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {formData.isAllClasses ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    <span>Available to All Classes</span>
                  </button>
                </div>

                {!formData.isAllClasses && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-40 overflow-y-auto space-y-1.5">
                    {classes.map((cls) => {
                      const isSelected = formData.applicableClassIds.includes(cls._id);
                      return (
                        <label
                          key={cls._id}
                          className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleClassSelection(cls._id)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span>{getClassName(cls)} {cls.faction ? `(${cls.faction})` : ''}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {formData.isAllClasses ? (
                  <p className="text-[11px] text-gray-500">
                    This subject can be taken by any student across all classes in the school.
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    Selected: {formData.applicableClassIds.length} class(es).
                  </p>
                )}
              </div>

              {/* Category & Compulsory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Subject Category
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  >
                    <option value="core">Core</option>
                    <option value="elective">Elective</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.isCompulsory}
                      onChange={(e) => setFormData({ ...formData, isCompulsory: e.target.checked })}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>Compulsory Subject</span>
                  </label>
                </div>
              </div>

              {/* Assessment Weights */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">CA1 Max (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.ca1Weight}
                    onChange={(e) => setFormData({ ...formData, ca1Weight: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">CA2 Max (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.ca2Weight}
                    onChange={(e) => setFormData({ ...formData, ca2Weight: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Exam Max (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.examWeight}
                    onChange={(e) => setFormData({ ...formData, examWeight: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs"
                >
                  {editingSubject ? 'Update Subject' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subjects;
