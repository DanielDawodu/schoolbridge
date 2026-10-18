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
  position: number;
}

interface PsychomotorRating {
  trait: string;
  rating: number;
}

interface AffectiveRating {
  trait: string;
  rating: number;
}

const ReportCard: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [performanceType, setPerformanceType] = useState<'mid-term' | 'term'>('term');

  useEffect(() => {
    fetchSessions();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedSession && selectedClass) {
      fetchStudents();
    }
  }, [selectedSession, selectedClass]);

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
      const response = await api.get('/students');
      const classStudents = response.data.filter((s: any) => s.classId.toString() === selectedClass.toString());
      setStudents(classStudents);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    }
  };

  const generateReportCard = async () => {
    if (!selectedSession || !selectedStudent) {
      alert('Please select session and student');
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/report-cards', {
        params: { sessionId: selectedSession, studentId: selectedStudent, performanceType },
      });
      setReportData(response.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to generate report card');
    } finally {
      setLoading(false);
    }
  };

  const printReportCard = () => {
    if (!reportData) return;

    const { result, school, classInfo } = reportData;
    const student = result.studentId;
    const session = result.sessionId;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print report cards');
      return;
    }

    const subjectRows = result.subjectScores.map((score: SubjectScore) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${score.subjectName}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${score.ca1}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${score.ca2}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${score.exam}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${score.total}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${score.grade}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${score.position}</td>
      </tr>
    `).join('');

    // Add term comparison row if it's the final term
    let termComparisonRow = '';
    if (reportData.termComparison) {
      const tc = reportData.termComparison;
      termComparisonRow = `
        <tr style="background-color: #f9fafb; font-weight: bold;">
          <td style="padding: 8px; border: 1px solid #ddd;">TERM COMPARISON</td>
          <td style="padding: 8px; border: 1px solid #ddd;"></td>
          <td style="padding: 8px; border: 1px solid #ddd;"></td>
          <td style="padding: 8px; border: 1px solid #ddd;"></td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${tc.aggregate}%</td>
          <td style="padding: 8px; border: 1px solid #ddd;"></td>
          <td style="padding: 8px; border: 1px solid #ddd;"></td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;" colspan="7">
            <strong>1st Term:</strong> ${tc.firstTerm}% | 
            <strong>2nd Term:</strong> ${tc.secondTerm}% | 
            <strong>3rd Term:</strong> ${tc.thirdTerm}% | 
            <strong>Aggregate:</strong> ${tc.aggregate}%
          </td>
        </tr>
      `;
    }

    const psychomotorRows = result.psychomotorSkills.map((skill: PsychomotorRating) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${skill.trait}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${skill.rating}</td>
      </tr>
    `).join('');

    const affectiveRows = result.affectiveDomain.map((trait: AffectiveRating) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${trait.trait}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${trait.rating}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Report Card - ${student.fullName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #1f2937; }
          .header p { margin: 5px 0; color: #6b7280; }
          .student-info { display: flex; gap: 20px; margin-bottom: 20px; align-items: start; }
          .student-photo { width: 100px; height: 100px; object-fit: cover; border: 2px solid #ddd; border-radius: 8px; }
          .student-details { flex: 1; }
          .student-details table { width: 100%; border-collapse: collapse; }
          .student-details td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
          .student-details td:first-child { font-weight: bold; width: 150px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f3f4f6; padding: 10px; text-align: left; border: 1px solid #ddd; }
          td { padding: 8px; border: 1px solid #ddd; }
          .section-title { font-weight: bold; margin: 20px 0 10px 0; color: #1f2937; }
          .comments { margin-top: 20px; }
          .comment-box { border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; min-height: 60px; }
          .signature { margin-top: 40px; display: flex; justify-content: space-between; }
          .signature-section { text-align: center; }
          .signature-img { max-height: 60px; margin-bottom: 10px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${school.name}</h1>
          <p>${school.address}</p>
          <p><strong>REPORT CARD</strong></p>
        </div>

        <div class="student-info">
          <img 
            src="${student.photoUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%239ca3af%22%3E%3Cpath d=%22M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z%22/%3E%3C/svg%3E'}" 
            alt="Student Photo" 
            class="student-photo"
          />
          <div class="student-details">
            <table>
              <tr>
                <td>Student Name:</td>
                <td>${student.fullName}</td>
              </tr>
              <tr>
                <td>Admission No:</td>
                <td>${student.admissionNo}</td>
              </tr>
              <tr>
                <td>Class:</td>
                <td>${classInfo.name} - ${classInfo.arm}</td>
              </tr>
              <tr>
                <td>Session:</td>
                <td>${session.year} - ${session.currentTerm}</td>
              </tr>
              <tr>
                <td>Class Position:</td>
                <td>${result.classPosition} out of ${result.subjectScores.length}</td>
              </tr>
              <tr>
                <td>Class Average:</td>
                <td>${result.classAverage}%</td>
              </tr>
              <tr>
                <td>Student Average:</td>
                <td>${result.averageScore}%</td>
              </tr>
            </table>
          </div>
        </div>

        <div class="section-title">ACADEMIC PERFORMANCE</div>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>CA1</th>
              <th>CA2</th>
              <th>Exam</th>
              <th>Total</th>
              <th>Grade</th>
              <th>Position</th>
            </tr>
          </thead>
          <tbody>
            ${subjectRows}
            ${termComparisonRow}
          </tbody>
        </table>

        <div class="section-title">ATTENDANCE SUMMARY</div>
        <table>
          <tr>
            <td>Number of times school opened:</td>
            <td>${result.attendanceSummary.daysOpen}</td>
          </tr>
          <tr>
            <td>Number of times present:</td>
            <td>${result.attendanceSummary.daysPresent}</td>
          </tr>
          <tr>
            <td>Number of times absent:</td>
            <td>${result.attendanceSummary.daysAbsent}</td>
          </tr>
        </table>

        <div class="section-title">PSYCHOMOTOR SKILLS</div>
        <table>
          <thead>
            <tr>
              <th>Skill</th>
              <th>Rating (1-5)</th>
            </tr>
          </thead>
          <tbody>
            ${psychomotorRows}
          </tbody>
        </table>

        <div class="section-title">AFFECTIVE DOMAIN</div>
        <table>
          <thead>
            <tr>
              <th>Trait</th>
              <th>Rating (1-5)</th>
            </tr>
          </thead>
          <tbody>
            ${affectiveRows}
          </tbody>
        </table>

        <div class="comments">
          <div class="section-title">COMMENTS</div>
          <div class="comment-box">
            <strong>Teacher's Comment:</strong>
            <p>${result.teacherComment || 'No comment provided'}</p>
          </div>
          <div class="comment-box">
            <strong>Head of School's Comment:</strong>
            <p>${result.headOfSchoolComment || 'No comment provided'}</p>
          </div>
        </div>

        <div class="signature">
          <div class="signature-section">
            ${school.signatureUrl ? `<img src="${school.signatureUrl}" alt="Principal's Signature" class="signature-img" />` : ''}
            <p>_____________________</p>
            <p>Principal/Head of School</p>
          </div>
          <div class="signature-section">
            <p>_____________________</p>
            <p>Date: ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Report Cards</h1>
        <p className="text-gray-600">Generate and print student report cards</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={performanceType}
              onChange={(e) => setPerformanceType(e.target.value as 'mid-term' | 'term')}
              disabled={!selectedStudent}
            >
              <option value="term">Full Term Report Card</option>
              <option value="mid-term">Half Term Assessment</option>
            </select>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={generateReportCard}
            disabled={loading || !selectedSession || !selectedStudent}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <button
            onClick={printReportCard}
            disabled={!reportData}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400"
          >
            Print Report Card
          </button>
        </div>
      </div>

      {reportData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Preview</h2>
          <div className="space-y-4">
            <div>
              <strong>Student:</strong> {reportData.result.studentId.fullName}
            </div>
            <div>
              <strong>Class:</strong> {reportData.classInfo.name} - {reportData.classInfo.arm}
            </div>
            <div>
              <strong>Session:</strong> {reportData.result.sessionId.year} - {reportData.result.sessionId.currentTerm}
            </div>
            <div>
              <strong>Average Score:</strong> {reportData.result.averageScore}%
            </div>
            <div>
              <strong>Class Position:</strong> {reportData.result.classPosition}
            </div>
            <div>
              <strong>Released:</strong> {reportData.result.isReleased ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportCard;
