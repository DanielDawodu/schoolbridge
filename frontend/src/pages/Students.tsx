import React, { useEffect, useState } from 'react';
import api from '../services/api';
import DocumentHeader from '../components/DocumentHeader';
import { printElement } from '../utils/printHelper';
import {
  Download,
  Search,
  Upload,
  Trash2,
  User as UserIcon,
  Layers,
  Plus,
  Printer,
} from 'lucide-react';

interface Student {
  _id: string;
  fullName: string;
  admissionNo: string;
  classId: any;
  gender: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  status: string;
  statusReason?: string;
  photoUrl?: string;
  stream?: string;
  classGroup?: {
    _id: string;
    name: string;
    arm: string;
    faction?: string;
  };
}

interface ClassGroup {
  _id: string;
  name?: string;
  classLevelId?: { _id: string; name: string } | string;
  arm: string;
  faction?: 'Science' | 'Arts' | 'Commercial' | null;
}

const Students: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [studentAttendance, setStudentAttendance] = useState<any>(null);
  const [studentFees, setStudentFees] = useState<any>(null);
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'withdrawn' | 'graduated'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusModalStudent, setStatusModalStudent] = useState<Student | null>(null);
  const [statusFormData, setStatusFormData] = useState<{ status: string; statusReason: string }>({
    status: 'active',
    statusReason: '',
  });

  const [formData, setFormData] = useState({
    fullName: '',
    admissionNo: '',
    classId: '',
    gender: '',
    dateOfBirth: '',
    guardianName: '',
    guardianPhone: '',
    address: '',
    status: 'active',
    photoUrl: '',
    stream: '',
  });

  useEffect(() => {
    fetchData();
  }, [filterClass]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [studentsRes, classesRes] = await Promise.all([
        api.get(`/students${filterClass ? `?classId=${filterClass}` : ''}`),
        api.get('/classes'),
      ]);
      setStudents(studentsRes.data);
      setClasses(classesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = (selectedClassId: string) => {
    const selectedClass = classes.find((c) => c._id === selectedClassId);
    let autoStream = formData.stream;
    if (selectedClass?.faction) {
      autoStream = selectedClass.faction;
    }
    setFormData({
      ...formData,
      classId: selectedClassId,
      stream: autoStream,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStudent) {
        await api.put(`/students/${editingStudent._id}`, formData);
      } else {
        await api.post('/students', formData);
      }
      setShowModal(false);
      setEditingStudent(null);
      setFormData({
        fullName: '',
        admissionNo: '',
        classId: '',
        gender: '',
        dateOfBirth: '',
        guardianName: '',
        guardianPhone: '',
        address: '',
        status: 'active',
        photoUrl: '',
        stream: '',
      });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save student');
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    const cId = typeof student.classId === 'object' && student.classId ? student.classId._id : student.classId;
    setFormData({
      fullName: student.fullName,
      admissionNo: student.admissionNo,
      classId: cId || '',
      gender: student.gender,
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      address: student.address,
      status: student.status,
      photoUrl: student.photoUrl || '',
      stream: student.stream || '',
    });
    setShowModal(true);
  };

  const openStatusModal = (student: Student) => {
    setStatusModalStudent(student);
    setStatusFormData({
      status: student.status || 'active',
      statusReason: student.statusReason || '',
    });
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalStudent) return;
    try {
      await api.put(`/students/${statusModalStudent._id}/status`, statusFormData);
      setStatusModalStudent(null);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update student status');
    }
  };

  const handleView = async (student: Student) => {
    setViewingStudent(student);
    setShowViewModal(true);
    setStudentResults([]);

    try {
      const [attendanceRes, feesRes, resultsRes] = await Promise.all([
        api.get(`/attendance/student/${student._id}`),
        api.get(`/fees/student/${student._id}`),
        api.get(`/results/student/${student._id}/all`),
      ]);
      setStudentAttendance(attendanceRes.data);
      setStudentFees(feesRes.data);
      setStudentResults(resultsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch student details:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student record?')) return;
    try {
      await api.delete(`/students/${id}`);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete student');
    }
  };

  const openModal = () => {
    setEditingStudent(null);
    const defaultClassId = classes[0]?._id || '';
    const defaultClass = classes.find((c) => c._id === defaultClassId);
    setFormData({
      fullName: '',
      admissionNo: '',
      classId: defaultClassId,
      gender: '',
      dateOfBirth: '',
      guardianName: '',
      guardianPhone: '',
      address: '',
      status: 'active',
      photoUrl: '',
      stream: defaultClass?.faction || '',
    });
    setShowModal(true);
  };

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/students/export/csv', {
        params: {
          classId: filterClass || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'students-export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export students CSV');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, JPEG).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size exceeds 2MB limit. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const MAX_DIMENSION = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIMENSION) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setFormData((prev) => ({ ...prev, photoUrl: compressedDataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const filteredStudents = students
    .filter((s) => statusFilter === 'all' || (s.status || 'active') === statusFilter)
    .filter((s) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = s.fullName.toLowerCase().includes(q);
      const admMatch = s.admissionNo.toLowerCase().includes(q);
      const phoneMatch = s.guardianPhone ? s.guardianPhone.toLowerCase().includes(q) : false;
      return nameMatch || admMatch || phoneMatch;
    });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Students Directory</h1>
          <p className="text-sm text-gray-500">
            Enroll students, assign specialisation streams, manage profiles and photographs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors shadow-2xs"
            title="Export students list to CSV"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => printElement('printable-students-register', 'Official Student Register')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg text-sm font-medium transition-colors shadow-2xs cursor-pointer"
            title="Print Official Student Register"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span>Print Register</span>
          </button>

          <button
            onClick={openModal}
            className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Global Search Bar */}
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student or admission no..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Class Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 w-full md:w-auto"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="">All Classes</option>
            {classes.map((cls) => {
              const levelName = typeof cls.classLevelId === 'object' ? (cls.classLevelId as any)?.name : (cls.name || 'Class');
              return (
                <option key={cls._id} value={cls._id}>
                  {levelName} - {cls.arm} {cls.faction ? `(${cls.faction})` : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {(['all', 'active', 'inactive', 'withdrawn', 'graduated'] as const).map((tab) => {
          const count = tab === 'all'
            ? students.length
            : students.filter((s) => (s.status || 'active') === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                statusFilter === tab
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab} ({count})
            </button>
          );
        })}
      </div>

      {/* Students Table */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-12 text-center">
          <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4 text-sm">No students found matching your criteria</p>
          <button
            onClick={openModal}
            className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm"
          >
            Register a student
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left w-14">Photo</th>
                  <th className="px-6 py-3 text-left">Full Name</th>
                  <th className="px-6 py-3 text-left">Admission No</th>
                  <th className="px-6 py-3 text-left">Class & Arm</th>
                  <th className="px-6 py-3 text-left">Stream</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredStudents.map((student) => (
                  <tr key={student._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      {student.photoUrl ? (
                        <img
                          src={student.photoUrl}
                          alt={student.fullName}
                          className="h-9 w-9 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                          {student.fullName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap font-semibold text-gray-900">
                      {student.fullName}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-gray-600 font-mono text-xs">
                      {student.admissionNo}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-gray-700">
                      {(() => {
                        const cObj: any = student.classGroup || student.classId;
                        if (!cObj) return '—';
                        if (typeof cObj === 'object') {
                          const lvlName = typeof cObj.classLevelId === 'object' ? cObj.classLevelId?.name : (cObj.name || 'Class');
                          return `${lvlName} - ${cObj.arm || ''}`;
                        }
                        const matched = classes.find((c) => c._id === cObj);
                        if (matched) {
                          const lvl = typeof matched.classLevelId === 'object' ? (matched.classLevelId as any)?.name : (matched.name || 'Class');
                          return `${lvl} - ${matched.arm}`;
                        }
                        return cObj;
                      })()}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      {student.stream ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          <Layers className="w-3 h-3 mr-1" />
                          {student.stream}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">General</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-full capitalize ${
                          student.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : student.status === 'graduated'
                            ? 'bg-purple-100 text-purple-800'
                            : student.status === 'withdrawn'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {student.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-right font-medium space-x-2">
                      <button
                        onClick={() => handleView(student)}
                        className="text-gray-600 hover:text-gray-900"
                        title="View Full Profile"
                      >
                        View
                      </button>
                      <button
                        onClick={() => openStatusModal(student)}
                        className="text-amber-600 hover:text-amber-900"
                        title="Update Status"
                      >
                        Status
                      </button>
                      <button
                        onClick={() => handleEdit(student)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit Student"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(student._id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Student"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b sticky top-0 bg-white flex justify-between items-center z-10">
              <h3 className="text-lg font-bold text-gray-900">
                {editingStudent ? 'Edit Student Profile' : 'Enroll New Student'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Photo Upload Section */}
              <div className="flex items-center gap-5 p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white border border-gray-300 flex items-center justify-center flex-shrink-0">
                  {formData.photoUrl ? (
                    <img
                      src={formData.photoUrl}
                      alt="Student"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-8 h-8 text-gray-300" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 transition-colors shadow-2xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{formData.photoUrl ? 'Replace Photo' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>

                    {formData.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, photoUrl: '' }))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Recommended: JPG or PNG portrait, max 2MB. A default avatar is used if omitted.
                  </p>
                </div>
              </div>

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Adeyemi John Samuel"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      Admission Number <span className="text-red-500">*</span>
                    </label>
                    {!editingStudent && (
                      <button
                        type="button"
                        onClick={() => {
                          const year = new Date().getFullYear();
                          const rand = Math.floor(100 + Math.random() * 900);
                          setFormData({ ...formData, admissionNo: `ADM/${year}/${rand}` });
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Auto-generate
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ADM/2026/001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase font-mono"
                    value={formData.admissionNo}
                    onChange={(e) => setFormData({ ...formData, admissionNo: e.target.value.toUpperCase() })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Class Group <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.classId}
                    onChange={(e) => handleClassChange(e.target.value)}
                  >
                    <option value="">Select a class</option>
                    {classes.map((cls) => {
                      const levelName = typeof cls.classLevelId === 'object' ? (cls.classLevelId as any)?.name : (cls.name || 'Class');
                      return (
                        <option key={cls._id} value={cls._id}>
                          {levelName} - {cls.arm} {cls.faction ? `(${cls.faction})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Faction / Specialisation Stream */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Academic Stream / Faction
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.stream}
                    onChange={(e) => setFormData({ ...formData, stream: e.target.value })}
                  >
                    <option value="">General / None (Junior Sec & Primary)</option>
                    <option value="Science">Science</option>
                    <option value="Arts">Arts / Humanities</option>
                    <option value="Commercial">Commercial / Business Studies</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Guardian Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Mr. & Mrs. Adeyemi"
                    value={formData.guardianName}
                    onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Guardian Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="+234..."
                    value={formData.guardianPhone}
                    onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Residential Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. 12 Obafemi Awolowo Way, Ikeja"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-xs"
                >
                  {editingStudent ? 'Update Student' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {statusModalStudent && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Update Enrollment Status: {statusModalStudent.fullName}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Change status to active, inactive, withdrawn, or graduated.
            </p>
            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                <select
                  value={statusFormData.status}
                  onChange={(e) => setStatusFormData({ ...statusFormData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="withdrawn">Withdrawn</option>
                  <option value="graduated">Graduated</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason / Note (optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Completed SSS 3, Relocated, Transferred..."
                  value={statusFormData.statusReason}
                  onChange={(e) => setStatusFormData({ ...statusFormData, statusReason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setStatusModalStudent(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-xs"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingStudent && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b sticky top-0 bg-white flex justify-between items-center z-10">
              <h3 className="text-base font-bold text-gray-900">Student Profile & Academic Records</h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-5 pb-4 border-b">
                {viewingStudent.photoUrl ? (
                  <img
                    src={viewingStudent.photoUrl}
                    alt={viewingStudent.fullName}
                    className="h-20 w-20 rounded-full object-cover border-2 border-indigo-100"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-2xl">
                    {viewingStudent.fullName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{viewingStudent.fullName}</h4>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    Admission No: {viewingStudent.admissionNo}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-800 capitalize">
                      {viewingStudent.status}
                    </span>
                    {viewingStudent.stream && (
                      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                        {viewingStudent.stream} Stream
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Gender</p>
                  <p className="font-semibold text-gray-800">{viewingStudent.gender}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date of Birth</p>
                  <p className="font-semibold text-gray-800">
                    {viewingStudent.dateOfBirth ? new Date(viewingStudent.dateOfBirth).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Guardian Name</p>
                  <p className="font-semibold text-gray-800">{viewingStudent.guardianName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Guardian Phone</p>
                  <p className="font-semibold text-gray-800">{viewingStudent.guardianPhone}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Address</p>
                  <p className="font-semibold text-gray-800">{viewingStudent.address}</p>
                </div>
              </div>

              {/* Attendance Section */}
              {studentAttendance && (
                <div className="pt-4 border-t">
                  <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                    Attendance History
                  </h5>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 text-center">
                      <p className="text-[11px] text-gray-500">Rate</p>
                      <p className="text-xl font-bold text-green-600">{studentAttendance.attendanceRate}%</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-center">
                      <p className="text-[11px] text-gray-500">Present Days</p>
                      <p className="text-xl font-bold text-blue-600">{studentAttendance.presentDays}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
                      <p className="text-[11px] text-gray-500">Total Marked</p>
                      <p className="text-xl font-bold text-gray-700">{studentAttendance.totalMarkedDays}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Historical Results Archive */}
              <div className="pt-4 border-t">
                <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                  Historical Results Archive
                </h5>
                {studentResults.length === 0 ? (
                  <p className="text-gray-500 text-xs">No recorded results found for this student.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {studentResults.map((r: any) => (
                      <div key={r._id} className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900 text-xs">
                              {r.sessionId?.year || 'Academic Year'} ({r.sessionId?.currentTerm ? `${r.sessionId.currentTerm} Term` : ''})
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              r.performanceType === 'mid-term'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {r.performanceType === 'mid-term' ? 'Mid-Term' : 'Full Term'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            Average: <strong className="text-gray-800">{r.averageScore}%</strong>
                            {r.classPosition && <> | Position: <strong className="text-gray-800">{r.classPosition}</strong></>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fee History Section */}
              {studentFees && (
                <div className="pt-4 border-t">
                  <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                    Fee Invoices & Payments Summary
                  </h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                      <p className="text-[11px] text-gray-500">Total Billed</p>
                      <p className="text-lg font-bold text-gray-900">
                        ₦{(studentFees.invoices || []).reduce((sum: number, i: any) => sum + (i.amountDue || 0), 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                      <p className="text-[11px] text-gray-500">Total Paid</p>
                      <p className="text-lg font-bold text-emerald-600">
                        ₦{(studentFees.payments || []).reduce((sum: number, p: any) => sum + (p.amountPaid || 0), 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN PRINTABLE: OFFICIAL STUDENT ENROLLMENT REGISTER */}
      <div id="printable-students-register" className="hidden print:block p-8 bg-white text-gray-900">
        <DocumentHeader
          title="OFFICIAL STUDENT ENROLLMENT REGISTER"
          subtitle={`Class Filter: ${
            filterClass
              ? (() => {
                  const cls = classes.find((c) => c._id === filterClass);
                  if (!cls) return 'Selected Class';
                  const lvl = typeof cls.classLevelId === 'object' ? cls.classLevelId?.name : cls.name;
                  return `${lvl || 'Class'} ${cls.arm || ''}`.trim();
                })()
              : 'All Classes'
          } | Total Enrolled: ${filteredStudents.length} Students`}
        />
        <div className="mt-6 mb-4 flex justify-between items-center text-xs text-gray-600 border-b pb-2">
          <span>Date Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span>Status: Verified Active Registry</span>
        </div>
        <table className="w-full border-collapse border border-gray-300 text-xs">
          <thead>
            <tr className="bg-gray-100 text-gray-800">
              <th className="border border-gray-300 px-3 py-2 text-left w-10">S/N</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Full Name</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Admission No</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Class & Arm</th>
              <th className="border border-gray-300 px-3 py-2 text-center">Stream / Faction</th>
              <th className="border border-gray-300 px-3 py-2 text-center">Gender</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Guardian Contact</th>
              <th className="border border-gray-300 px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((st, idx) => (
              <tr key={st._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-300 px-3 py-2 text-center">{idx + 1}</td>
                <td className="border border-gray-300 px-3 py-2 font-bold">{st.fullName}</td>
                <td className="border border-gray-300 px-3 py-2 font-mono">{st.admissionNo}</td>
                <td className="border border-gray-300 px-3 py-2">
                  {st.classGroup ? `${st.classGroup.name} ${st.classGroup.arm}` : 'Not Assigned'}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center font-semibold">
                  {st.stream || 'General'}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center capitalize">{st.gender || '-'}</td>
                <td className="border border-gray-300 px-3 py-2 font-mono text-[11px]">
                  {st.guardianPhone || st.guardianName || '-'}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center capitalize font-semibold">
                  {st.status || 'Active'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-8 pt-12 mt-8 border-t border-gray-300 text-xs">
          <div>
            <div className="border-b border-gray-900 pb-1 mb-1 font-semibold">Admissions & Records Officer</div>
            <p className="text-[10px] text-gray-500 uppercase">Compiled & Certified By</p>
          </div>
          <div className="text-right">
            <div className="border-b border-gray-900 pb-1 mb-1 font-semibold">School Principal / Head of School</div>
            <p className="text-[10px] text-gray-500 uppercase">Official Stamp & Date</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Students;
