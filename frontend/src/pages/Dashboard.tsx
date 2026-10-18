import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface ClassWithPeriod {
  _id: string;
  classLevelId: string | { _id: string; name: string };
  arm: string;
  periodId: string | { _id: string };
  period?: {
    session?: {
      year: string;
    };
    term?: {
      name: string;
    };
  };
}

const Dashboard: React.FC = () => {
  const { school, user } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    attendanceSummary: null as any,
    feesSummary: null as any,
  });
  const [assignedClasses, setAssignedClasses] = useState<ClassWithPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []); // Only fetch on mount

  const fetchDashboardData = async () => {
    try {
      const [statsRes, classesRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/classes'),
      ]);
      setStats(statsRes.data);

      // Classes now come with classLevelId and periodId populated
      setAssignedClasses(classesRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Welcome back, {user?.role === 'teacher' ? user?.name : school?.name}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <span className="text-2xl">👨‍🎓</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {user?.role === 'teacher' ? 'My Students' : 'Total Students'}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalStudents}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <span className="text-2xl">🏫</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {user?.role === 'teacher' ? 'My Classes' : 'Total Classes'}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalClasses}</p>
                </div>
              </div>
            </div>
          </div>

          {user?.role === 'admin' && stats.attendanceSummary && (
            <div className="mt-6 bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Attendance</h2>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{stats.attendanceSummary.present}</p>
                  <p className="text-sm text-gray-500">Present</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600">{stats.attendanceSummary.absent}</p>
                  <p className="text-sm text-gray-500">Absent</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-600">{stats.attendanceSummary.late}</p>
                  <p className="text-sm text-gray-500">Late</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-400">{stats.attendanceSummary.unmarked || 0}</p>
                  <p className="text-sm text-gray-500">Unmarked</p>
                </div>
              </div>
              <p className="text-center text-sm text-gray-500 mt-2">
                Total marked: {stats.attendanceSummary.totalMarked}
              </p>
            </div>
          )}

          {user?.role === 'admin' && stats.feesSummary && (
            <div className="mt-6 bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">This Term's Fees</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    ₦{stats.feesSummary.totalExpected.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Expected</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">
                    ₦{stats.feesSummary.totalCollected.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Collected</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600">
                    ₦{stats.feesSummary.totalOutstanding.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Outstanding</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600">
                    ₦{stats.feesSummary.totalCredit?.toLocaleString() || 0}
                  </p>
                  <p className="text-sm text-gray-500">Credit</p>
                </div>
              </div>
            </div>
          )}

          {user?.role === 'teacher' && assignedClasses.length > 0 && (
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">My Assigned Classes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedClasses.map((cls) => {
                  const classLevelName = typeof cls.classLevelId === 'object' ? cls.classLevelId.name : 'Unknown';
                  return (
                    <div key={cls._id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <h3 className="font-medium text-gray-900">{classLevelName} - {cls.arm}</h3>
                      {cls.period && cls.period.session && cls.period.term && (
                        <p className="text-sm text-gray-600 mt-2">
                          {cls.period.session.year} · {cls.period.term.name}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">Click to view students</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {user?.role === 'admin' && (
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Getting Started</h2>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Create your first academic session in Settings</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Add classes to organize your students</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Register students and assign them to classes</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Create teacher accounts and assign them to classes</span>
                </li>
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
