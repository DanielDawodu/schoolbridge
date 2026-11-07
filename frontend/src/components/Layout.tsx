import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  School,
  BookOpen,
  FileEdit,
  FileText,
  FileSpreadsheet,
  TrendingUp,
  Users,
  UserCheck,
  CalendarCheck,
  CreditCard,
  Receipt,
  ArrowRightLeft,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Palette,
  Award,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  roles?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'OVERVIEW',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'ACADEMICS',
    items: [
      { name: 'Classes', path: '/classes', icon: School },
      { name: 'Result Entry', path: '/result-entry', icon: FileEdit },
      { name: 'Report Cards', path: '/report-cards', icon: FileText, roles: ['admin'] },
      { name: 'Half Term Report', path: '/half-term-report', icon: FileSpreadsheet, roles: ['admin'] },
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      { name: 'Students', path: '/students', icon: Users },
      { name: 'Staff', path: '/staff', icon: UserCheck, roles: ['admin'] },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Attendance', path: '/attendance', icon: CalendarCheck },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { name: 'Fees', path: '/fees', icon: CreditCard, roles: ['admin', 'accountant'] },
      { name: 'Payment Vouchers', path: '/payment-vouchers', icon: Receipt, roles: ['admin', 'accountant'] },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { name: 'Subjects', path: '/subjects', icon: BookOpen, roles: ['admin'] },
      { name: 'Promotion', path: '/promotion', icon: TrendingUp, roles: ['admin'] },
      { name: 'School Branding', path: '/settings/branding', icon: Palette, roles: ['admin'] },
      { name: 'Grading System', path: '/settings/grading', icon: Award, roles: ['admin'] },
      { name: 'General Settings', path: '/settings', icon: Settings, roles: ['admin'] },
      { name: 'Migration', path: '/migration', icon: ArrowRightLeft, roles: ['admin'] },
    ],
  },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('schoolbridge_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const { user, school, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('schoolbridge_sidebar_collapsed', String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const isItemVisible = (item: NavItem): boolean => {
    if (!item.roles || item.roles.length === 0) return true;
    if (!user?.role) return false;
    return item.roles.includes(user.role);
  };

  const isItemActive = (path: string): boolean => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
          w-72 max-w-[85vw]
        `}
      >
        {/* Brand / Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center min-w-0 gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs flex-shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className={`min-w-0 ${isCollapsed ? 'lg:hidden' : 'block'}`}>
              <h1 className="text-base font-bold text-gray-900 tracking-tight leading-tight truncate">
                SchoolBridge
              </h1>
              <p className="text-[11px] text-gray-500 font-medium truncate">
                Administration
              </p>
            </div>
          </div>

          {/* Desktop collapse toggle */}
          <button
            onClick={toggleCollapsed}
            className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-hidden"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-hidden"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* School Name Card (expanded only) */}
        {!isCollapsed && school?.name && (
          <div className="px-4 pt-3 pb-1 flex-shrink-0 hidden lg:block">
            <div className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
              <p className="text-xs font-semibold text-gray-800 truncate" title={school.name}>
                {school.name}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                Active School
              </p>
            </div>
          </div>
        )}

        {/* Mobile school name card */}
        {school?.name && (
          <div className="px-4 pt-3 pb-1 flex-shrink-0 lg:hidden">
            <div className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
              <p className="text-xs font-semibold text-gray-800 truncate" title={school.name}>
                {school.name}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                Active School
              </p>
            </div>
          </div>
        )}

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(isItemVisible);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className="space-y-1">
                {/* Group label */}
                {isCollapsed ? (
                  <div
                    className="hidden lg:block my-2 mx-1 border-t border-gray-100"
                    title={group.label}
                  />
                ) : null}
                <div
                  className={`px-2.5 pb-1 ${
                    isCollapsed ? 'lg:hidden' : 'block'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {group.label}
                  </span>
                </div>

                {/* Items */}
                {visibleItems.map((item) => {
                  const active = isItemActive(item.path);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={isCollapsed ? item.name : undefined}
                      className={`group relative flex items-center py-2 px-2.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                        active
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      } ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}`}
                    >
                      <Icon
                        className={`w-5 h-5 flex-shrink-0 transition-colors ${
                          active
                            ? 'text-indigo-600'
                            : 'text-gray-400 group-hover:text-gray-600'
                        } ${isCollapsed ? 'lg:mr-0 mr-3' : 'mr-3'}`}
                        strokeWidth={1.8}
                      />
                      <span
                        className={`truncate ${
                          isCollapsed ? 'lg:hidden' : 'block'
                        }`}
                      >
                        {item.name}
                      </span>

                      {/* Subtle active pip in expanded mode */}
                      {active && !isCollapsed && (
                        <span className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      )}

                      {/* Tooltip on hover in collapsed desktop mode */}
                      {isCollapsed && (
                        <div className="hidden lg:group-hover:flex absolute left-full ml-2 px-2.5 py-1 bg-gray-900 text-white text-xs font-medium rounded-md shadow-lg whitespace-nowrap z-50 pointer-events-none items-center">
                          {item.name}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* User Profile & Logout Area */}
        <div className="border-t border-gray-200 p-3 bg-white flex-shrink-0">
          {/* Expanded mode profile */}
          <div className={`${isCollapsed ? 'lg:hidden' : 'block'}`}>
            <div className="flex items-center px-2 py-2 mb-2 rounded-lg bg-gray-50 border border-gray-100">
              <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 shadow-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="ml-2.5 min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800 truncate" title={user?.name}>
                  {user?.name || 'User'}
                </p>
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-100 text-indigo-700 capitalize">
                  {user?.role || 'Staff'}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-2.5 py-2 text-xs font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              title="Sign out of your account"
            >
              <LogOut className="w-4 h-4 mr-2" strokeWidth={1.8} />
              Sign out
            </button>
          </div>

          {/* Collapsed desktop mode profile */}
          {isCollapsed && (
            <div className="hidden lg:flex flex-col items-center gap-2">
              <div
                className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-xs shadow-xs"
                title={`${user?.name || 'User'} (${user?.role || 'Staff'})`}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content wrapper with independent scroll */}
      <div
        className={`flex-1 flex flex-col h-screen overflow-y-auto min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        {/* Mobile top header bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold text-gray-900 tracking-tight">
                SchoolBridge
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-xs shadow-xs"
              title={user?.name}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 w-full">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
