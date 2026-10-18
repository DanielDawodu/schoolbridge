import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Student {
  _id: string;
  fullName: string;
  admissionNo: string;
}

interface ClassGroup {
  _id: string;
  name: string;
  arm: string;
}

interface AttendanceRecord {
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'unmarked';
}

interface Attendance {
  _id: string;
  classId: string;
  date: string;
  records: AttendanceRecord[];
}

const Attendance: React.FC = () => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [history, setHistory] = useState<Attendance[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents();
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass && selectedDate) {
      fetchAttendance();
    }
  }, [selectedDate]); // Only refetch when date changes, not when class changes

  const fetchClasses = async () => {
    try {
      const response = await api.get('/classes');
      setClasses(response.data);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await api.get(`/students?classId=${selectedClass}`);
      setStudents(response.data);
      
      // Initialize records if not already set - default to unmarked
      if (records.length === 0) {
        setRecords(
          response.data.map((student: Student) => ({
            studentId: student._id,
            status: 'unmarked' as const,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/attendance/class/${selectedClass}?date=${selectedDate}`);
      if (response.data.length > 0) {
        // Merge existing marked records with unmarked default for other students
        const existingRecords = response.data[0].records;
        const mergedRecords = students.map((student) => {
          const existing = existingRecords.find((r: AttendanceRecord) => r.studentId === student._id);
          return existing || { studentId: student._id, status: 'unmarked' as const };
        });
        setRecords(mergedRecords);
      } else {
        // Only initialize if students are loaded and records is empty - default to unmarked
        if (students.length > 0 && records.length === 0) {
          setRecords(
            students.map((student) => ({
              studentId: student._id,
              status: 'unmarked' as const,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    console.log('handleStatusChange called:', { studentId, status, currentRecords: records });
    
    // Update local state immediately for responsive UI
    const updatedRecords = records.map((record) =>
      record.studentId === studentId ? { ...record, status } : record
    );
    console.log('Updated records:', updatedRecords);
    setRecords(updatedRecords);

    // Save automatically to server (only save records with explicit status)
    try {
      setSavingStudentId(studentId);
      // Filter out unmarked students before saving
      const recordsToSave = updatedRecords.filter(r => r.status !== 'unmarked');
      await api.post('/attendance', {
        classId: selectedClass,
        date: selectedDate,
        records: recordsToSave,
      });
      console.log('Auto-save successful');
      // No alert needed - silent save
    } catch (error: any) {
      console.error('Failed to save attendance:', error);
      // Revert the change on error
      setRecords((prev) =>
        prev.map((record) => (record.studentId === studentId ? { ...record, status: 'unmarked' } : record))
      );
      alert(error.response?.data?.error || 'Failed to save attendance');
    } finally {
      setSavingStudentId(null);
    }
  };

  const handleSaveAttendance = async () => {
    try {
      setLoading(true);
      // Filter out unmarked students before saving
      const recordsToSave = records.filter(r => r.status !== 'unmarked');
      await api.post('/attendance', {
        classId: selectedClass,
        date: selectedDate,
        records: recordsToSave,
      });
      // Silent save - no alert needed since auto-save is happening
    } catch (error: any) {
      console.error('Failed to save attendance:', error);
      alert(error.response?.data?.error || 'Failed to save attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchHistory = async () => {
    if (!startDate || !endDate) {
      alert('Please select start and end dates');
      return;
    }

    try {
      setLoading(true);
      const response = await api.get(
        `/attendance/class/${selectedClass}?startDate=${startDate}&endDate=${endDate}`
      );
      setHistory(response.data);
      setShowHistory(true);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-indigo-600 hover:text-indigo-700"
        >
          {showHistory ? 'Mark Attendance' : 'View History'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Select a class...</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.name} - {cls.arm}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {!showHistory && (
            <div className="flex items-end">
              <button
                onClick={handleSaveAttendance}
                disabled={loading || !selectedClass || !selectedDate}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
          )}
        </div>

        {showHistory && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleFetchHistory}
                disabled={loading}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Fetch History'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showHistory ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Attendance History</h2>
          {history.length === 0 ? (
            <p className="text-gray-500">No attendance records found for the selected date range.</p>
          ) : (
            <div className="space-y-4">
              {history.map((record) => (
                <div key={record._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium text-gray-900">
                      {new Date(record.date).toLocaleDateString()}
                    </span>
                    <div className="flex space-x-4 text-sm">
                      <span className="text-green-600">
                        Present: {record.records.filter((r: AttendanceRecord) => r.status === 'present').length}
                      </span>
                      <span className="text-red-600">
                        Absent: {record.records.filter((r: AttendanceRecord) => r.status === 'absent').length}
                      </span>
                      <span className="text-yellow-600">
                        Late: {record.records.filter((r: AttendanceRecord) => r.status === 'late').length}
                      </span>
                      <span className="text-gray-400">
                        Unmarked: {record.records.filter((r: AttendanceRecord) => r.status === 'unmarked').length}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Mark Attendance</h2>
            <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
              ✓ Auto-save enabled
            </span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : !selectedClass ? (
            <p className="text-gray-500">Please select a class to mark attendance.</p>
          ) : students.length === 0 ? (
            <p className="text-gray-500">No students found in this class.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Admission No.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => {
                    const record = records.find((r) => r.studentId === student._id);
                    console.log(`Rendering student ${student.fullName}, record:`, record);
                    return (
                      <tr key={student._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.fullName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.admissionNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleStatusChange(student._id, 'present')}
                              disabled={savingStudentId === student._id}
                              className={`px-4 py-2 rounded-md font-semibold border-2 ${
                                record?.status === 'present'
                                  ? 'bg-green-600 text-white border-green-700 shadow-md'
                                  : 'bg-white text-gray-600 border-gray-300 hover:bg-green-50 hover:border-green-300'
                              } ${savingStudentId === student._id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {savingStudentId === student._id ? '...' : '✓ Present'}
                            </button>
                            <button
                              onClick={() => handleStatusChange(student._id, 'absent')}
                              disabled={savingStudentId === student._id}
                              className={`px-4 py-2 rounded-md font-semibold border-2 ${
                                record?.status === 'absent'
                                  ? 'bg-red-600 text-white border-red-700 shadow-md'
                                  : 'bg-white text-gray-600 border-gray-300 hover:bg-red-50 hover:border-red-300'
                              } ${savingStudentId === student._id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {savingStudentId === student._id ? '...' : '✗ Absent'}
                            </button>
                            <button
                              onClick={() => handleStatusChange(student._id, 'late')}
                              disabled={savingStudentId === student._id}
                              className={`px-4 py-2 rounded-md font-semibold border-2 ${
                                record?.status === 'late'
                                  ? 'bg-yellow-500 text-white border-yellow-600 shadow-md'
                                  : 'bg-white text-gray-600 border-gray-300 hover:bg-yellow-50 hover:border-yellow-300'
                              } ${savingStudentId === student._id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {savingStudentId === student._id ? '...' : '⏱ Late'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Attendance;
