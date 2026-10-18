import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import AdminOnlyRoute from './components/AdminOnlyRoute';
import AccountantOrAdminRoute from './components/AccountantOrAdminRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Classes from './pages/Classes';
import Staff from './pages/Staff';
import Settings from './pages/Settings';
import Migration from './pages/Migration';
import Attendance from './pages/Attendance';
import Fees from './pages/Fees';
import Promotion from './pages/Promotion';
import Subjects from './pages/Subjects';
import SubjectRegistration from './pages/SubjectRegistration';
import ResultEntry from './pages/ResultEntry';
import ReportCard from './pages/ReportCard';
import HalfTermReport from './pages/HalfTermReport';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Layout>{children}</Layout>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/students"
            element={
              <ProtectedRoute>
                <Students />
              </ProtectedRoute>
            }
          />
          <Route
            path="/classes"
            element={
              <ProtectedRoute>
                <Classes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <Staff />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <Settings />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/migration"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <Migration />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/promotion"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <Promotion />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subjects"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <Subjects />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subject-registration"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <SubjectRegistration />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/result-entry"
            element={
              <ProtectedRoute>
                <ResultEntry />
              </ProtectedRoute>
            }
          />
          <Route
            path="/report-cards"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <ReportCard />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/half-term-report"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <HalfTermReport />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <Attendance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/fees"
            element={
              <ProtectedRoute>
                <AccountantOrAdminRoute>
                  <Fees />
                </AccountantOrAdminRoute>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
