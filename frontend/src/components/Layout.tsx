import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, school, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊' },
    { name: 'Students', path: '/students', icon: '👨‍🎓' },
    { name: 'Classes', path: '/classes', icon: '🏫' },
    { name: 'Staff', path: '/staff', icon: '👨‍🏫', roles: ['admin'] },
    { name: 'Attendance', path: '/attendance', icon: '📋' },
    { name: 'Fees', path: '/fees', icon: '💰', roles: ['admin', 'accountant'] },
    { name: 'Promotion', path: '/promotion', icon: '📈', roles: ['admin'] },
    { name: 'Subjects', path: '/subjects', icon: '📚', roles: ['admin'] },
    { name: 'Result Entry', path: '/result-entry', icon: '📝' },
    { name: 'Report Cards', path: '/report-cards', icon: '📄', roles: ['admin'] },
    { name: 'Half Term Report', path: '/half-term-report', icon: '📑', roles: ['admin'] },
    { name: 'Migration', path: '/migration', icon: '📥', roles: ['admin'] },
    { name: 'Settings', path: '/settings', icon: '⚙️', roles: ['admin'] },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:fixed lg:inset-y-0 lg:left-0 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-bold text-gray-900">SchoolBridge</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            <div className="px-4 mb-4">
              <p className="text-sm font-medium text-gray-500">{school?.name}</p>
            </div>
            <nav className="space-y-1 px-2">
              {navItems.map((item) => {
                if (item.roles && (!user?.role || !item.roles.includes(user.role))) {
                  return null;
                }

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`${
                      location.pathname === item.path
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    } group flex items-center px-3 py-2 text-sm font-medium rounded-md`}
                  >
                    <span className="mr-3 text-lg">{item.icon}</span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="border-t p-4">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium">
                  {user?.name.charAt(0)}
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        {/* Mobile header */}
        <div className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700"
          >
            ☰
          </button>
          <h1 className="text-lg font-semibold text-gray-900">SchoolBridge</h1>
          <div className="w-6" />
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
