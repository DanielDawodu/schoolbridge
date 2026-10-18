import React, { useEffect, useState } from 'react';
import api from '../services/api';

interface Subject {
  _id: string;
  name: string;
  code: string;
  ca1Weight: number;
  ca2Weight: number;
  examWeight: number;
}

interface SubjectRegistration {
  _id: string;
  subjectId: Subject;
  assignedTeacherId?: {
    _id: string;
    fullName: string;
  };
}

interface ClassGroup {
  _id: string;
  classLevelId: string | { _id: string; name: string };
  arm: string;
  periodId: string | { _id: string };
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

interface SubjectScore {
  subjectId: string;
  subjectName: string;
  ca1: number;
  ca2: number;
  exam: number;
  total: number;
  grade: string;
}

interface PsychomotorRating {
  trait: string;
  rating: number;
}

interface AffectiveRating {
  trait: string;
  rating: number;
}

const PSYCHOMOTOR_TRAITS = [
  'Handwriting',
  'Games & Sport',
  'Fluency',
  'Handling of Tools',
  'Drawing & Painting',
  'Craft',
];

const AFFECTIVE_TRAITS = [
  'Punctuality',
  'Neatness',
  'Leadership Trait',
  'Honesty',
  'Self Control',
  'Attentiveness in Class',
];

const GRADE_SCALE = [
  { min: 70, max: 100, grade: 'A' },
  { min: 60, max: 69, grade: 'B' },
  { min: 50, max: 59, grade: 'C' },
  { min: 40, max: 49, grade: 'D' },
  { min: 0, max: 39, grade: 'F' },
];

const calculateGrade = (score: number): string => {
  for (const { min, max, grade } of GRADE_SCALE) {
    if (score >= min && score <= max) {
      return grade;
    }
  }
  return 'F';
};

const calculateTotal = (ca1: number, ca2: number, exam: number, subject: Subject): number => {
  const total = (ca1 * subject.ca1Weight / 100) + (ca2 * subject.ca2Weight / 100) + (exam * subject.examWeight / 100);
  return Math.round(total);
};

const ResultEntry: React.FC = () => {
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjectRegistrations, setSubjectRegistrations] = useState<SubjectRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [subjectScores, setSubjectScores] = useState<Record<string, SubjectScore>>({});
  const [psychomotorSkills, setPsychomotorSkills] = useState<PsychomotorRating[]>([]);
  const [affectiveDomain, setAffectiveDomain] = useState<AffectiveRating[]>([]);
  const [teacherComment, setTeacherComment] = useState('');
  const [headOfSchoolComment, setHeadOfSchoolComment] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [performanceType, setPerformanceType] = useState<'mid-term' | 'term'>('term');

