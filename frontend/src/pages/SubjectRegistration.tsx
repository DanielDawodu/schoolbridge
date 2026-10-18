import React, { useEffect, useState } from 'react';
import api from '../services/api';

interface Subject {
  _id: string;
  name: string;
  code: string;
  category: 'core' | 'elective';
}

interface ClassGroup {
  _id: string;
  name: string;
  arm: string;
}

interface Student {
  _id: string;
  fullName: string;
  admissionNo: string;
}

interface Staff {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface AcademicSession {
  _id: string;
  year: string;
  currentTerm: string;
}

interface SubjectRegistration {
  _id: string;
  subjectId: Subject;
  classId?: ClassGroup;
  studentId?: Student;
  stream?: string;
  assignedTeacherId?: Staff;
}

const SubjectRegistration: React.FC = () => {
  const [registrations, setRegistrations] = useState<SubjectRegistration[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [registrationType, setRegistrationType] = useState<'class' | 'student'>('class');
  const [formData, setFormData] = useState({
    sessionId: '',
    subjectId: '',
    classId: '',
    studentIds: [] as string[],
    stream: '',
    assignedTeacherId: '',
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [regsRes, subjectsRes, classesRes, studentsRes, teachersRes, sessionsRes] = await Promise.all([
        api.get('/subject-registrations'),
        api.get('/subjects'),
        api.get('/classes'),
        api.get('/students'),
        api.get('/staff'),
        api.get('/academic-sessions'),
      ]);
      setRegistrations(regsRes.data);
      setSubjects(subjectsRes.data);
      setClasses(classesRes.data);
      setStudents(studentsRes.data);
      setTeachers(teachersRes.data.filter((t: Staff) => t.role === 'teacher'));
      setSessions(sessionsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (registrationType === 'class') {
        await api.post('/subject-registrations', {
          sessionId: formData.sessionId,
          subjectId: formData.subjectId,
          classId: formData.classId,
          stream: formData.stream,
          assignedTeacherId: formData.assignedTeacherId,
        });
      } else {
        await api.post('/subject-registrations/bulk', {
          sessionId: formData.sessionId,
          subjectId: formData.subjectId,
          studentIds: formData.studentIds,
          stream: formData.stream,
          assignedTeacherId: formData.assignedTeacherId,
        });
      }
      setShowModal(false);
      setFormData({
        sessionId: '',
        subjectId: '',
        classId: '',
        studentIds: [],
        stream: '',
        assignedTeacherId: '',
      });
      fetchAllData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create registration');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this registration?')) return;
    try {
      await api.delete(`/subject-registrations/${id}`);
      fetchAllData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete registration');
    }
  };

  const openModal = (type: 'class' | 'student') => {
    setRegistrationType(type);
    setFormData({
      sessionId: '',
      subjectId: '',
      classId: '',
      studentIds: [],
      stream: '',
      assignedTeacherId: '',
    });
    setShowModal(true);
  };

  const toggleStudentSelection = (studentId: string) => {
    setFormData(prev => ({
      ...prev,
      studentIds: prev.studentIds.includes(studentId)
        ? prev.studentIds.filter(id => id !== studentId)
        : [...prev.studentIds, studentId],
    }));
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subject Registration</h1>
        <p className="text-gray-600">Register subjects for classes or individual students</p>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Registrations</h2>
          <div className="space-x-2">
            <button
              onClick={() => openModal('class')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              Register Class
            </button>
            <button
              onClick={() => openModal('student')}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Register Students
            </button>
          </div>
        </div>

        {registrations.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">No subject registrations found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stream
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Teacher
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {registrations.map((reg) => (
                  <tr key={reg._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reg.subjectId.name} ({reg.subjectId.code})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reg.classId ? `${reg.classId.name} - ${reg.classId.arm}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reg.studentId ? reg.studentId.fullName : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reg.stream || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reg.assignedTeacherId ? reg.assignedTeacherId.name : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(reg._id)}
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

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {registrationType === 'class' ? 'Register Subject for Class' : 'Register Subject for Students'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Academic Session
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.sessionId}
                  onChange={(e) => setFormData({ ...formData, sessionId: e.target.value })}
                >
                  <option value="">Select session</option>
                  {sessions.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.year} - {s.currentTerm}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              {registrationType === 'class' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Class
                  </label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  >
                    <option value="">Select class</option>
                    {classes.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} - {c.arm}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Students
                  </label>
                  <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
                    {students.map((student) => (
                      <label key={student._id} className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          checked={formData.studentIds.includes(student._id)}
                          onChange={() => toggleStudentSelection(student._id)}
                          className="mr-2"
                        />
                        <span className="text-sm">{student.fullName} ({student.admissionNo})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stream (for SSS electives)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Science, Arts, Commercial"
                  value={formData.stream}
                  onChange={(e) => setFormData({ ...formData, stream: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Teacher
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.assignedTeacherId}
                  onChange={(e) => setFormData({ ...formData, assignedTeacherId: e.target.value })}
                >
                  <option value="">Select teacher (optional)</option>
                  {teachers.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
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
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectRegistration;
