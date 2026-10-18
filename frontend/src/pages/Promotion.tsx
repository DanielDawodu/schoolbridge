import React, { useEffect, useState } from 'react';
import api from '../services/api';

interface ClassGroup {
  _id: string;
  name: string;
  arm: string;
}

interface Student {
  _id: string;
  fullName: string;
  admissionNo: string;
  classId: ClassGroup;
}

const Promotion: React.FC = () => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [sourceClassId, setSourceClassId] = useState<string>('');
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [candidates, setCandidates] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await api.get('/classes');
      setClasses(response.data);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    }
  };

  const fetchCandidates = async () => {
    if (!sourceClassId) return;

    try {
      setLoading(true);
      const response = await api.get(`/promotion/candidates/${sourceClassId}`);
      setCandidates(response.data);
      // Select all by default
      setSelectedStudentIds(new Set(response.data.map((s: Student) => s._id)));
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
      alert('Failed to fetch promotion candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleSourceClassChange = (value: string) => {
    setSourceClassId(value);
    setTargetClassId('');
    setCandidates([]);
    setSelectedStudentIds(new Set());
    setShowReview(false);
  };

  const handleStudentToggle = (studentId: string) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudentIds(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedStudentIds(new Set(candidates.map((s) => s._id)));
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  const handleProceedToReview = () => {
    if (selectedStudentIds.size === 0) {
      alert('Please select at least one student to promote');
      return;
    }
    if (!targetClassId) {
      alert('Please select a target class');
      return;
    }
    setShowReview(true);
  };

  const handlePromote = async () => {
    if (!confirm(`Are you sure you want to promote ${selectedStudentIds.size} students from ${classes.find((c) => c._id === sourceClassId)?.name} to ${classes.find((c) => c._id === targetClassId)?.name}?`)) {
      return;
    }

    try {
      setPromoting(true);
      await api.post('/promotion/promote', {
        sourceClassId,
        targetClassId,
        studentIds: Array.from(selectedStudentIds),
      });

      alert(`Successfully promoted ${selectedStudentIds.size} students`);
      setCandidates([]);
      setSelectedStudentIds(new Set());
      setSourceClassId('');
      setTargetClassId('');
      setShowReview(false);
    } catch (error: any) {
      console.error('Failed to promote students:', error);
      alert(error.response?.data?.error || 'Failed to promote students');
    } finally {
      setPromoting(false);
    }
  };

  const sourceClass = classes.find((c) => c._id === sourceClassId);
  const targetClass = classes.find((c) => c._id === targetClassId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Student Promotion</h1>
        <p className="text-gray-600">Promote students to their new class for the next term</p>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Select Classes</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Class (current class)
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              value={sourceClassId}
              onChange={(e) => handleSourceClassChange(e.target.value)}
            >
              <option value="">Select source class</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.name} - {cls.arm}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Class (new class)
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              disabled={!sourceClassId}
            >
              <option value="">Select target class</option>
              {classes
                .filter((c) => c._id !== sourceClassId)
                .map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.name} - {cls.arm}
                  </option>
                ))}
            </select>
          </div>

          {sourceClassId && (
            <button
              onClick={fetchCandidates}
              disabled={loading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : 'Load Students'}
            </button>
          )}
        </div>
      </div>

      {candidates.length > 0 && !showReview && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Students to Promote ({selectedStudentIds.size} selected)
            </h2>
            <div className="space-x-2">
              <button
                onClick={handleSelectAll}
                className="text-sm text-indigo-600 hover:text-indigo-900"
              >
                Select All
              </button>
              <button
                onClick={handleDeselectAll}
                className="text-sm text-indigo-600 hover:text-indigo-900"
              >
                Deselect All
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.size === candidates.length}
                      onChange={(e) => (e.target.checked ? handleSelectAll() : handleDeselectAll())}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Admission No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Current Class
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {candidates.map((student) => (
                  <tr key={student._id}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(student._id)}
                        onChange={() => handleStudentToggle(student._id)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.admissionNo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.fullName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.classId.name} - {student.classId.arm}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t">
            <button
              onClick={handleProceedToReview}
              disabled={selectedStudentIds.size === 0 || !targetClassId}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
            >
              Proceed to Review
            </button>
          </div>
        </div>
      )}

      {showReview && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Review Promotion</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-600">
                <strong>Source:</strong> {sourceClass?.name} - {sourceClass?.arm}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Target:</strong> {targetClass?.name} - {targetClass?.arm}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Students to promote:</strong> {selectedStudentIds.size}
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Historical attendance and fee records will remain tied to the
                original class. Only the student's current class assignment will change.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowReview(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handlePromote}
                disabled={promoting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {promoting ? 'Promoting...' : 'Confirm Promotion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Promotion;
