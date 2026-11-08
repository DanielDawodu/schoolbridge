import React, { useEffect, useState } from 'react';
import api from '../services/api';
import DocumentHeader from '../components/DocumentHeader';
import { printElement } from '../utils/printHelper';
import {
  Download,
  Plus,
  Upload,
  User as UserIcon,
  Printer,
} from 'lucide-react';

interface Staff {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'accountant' | 'bookshop';
  assignedClasses: ClassGroup[];
  status: string;
  photoUrl?: string;
}

interface ClassGroup {
  _id: string;
  name?: string;
  classLevelId?: { _id: string; name: string } | string;
  arm: string;
}

type RoleFilter = 'all' | 'teacher' | 'accountant' | 'bookshop' | 'admin';

const Staff: React.FC = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [assigningStaff, setAssigningStaff] = useState<Staff | null>(null);
  const [credentials, setCredentials] = useState({ email: '', password: '', title: '' });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'teacher' as Staff['role'],
    assignedClasses: [] as string[],
    photoUrl: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (roleFilter === 'all') {
      setFilteredStaff(staff);
    } else {
      setFilteredStaff(staff.filter((s) => s.role === roleFilter));
    }
  }, [staff, roleFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [staffRes, classesRes] = await Promise.all([
        api.get('/staff'),
        api.get('/classes'),
      ]);
      setStaff(staffRes.data);
      setFilteredStaff(staffRes.data);
      setClasses(classesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        const updateData: any = {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          role: formData.role,
          photoUrl: formData.photoUrl || undefined,
        };
        if (formData.role === 'teacher') {
          updateData.assignedClasses = formData.assignedClasses;
        }
        await api.put(`/staff/${editingStaff._id}`, updateData);
      } else {
        const response = await api.post('/staff', formData);
        setCredentials({
          email: response.data.credentials.email,
          password: response.data.credentials.password,
          title: 'Staff Member Created Successfully',
        });
        setShowCredentialsModal(true);
      }
      setShowModal(false);
      setEditingStaff(null);
      setFormData({ name: '', email: '', password: '', role: 'teacher', assignedClasses: [], photoUrl: '' });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save staff member');
    }
  };

  const handleEdit = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name,
      email: staffMember.email,
      password: '',
      role: staffMember.role,
      assignedClasses: (staffMember.assignedClasses || []).map((c) =>
        typeof c === 'object' && c._id ? c._id : String(c)
      ),
      photoUrl: staffMember.photoUrl || '',
    });
    setShowModal(true);
  };

  const handleToggleStatus = async (staffMember: Staff) => {
    const isCurrentlyActive = (staffMember.status || 'active') === 'active';
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} ${staffMember.name}'s account?`)) return;

    try {
      const newStatus = isCurrentlyActive ? 'inactive' : 'active';
      await api.put(`/staff/${staffMember._id}/status`, { status: newStatus });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || `Failed to ${action} staff member`);
    }
  };

  const handleResetPassword = async (staffMember: Staff) => {
    if (!confirm(`Reset password for ${staffMember.name}? A new temporary password will be generated.`)) return;

    try {
      const res = await api.post(`/staff/${staffMember._id}/reset-password`);
      setCredentials({
        email: staffMember.email,
        password: res.data.temporaryPassword,
        title: `Password Reset for ${staffMember.name}`,
      });
      setShowCredentialsModal(true);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reset staff password');
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/staff/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'staff-export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export staff CSV');
    }
  };

  const handleAssignClasses = (staffMember: Staff) => {
    setAssigningStaff(staffMember);
    setFormData({
      name: staffMember.name,
      email: staffMember.email,
      password: '',
      role: staffMember.role,
      assignedClasses: (staffMember.assignedClasses || []).map((c) =>
        typeof c === 'object' && c._id ? c._id : String(c)
      ),
      photoUrl: staffMember.photoUrl || '',
    });
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/staff/${assigningStaff?._id}/classes`, {
        assignedClasses: formData.assignedClasses,
      });
      setShowAssignModal(false);
      setAssigningStaff(null);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign classes');
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

  const openModal = () => {
    setEditingStaff(null);
    setFormData({ name: '', email: '', password: '', role: 'teacher', assignedClasses: [], photoUrl: '' });
    setShowModal(true);
  };

  const toggleClassAssignment = (classId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedClasses: prev.assignedClasses.includes(classId)
        ? prev.assignedClasses.filter((id) => id !== classId)
        : [...prev.assignedClasses, classId],
    }));
  };

  const getRoleDisplayName = (role: Staff['role']) => {
    const names: Record<Staff['role'], string> = {
      admin: 'Administrator',
      teacher: 'Teacher',
      accountant: 'Accountant',
      bookshop: 'Bookshop',
    };
    return names[role] || role;
  };

  const getClassName = (c: any) => {
    if (!c) return 'Class';
    if (typeof c === 'object') {
      const level = c.classLevelId?.name || c.name || 'Class';
      const arm = c.arm ? ` ${c.arm}` : '';
      return `${level}${arm}`;
    }
    const found = classes.find((item) => item._id === String(c));
    if (found) {
      const level = (found.classLevelId as any)?.name || found.name || 'Class';
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Staff Management</h1>
          <p className="text-sm text-gray-500">
            Create teacher, accountant, and admin accounts, assign roles, manage passwords, and toggle active status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors shadow-2xs"
            title="Export staff register to CSV"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => printElement('printable-staff-register', 'Official Staff Directory Register')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg text-sm font-medium transition-colors shadow-2xs cursor-pointer"
            title="Print Official Staff Register"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span>Print Register</span>
          </button>

          <button
            onClick={openModal}
            className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          {(['all', 'teacher', 'accountant', 'admin'] as RoleFilter[]).map((filter) => {
            const count = filter === 'all' ? staff.length : staff.filter((s) => s.role === filter).length;
            return (
              <button
                key={filter}
                onClick={() => setRoleFilter(filter)}
                className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                  roleFilter === filter
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {filter === 'all' ? 'All Staff' : getRoleDisplayName(filter)} ({count})
              </button>
            );
          })}
        </nav>
      </div>

      {/* Staff Table */}
      {filteredStaff.length === 0 ? (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-12 text-center">
          <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4 text-sm">No staff members found matching this filter</p>
          <button
            onClick={openModal}
            className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm"
          >
            Create a staff account
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left w-14">Photo</th>
                <th className="px-6 py-3 text-left">Staff Name</th>
                <th className="px-6 py-3 text-left">Email Address</th>
                <th className="px-6 py-3 text-left">Role</th>
                <th className="px-6 py-3 text-left">Assigned Classes</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredStaff.map((staffMember) => {
                const isActive = (staffMember.status || 'active') === 'active';
                return (
                  <tr key={staffMember._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      {staffMember.photoUrl ? (
                        <img
                          src={staffMember.photoUrl}
                          alt={staffMember.name}
                          className="h-9 w-9 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                          {staffMember.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap font-semibold text-gray-900">
                      {staffMember.name}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-gray-600">
                      {staffMember.email}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-full capitalize ${
                          staffMember.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : staffMember.role === 'teacher'
                            ? 'bg-blue-100 text-blue-800'
                            : staffMember.role === 'accountant'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {getRoleDisplayName(staffMember.role)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-xs text-gray-600">
                      {staffMember.role === 'teacher' && (staffMember.assignedClasses || []).length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {staffMember.assignedClasses.map((c, i) => (
                            <span
                              key={i}
                              className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200"
                            >
                              {getClassName(c)}
                            </span>
                          ))}
                        </div>
                      ) : staffMember.role === 'teacher' ? (
                        <span className="text-gray-400">Unassigned</span>
                      ) : (
                        <span className="text-gray-400">All Modules (Role-based)</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-full capitalize ${
                          isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {staffMember.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {staffMember.role === 'teacher' && (
                        <button
                          onClick={() => handleAssignClasses(staffMember)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Assign Classes"
                        >
                          Classes
                        </button>
                      )}
                      <button
                        onClick={() => handleResetPassword(staffMember)}
                        className="text-amber-600 hover:text-amber-900"
                        title="Reset Temporary Password"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => handleEdit(staffMember)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(staffMember)}
                        className={`${isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                        title={isActive ? 'Deactivate Account' : 'Reactivate Account'}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-gray-900">
                {editingStaff ? 'Edit Staff Profile' : 'Register New Staff Member'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Photo Upload */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-white border border-gray-300 flex items-center justify-center flex-shrink-0">
                  {formData.photoUrl ? (
                    <img src={formData.photoUrl} alt="Staff" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-7 h-7 text-gray-300" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 transition-colors shadow-2xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{formData.photoUrl ? 'Replace' : 'Upload'}</span>
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
                        className="text-xs text-red-600 hover:bg-red-50 p-1 rounded"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500">Max 2MB image.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Mr. Folorunso Adewale"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. teacher@school.edu.ng"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  System Role <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                >
                  <option value="teacher">Teacher (Class & Result Entry)</option>
                  <option value="accountant">Accountant (Fees & Vouchers)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              {formData.role === 'teacher' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assigned Classes
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2.5 bg-gray-50">
                    {classes.map((cls) => (
                      <label key={cls._id} className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={formData.assignedClasses.includes(cls._id)}
                          onChange={() => toggleClassAssignment(cls._id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                        />
                        <span>{getClassName(cls)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!editingStaff && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Initial Password (leave blank to auto-generate)
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Auto-generated if empty"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t">
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
                  {editingStaff ? 'Update Staff' : 'Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Popup Modal */}
      {showCredentialsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">{credentials.title}</h3>
            <p className="text-xs text-gray-500 mb-4">
              Communicate these temporary login credentials to the staff member. They will be prompted to change their password on first sign-in.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2 text-xs">
              <div>
                <span className="font-semibold text-gray-600">Email:</span>{' '}
                <span className="font-mono text-gray-900 select-all">{credentials.email}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-600">Temporary Password:</span>{' '}
                <span className="font-mono font-bold text-indigo-700 select-all bg-amber-100 px-1.5 py-0.5 rounded">
                  {credentials.password}
                </span>
              </div>
            </div>

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs font-semibold shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Classes Modal */}
      {showAssignModal && assigningStaff && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-base font-bold text-gray-900">
                Assign Classes: {assigningStaff.name}
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5 max-h-60 overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-200">
                {classes.map((cls) => (
                  <label key={cls._id} className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.assignedClasses.includes(cls._id)}
                      onChange={() => toggleClassAssignment(cls._id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    <span>{getClassName(cls)}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Save Assignments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HIDDEN PRINTABLE: OFFICIAL STAFF DIRECTORY & REGISTER */}
      <div id="printable-staff-register" className="hidden print:block p-8 bg-white text-gray-900">
        <DocumentHeader
          title="OFFICIAL STAFF DIRECTORY & REGISTER"
          subtitle={`Role Filter: ${roleFilter.toUpperCase()} | Total Staff Members: ${filteredStaff.length}`}
        />
        <div className="mt-6 mb-4 flex justify-between items-center text-xs text-gray-600 border-b pb-2">
          <span>Date Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span>Status: Verified Official Staff Record</span>
        </div>
        <table className="w-full border-collapse border border-gray-300 text-xs">
          <thead>
            <tr className="bg-gray-100 text-gray-800">
              <th className="border border-gray-300 px-3 py-2 text-left w-10">S/N</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Staff Name</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Email Address</th>
              <th className="border border-gray-300 px-3 py-2 text-center">Institutional Role</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Assigned Classes</th>
              <th className="border border-gray-300 px-3 py-2 text-center">Account Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((s, idx) => (
              <tr key={s._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-300 px-3 py-2 text-center">{idx + 1}</td>
                <td className="border border-gray-300 px-3 py-2 font-bold">{s.name}</td>
                <td className="border border-gray-300 px-3 py-2 font-mono text-[11px]">{s.email}</td>
                <td className="border border-gray-300 px-3 py-2 text-center uppercase font-semibold text-[11px]">
                  {s.role}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-[11px]">
                  {s.assignedClasses && s.assignedClasses.length > 0
                    ? s.assignedClasses.map((c) => getClassName(c)).join(', ')
                    : '-'}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center capitalize font-semibold">
                  {s.status || 'active'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-8 pt-12 mt-8 border-t border-gray-300 text-xs">
          <div>
            <div className="border-b border-gray-900 pb-1 mb-1 font-semibold">Human Resources / Administration</div>
            <p className="text-[10px] text-gray-500 uppercase">Certified Correct By</p>
          </div>
          <div className="text-right">
            <div className="border-b border-gray-900 pb-1 mb-1 font-semibold">School Principal / Head of School</div>
            <p className="text-[10px] text-gray-500 uppercase">Institutional Verification Stamp</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Staff;
