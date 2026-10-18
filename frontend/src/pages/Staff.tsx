import React, { useEffect, useState } from 'react';
import api from '../services/api';

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
  name: string;
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
  const [credentials, setCredentials] = useState({ email: '', password: '' });
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
          name: formData.name,
          email: formData.email,
          role: formData.role,
          photoUrl: formData.photoUrl,
        };
        if (formData.role === 'teacher') {
          updateData.assignedClasses = formData.assignedClasses;
        }
        await api.put(`/staff/${editingStaff._id}`, updateData);
      } else {
        const response = await api.post('/staff', formData);
        setCredentials(response.data.credentials);
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
      assignedClasses: staffMember.assignedClasses.map((c) => c._id),
      photoUrl: staffMember.photoUrl || '',
    });
    setShowModal(true);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this staff member?')) return;
    try {
      await api.delete(`/staff/${id}`);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to deactivate staff member');
    }
  };

  const handleAssignClasses = (staffMember: Staff) => {
    setAssigningStaff(staffMember);
    setFormData({
      name: staffMember.name,
      email: staffMember.email,
      password: '',
      role: staffMember.role,
      assignedClasses: staffMember.assignedClasses.map((c) => c._id),
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Load and resize the image client-side
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          alert('Failed to process image');
          return;
        }

        // Calculate new dimensions (max 500px on longest side)
        const MAX_DIMENSION = 500;
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

        // Draw and resize the image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG at 0.8 quality
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);

        // Check if still too large (unlikely at 500px JPEG)
        const MAX_SIZE = 500 * 1024; // 500KB after compression
        const approxSize = Math.round((resizedDataUrl.length * 3) / 4);
        
        if (approxSize > MAX_SIZE) {
          alert('Photo is still too large after resizing. Please choose a smaller image.');
          return;
        }

        setFormData({ ...formData, photoUrl: resizedDataUrl });
      };
      img.onerror = () => {
        alert('Failed to load image. Please try another file.');
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
      admin: 'Admin',
      teacher: 'Teacher',
      accountant: 'Accountant',
      bookshop: 'Bookshop',
    };
    return names[role] || role;
  };

  const getRolePermissions = (role: Staff['role']) => {
    const permissions: Record<Staff['role'], string> = {
      admin: 'Full access to all modules',
      teacher: 'Can mark attendance and view assigned classes/students',
      accountant: 'Can access Fees module (invoices, payments, dashboard)',
      bookshop: 'No functional permissions yet (future bookshop module)',
    };
    return permissions[role] || 'No permissions defined';
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
        <button
          onClick={openModal}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          Add Staff
        </button>
      </div>

      {/* Role Filter Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {(['all', 'teacher', 'accountant', 'bookshop', 'admin'] as RoleFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setRoleFilter(filter)}
              className={`${
                roleFilter === filter
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {filter === 'all' ? 'All Staff' : getRoleDisplayName(filter)}
            </button>
          ))}
        </nav>
      </div>

      {filteredStaff.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No staff members found</p>
          <button
            onClick={openModal}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Create your first staff member
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Photo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned Classes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStaff.map((staffMember) => (
                <tr key={staffMember._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {staffMember.photoUrl ? (
                      <img
                        src={staffMember.photoUrl}
                        alt={staffMember.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                        {staffMember.name.charAt(0)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {staffMember.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {staffMember.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {staffMember.role === 'teacher' && staffMember.assignedClasses.length > 0
                      ? staffMember.assignedClasses.map((c) => `${c.name} - ${c.arm}`).join(', ')
                      : staffMember.role === 'teacher'
                      ? 'None'
                      : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        staffMember.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {staffMember.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {staffMember.role === 'teacher' && (
                      <button
                        onClick={() => handleAssignClasses(staffMember)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                        title="Assign Classes"
                      >
                        Assign
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(staffMember)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      Edit
                    </button>
                    {staffMember.status === 'active' && (
                      <button
                        onClick={() => handleDeactivate(staffMember._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Photo
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif"
                  onChange={handlePhotoUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {formData.photoUrl && (
                  <div className="mt-2">
                    <img
                      src={formData.photoUrl}
                      alt="Preview"
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Staff['role'], assignedClasses: [] })}
                >
                  <option value="teacher">Teacher</option>
                  <option value="accountant">Accountant</option>
                  <option value="bookshop">Bookshop Staff</option>
                  <option value="admin">Admin</option>
                </select>
                {formData.role && (
                  <p className="text-xs text-gray-500 mt-1">
                    {getRolePermissions(formData.role)}
                  </p>
                )}
              </div>
              {formData.role === 'teacher' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assigned Classes
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
                    {classes.map((cls) => (
                      <label key={cls._id} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={formData.assignedClasses.includes(cls._id)}
                          onChange={() => toggleClassAssignment(cls._id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 break-words">
                          {cls.name} - {cls.arm}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {!editingStaff && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password (leave blank to auto-generate)
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 runded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Auto-generate if empty"
                  />
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
                  {editingStaff ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentialsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Staff Credentials
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800 mb-2">
                  Please save these credentials. You won't be able to see them again.
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Email:</label>
                    <p className="text-sm font-medium text-gray-900">{credentials.email}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Password:</label>
                    <p className="text-sm font-medium text-gray-900">{credentials.password}</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowCredentialsModal(false)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  I've Saved These
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Classes Modal */}
      {showAssignModal && assigningStaff && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Assign Classes to {assigningStaff.name}
              </h3>
            </div>
            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Classes
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {classes.map((cls) => (
                    <label key={cls._id} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.assignedClasses.includes(cls._id)}
                        onChange={() => toggleClassAssignment(cls._id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">
                        {cls.name} - {cls.arm}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Save Assignments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