  useEffect(() => {
    fetchCurrentUser();
    fetchSessions();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedSession && selectedClass) {
      fetchStudents();
    }
  }, [selectedSession, selectedClass]);

  useEffect(() => {
    if (selectedSession && selectedStudent) {
      fetchSubjectRegistrations();
      fetchExistingResult();
    }
  }, [selectedSession, selectedStudent, performanceType]);

  useEffect(() => {
    // Initialize psychomotor and affective ratings
    setPsychomotorSkills(PSYCHOMOTOR_TRAITS.map(trait => ({ trait, rating: 3 })));
    setAffectiveDomain(AFFECTIVE_TRAITS.map(trait => ({ trait, rating: 3 })));
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    }
  };

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

  const fetchStudents = async () => {
    if (!selectedSession || !selectedClass) return;
    try {
      setLoading(true);
      const response = await api.get('/students');
      const classStudents = response.data.filter((s: Student) => s.classId.toString() === selectedClass.toString());
      setStudents(classStudents);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjectRegistrations = async () => {
    if (!selectedSession || !selectedStudent) return;
    try {
      setLoading(true);
      const response = await api.get('/subject-registrations/student-subjects', {
        params: { sessionId: selectedSession, studentId: selectedStudent, classId: selectedClass },
      });
      setSubjectRegistrations(response.data);

      // Initialize scores for all registered subjects
      const initialScores: Record<string, SubjectScore> = {};
      response.data.forEach((reg: SubjectRegistration) => {
        initialScores[reg.subjectId._id] = {
          subjectId: reg.subjectId._id,
          subjectName: reg.subjectId.name,
          ca1: 0,
          ca2: 0,
          exam: 0,
          total: 0,
          grade: 'F',
        };
      });
      setSubjectScores(initialScores);
    } catch (error) {
      console.error('Failed to fetch subject registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingResult = async () => {
    if (!selectedSession || !selectedStudent) return;
    try {
      const response = await api.get('/results/student', {
        params: { sessionId: selectedSession, studentId: selectedStudent, performanceType },
      });
      if (response.data) {
        // Load existing data
        const existingScores: Record<string, SubjectScore> = {};
        response.data.subjectScores.forEach((score: SubjectScore) => {
          existingScores[score.subjectId] = score;
        });
        setSubjectScores(existingScores);
        setPsychomotorSkills(response.data.psychomotorSkills || []);
        setAffectiveDomain(response.data.affectiveDomain || []);
        setTeacherComment(response.data.teacherComment || '');
        setHeadOfSchoolComment(response.data.headOfSchoolComment || '');
      }
    } catch (error) {
      // No existing result is fine
    }
  };

  const handleScoreChange = (subjectId: string, field: 'ca1' | 'ca2' | 'exam', value: number) => {
    const registration = subjectRegistrations.find(r => r.subjectId._id === subjectId);
    if (!registration) return;

    const updatedScores = { ...subjectScores };
    const score = { ...updatedScores[subjectId] };
    score[field] = Math.max(0, Math.min(100, value));
    score.total = calculateTotal(score.ca1, score.ca2, score.exam, registration.subjectId);
    score.grade = calculateGrade(score.total);
    updatedScores[subjectId] = score;
    setSubjectScores(updatedScores);
  };

  const handlePsychomotorChange = (index: number, rating: number) => {
    setPsychomotorSkills(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], rating };
      return updated;
    });
  };

  const handleAffectiveChange = (index: number, rating: number) => {
    setAffectiveDomain(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], rating };
      return updated;
    });
  };

  const handleSave = async () => {
    if (!selectedSession || !selectedStudent) {
      alert('Please select a session and student');
      return;
    }

    try {
      setLoading(true);
      const scoresArray = Object.values(subjectScores);
      await api.post('/results/save', {
        sessionId: selectedSession,
        studentId: selectedStudent,
        subjectScores: scoresArray,
        psychomotorSkills: performanceType === 'term' ? psychomotorSkills : [],
        affectiveDomain: performanceType === 'term' ? affectiveDomain : [],
        teacherComment,
        headOfSchoolComment: currentUser?.role === 'admin' ? headOfSchoolComment : undefined,
        performanceType,
      });
      alert('Result saved successfully');
      await fetchExistingResult();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save result');
    } finally {
      setLoading(false);
    }
  };

  // Filter subjects based on teacher assignment
  const visibleRegistrations = subjectRegistrations.filter(reg => {
    if (currentUser?.role === 'admin') return true;
    if (currentUser?.role === 'teacher') {
      return reg.assignedTeacherId?._id === currentUser._id;
    }
    return false;
  });

  const selectedStudentData = students.find(s => s._id === selectedStudent);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Result Entry</h1>
        <p className="text-gray-600">Enter student scores, ratings, and comments</p>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
              {classes.map((c) => {
                const classLevelName = typeof c.classLevelId === 'object' ? c.classLevelId.name : 'Unknown';
                return (
                  <option key={c._id} value={c._id}>
                    {classLevelName} - {c.arm}
                  </option>
                );
              })}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Performance Type</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={performanceType}
              onChange={(e) => setPerformanceType(e.target.value as 'mid-term' | 'term')}
              disabled={!selectedStudent}
            >
              <option value="term">Full Term</option>
              <option value="mid-term">Mid-Term</option>
            </select>
          </div>
        </div>
      </div>

      {selectedStudentData && visibleRegistrations.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <div className="flex items-center mb-4">
              {selectedStudentData.photo && (
                <img
                  src={selectedStudentData.photo}
                  alt={selectedStudentData.fullName}
                  className="w-16 h-16 rounded-full mr-4 object-cover"
                />
              )}
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedStudentData.fullName}</h2>
                <p className="text-sm text-gray-500">Admission No: {selectedStudentData.admissionNo}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Subject Scores {performanceType === 'mid-term' && '(CA Only)'}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CA1</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CA2</th>
                    {performanceType === 'term' && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {visibleRegistrations.map((reg) => {
                    const score = subjectScores[reg.subjectId._id] || {
                      ca1: 0, ca2: 0, exam: 0, total: 0, grade: 'F',
                    };
                    return (
                      <tr key={reg.subjectId._id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {reg.subjectId.name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="w-20 px-2 py-1 border border-gray-300 rounded"
                            value={score.ca1}
                            onChange={(e) => handleScoreChange(reg.subjectId._id, 'ca1', parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="w-20 px-2 py-1 border border-gray-300 rounded"
                            value={score.ca2}
                            onChange={(e) => handleScoreChange(reg.subjectId._id, 'ca2', parseInt(e.target.value) || 0)}
                          />
                        </td>
                        {performanceType === 'term' && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="w-20 px-2 py-1 border border-gray-300 rounded"
                              value={score.exam}
                              onChange={(e) => handleScoreChange(reg.subjectId._id, 'exam', parseInt(e.target.value) || 0)}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {score.total}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {performanceType === 'term' && (
            <>
              <div className="bg-white rounded-lg shadow mb-6 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Psychomotor Skills</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {psychomotorSkills.map((item, index) => (
                    <div key={item.trait}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{item.trait}</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={item.rating}
                        onChange={(e) => handlePsychomotorChange(index, parseInt(e.target.value))}
                      >
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <option key={rating} value={rating}>{rating}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow mb-6 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Affective Domain</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {affectiveDomain.map((item, index) => (
                    <div key={item.trait}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{item.trait}</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={item.rating}
                        onChange={(e) => handleAffectiveChange(index, parseInt(e.target.value))}
                      >
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <option key={rating} value={rating}>{rating}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Teacher's Comment</h2>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
              placeholder="Enter teacher's comment..."
              value={teacherComment}
              onChange={(e) => setTeacherComment(e.target.value)}
            />
          </div>

          {currentUser?.role === 'admin' && (
            <div className="bg-white rounded-lg shadow mb-6 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Head of School's Comment</h2>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                placeholder="Enter head of school's comment..."
                value={headOfSchoolComment}
                onChange={(e) => setHeadOfSchoolComment(e.target.value)}
              />
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-6">
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : 'Save Result'}
            </button>
          </div>
        </>
      )}

      {selectedStudentData && visibleRegistrations.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">No subjects registered for this student yet.</p>
        </div>
      )}
    </div>
  );
};

export default ResultEntry;
