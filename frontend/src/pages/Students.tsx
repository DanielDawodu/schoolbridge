import React, { useEffect, useState } from 'react';
import api from '../services/api';

interface Student {
  _id: string;
  fullName: string;
  admissionNo: string;
  classId: string;
  gender: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  status: string;
  photoUrl?: string;
  classGroup?: {
    _id: string;
    name: string;
    arm: string;
  };
}

interface ClassGroup {
  _id: string;
  name: string;
  arm: string;
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
  const [filterClass, setFilterClass] = useState('');
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
  });

  useEffect(() => {
    fetchData();
  }, [filterClass]);

  const fetchData = async () => {
    try {
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
      });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save student');
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      fullName: student.fullName,
      admissionNo: student.admissionNo,
      classId: student.classId,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth.split('T')[0],
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      address: student.address,
      status: student.status,
      photoUrl: student.photoUrl || '',
    });
    setShowModal(true);
  };

  const handleView = async (student: Student) => {
    setViewingStudent(student);
    setShowViewModal(true);
    
    // Fetch attendance and fees for the student
    try {
      const [attendanceRes, feesRes] = await Promise.all([
        api.get(`/attendance/student/${student._id}`),
        api.get(`/fees/student/${student._id}`),
      ]);
      setStudentAttendance(attendanceRes.data);
      setStudentFees(feesRes.data);
    } catch (error) {
      console.error('Failed to fetch student details:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      await api.delete(`/students/${id}`);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete student');
    }
  };

  const openModal = () => {
    setEditingStudent(null);
    setFormData({
      fullName: '',
      admissionNo: '',
      classId: classes[0]?._id || '',
      gender: '',
      dateOfBirth: '',
      guardianName: '',
      guardianPhone: '',
      address: '',
      status: 'active',
      photoUrl: '',
    });
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="">All Classes</option>
            {classes.map((cls) => (
              <option key={cls._id} value={cls._id}>
                {cls.name} - {cls.arm}
              </option>
            ))}
          </select>
          <button
            onClick={openModal}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Add Student
          </button>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No students found</p>
          <button
            onClick={openModal}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Register your first student
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
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
                    Admission No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
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
                {students.map((student) => (
                  <tr key={student._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.photoUrl ? (
                        <img
                          src={student.photoUrl}
                          alt={student.fullName}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                          {student.fullName.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {student.fullName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.admissionNo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.classGroup?.name} - {student.classGroup?.arm}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          student.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleView(student)}
                        className="text-gray-600 hover:text-gray-900 mr-3"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEdit(student)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(student._id)}
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
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admission Number
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.admissionNo}
                    onChange={(e) => setFormData({ ...formData, admissionNo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  >
                    <option value="">Select a class</option>
                    {classes.map((cls) => (
                      <option key={cls._id} value={cls._id}>
                        {cls.name} - {cls.arm}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Photo
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
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
                      }
                    }}
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
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guardian Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.guardianName}
                    onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guardian Phone
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.guardianPhone}
                    onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
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
                  {editingStudent ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingStudent && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b sticky top-0 bg-white flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Student Profile</h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="flex justify-center mb-6">
                {viewingStudent.photoUrl ? (
                  <img
                    src={viewingStudent.photoUrl}
                    alt={viewingStudent.fullName}
                    className="h-32 w-32 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium text-4xl">
                    {viewingStudent.fullName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Full Name</p>
                  <p className="text-lg font-semibold text-gray-900">{viewingStudent.fullName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Admission Number</p>
                  <p className="text-lg font-semibold text-gray-900">{viewingStudent.admissionNo}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Class</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {viewingStudent.classGroup?.name} - {viewingStudent.classGroup?.arm}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Gender</p>
                  <p className="text-lg font-semibold text-gray-900">{viewingStudent.gender}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date of Birth</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(viewingStudent.dateOfBirth).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      viewingStudent.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {viewingStudent.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Guardian Name</p>
                  <p className="text-lg font-semibold text-gray-900">{viewingStudent.guardianName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Guardian Phone</p>
                  <p className="text-lg font-semibold text-gray-900">{viewingStudent.guardianPhone}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-gray-500">Address</p>
                  <p className="text-lg font-semibold text-gray-900">{viewingStudent.address}</p>
                </div>
              </div>

              {/* Attendance Section */}
              {studentAttendance && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Attendance History</h4>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-gray-500">Attendance Rate</p>
                      <p className="text-2xl font-bold text-green-600">{studentAttendance.attendanceRate}%</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-gray-500">Present Days</p>
                      <p className="text-2xl font-bold text-blue-600">{studentAttendance.presentDays}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-sm text-gray-500">Total Marked</p>
                      <p className="text-2xl font-bold text-gray-600">{studentAttendance.totalMarkedDays}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Fees Section */}
              {studentFees && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Fee History</h4>
                  {studentFees.invoices.length === 0 ? (
                    <p className="text-gray-500">No fee invoices found for this student.</p>
                  ) : (
                    <div className="space-y-3">
                      {studentFees.invoices.map((invoice: any) => {
                        const totalPaid = studentFees.payments
                          .filter((p: any) => p.invoiceId === invoice._id)
                          .reduce((sum: number, p: any) => sum + p.amountPaid, 0);
                        const remaining = invoice.amountDue - totalPaid;
                        return (
                          <div key={invoice._id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-gray-900">{invoice.termId.name}</p>
                                <p className="text-sm text-gray-500">
                                  Due: {new Date(invoice.dueDate).toLocaleDateString()}
                                </p>
                              </div>
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  invoice.status === 'paid'
                                    ? 'bg-green-100 text-green-800'
                                    : invoice.status === 'partial'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {invoice.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                              <div>
                                <p className="text-gray-500">Due</p>
                                <p className="font-medium">₦{invoice.amountDue.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Paid</p>
                                <p className="font-medium text-green-600">₦{totalPaid.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Remaining</p>
                                <p className={`font-medium ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  ₦{remaining.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;
