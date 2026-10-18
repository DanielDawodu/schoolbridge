import React, { useEffect, useState } from 'react';
import api from '../services/api';

interface SubjectScore {
  subjectId: string;
  subjectName: string;
  ca1: number;
  ca2: number;
  exam: number;
  total: number;
  grade: string;
}

interface StudentResult {
  _id: string;
  subjectScores: SubjectScore[];
  teacherComment: string;
  headOfSchoolComment: string;
}

interface Student {
  _id: string;
  fullName: string;
  admissionNo: string;
  classId: string;
  photo?: string;
}

interface AcademicSession {
  _id: string;
  year: string;
  currentTerm: string;
}

interface ClassGroup {
  _id: string;
  name: string;
  arm: string;
}

interface School {
  name: string;
  address: string;
  signatureUrl?: string;
}

const HalfTermReport: React.FC = () => {
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [result, setResult] = useState<StudentResult | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchClasses();
    fetchSchool();
  }, []);

  useEffect(() => {
    if (selectedSession && selectedClass) {
      fetchStudents();
    }
  }, [selectedSession, selectedClass]);

  useEffect(() => {
    if (selectedSession && selectedStudent) {
      fetchResult();
    }
  }, [selectedSession, selectedStudent]);

  const fetchSessions = async () => {
    try {
      const response = await api.get('/academic-sessions');
      setSessions(response.data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await api.get('/classes');
      setClasses(response.data);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
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

  const fetchStudents = async () => {
    if (!selectedSession || !selectedClass) return;
    try {
      setLoading(true);
      const response = await api.get('/students');
      const classStudents = response.data.filter((s: Student) => s.classId === selectedClass);
      setStudents(classStudents);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResult = async () => {
    if (!selectedSession || !selectedStudent) return;
    try {
      setLoading(true);
      const response = await api.get('/report-cards', {
        params: { sessionId: selectedSession, studentId: selectedStudent, performanceType: 'mid-term' },
      });
      setResult(response.data.result);
    } catch (error) {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedStudentData = students.find(s => s._id === selectedStudent);
  const selectedSessionData = sessions.find(s => s._id === selectedSession);
  const selectedClassData = classes.find(c => c._id === selectedClass);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Half Term Assessment Report</h1>
        <p className="text-gray-600">Generate mid-term progress reports</p>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Academic Session</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              disabled={!selectedSession}
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} - {c.arm}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              disabled={!selectedClass}
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.fullName} ({s.admissionNo})
                </option>
              ))}
            </select>
          </div>
        </div>

        {result && (
          <button
            onClick={handlePrint}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Print Report
          </button>
        )}
      </div>

      {result && selectedStudentData && school && selectedSessionData && selectedClassData && (
        <div className="bg-white rounded-lg shadow p-8 print:shadow-none print:rounded-none">
          {/* School Header */}
          <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
            <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
            <p className="text-gray-600">{school.address}</p>
            <h2 className="text-xl font-semibold text-gray-800 mt-2">Half Term Assessment Report</h2>
          </div>

          {/* Student Info */}
          <div className="flex items-center mb-6">
            {selectedStudentData.photo && (
              <img
                src={selectedStudentData.photo}
                alt={selectedStudentData.fullName}
                className="w-24 h-24 rounded-full mr-4 object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{selectedStudentData.fullName}</h3>
              <p className="text-sm text-gray-600">Admission No: {selectedStudentData.admissionNo}</p>
              <p className="text-sm text-gray-600">Class: {selectedClassData.name} - {selectedClassData.arm}</p>
              <p className="text-sm text-gray-600">Session: {selectedSessionData.year} ({selectedSessionData.currentTerm} Term)</p>
            </div>
          </div>

          {/* Subject Scores Table */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Academic Performance</h3>
            <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Subject</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Mark Obtainable</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Marks Obtained</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Percentage</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Grade</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {result.subjectScores.map((score) => (
                  <tr key={score.subjectId}>
                    <td className="px-4 py-2 text-sm text-gray-900 border-b">{score.subjectName}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 border-b">100</td>
                    <td className="px-4 py-2 text-sm text-gray-900 border-b">{score.total}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 border-b">{score.total}%</td>
                    <td className="px-4 py-2 text-sm font-medium border-b">
                      <span className={`px-2 py-1 rounded ${
                        score.grade === 'A' ? 'bg-green-100 text-green-800' :
                        score.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                        score.grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                        score.grade === 'D' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {score.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Comments */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Teacher's Comment</h3>
            <div className="border border-gray-300 rounded-md p-4 min-h-[60px]">
              <p className="text-sm text-gray-700">{result.teacherComment || 'No comment provided.'}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Head of School's Comment</h3>
            <div className="border border-gray-300 rounded-md p-4 min-h-[60px]">
              <p className="text-sm text-gray-700">{result.headOfSchoolComment || 'No comment provided.'}</p>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 mt-8 pt-6 border-t">
            <div>
              <div className="h-16 mb-2">
                {school.signatureUrl && (
                  <img src={school.signatureUrl} alt="Teacher Signature" className="h-full" />
                )}
              </div>
              <p className="text-sm text-gray-600">Teacher's Signature & Date</p>
            </div>
            <div>
              <div className="h-16 mb-2">
                {school.signatureUrl && (
                  <img src={school.signatureUrl} alt="Principal Signature" className="h-full" />
                )}
              </div>
              <p className="text-sm text-gray-600">Principal's Signature & Date</p>
            </div>
          </div>
        </div>
      )}

      {selectedStudent && !result && !loading && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">No mid-term result found for this student.</p>
        </div>
      )}
    </div>
  );
};

export default HalfTermReport;
