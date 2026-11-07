import React, { useState, useMemo } from 'react';
import { BookOpen, Search, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

export interface ClassItem {
  _id: string;
  name?: string;
  className?: string;
  level?: string;
  classLevelId?: { _id: string; name: string } | string;
  arm: string;
  assignedTeachers?: string[];
  studentCount?: number;
  billingStatus?: 'billed' | 'partial' | 'not_billed';
  totalAmountDue?: number;
  totalPaid?: number;
  totalOutstanding?: number;
  [key: string]: any;
}

interface ClassSelectionGridProps {
  classes: ClassItem[];
  loading: boolean;
  error?: string | null;
  onSelectClass: (cls: ClassItem) => void;
  onRetry?: () => void;
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
  actionText?: string;
  headerAction?: React.ReactNode;
  renderExtraBadge?: (cls: ClassItem) => React.ReactNode;
  renderProgressOrMeta?: (cls: ClassItem) => React.ReactNode;
  emptyMessage?: string;
}

export const ClassSelectionGrid: React.FC<ClassSelectionGridProps> = ({
  classes,
  loading,
  error,
  onSelectClass,
  onRetry,
  searchPlaceholder = 'Search classes or teachers...',
  actionText = 'Open class',
  headerAction,
  renderExtraBadge,
  renderProgressOrMeta,
  emptyMessage = 'No classes found matching your search.',
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClasses = useMemo(() => {
    if (!searchTerm.trim()) return classes;
    const term = searchTerm.toLowerCase();

    return classes.filter((cls) => {
      const levelName =
        typeof cls.classLevelId === 'object' && cls.classLevelId
          ? cls.classLevelId.name
          : cls.className || cls.name || '';
      const arm = cls.arm || '';
      const full = `${levelName} ${arm}`.toLowerCase();
      const teachers = (cls.assignedTeachers || []).join(' ').toLowerCase();

      return full.includes(term) || teachers.includes(term);
    });
  }, [classes, searchTerm]);

  return (
    <div className="space-y-5">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          />
        </div>

        <div className="flex items-center gap-3">
          {headerAction}
          {!loading && !error && (
            <span className="text-xs text-gray-500 font-medium">
              Showing {filteredClasses.length} class{filteredClasses.length === 1 ? '' : 'es'}
            </span>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-5 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-rose-500 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-rose-900">Failed to load classes</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry Loading
            </button>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="p-16 text-center text-gray-500 bg-white rounded-xl border border-gray-200 shadow-xs">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
          <p className="text-sm font-medium text-gray-700">Loading school classes...</p>
          <p className="text-xs text-gray-400 mt-1">Please wait while class data is retrieved</p>
        </div>
      ) : !error && filteredClasses.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500 shadow-xs">
          <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-base font-semibold text-gray-800">
            {classes.length === 0 ? 'No classes found' : 'No matching classes found'}
          </p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {classes.length === 0
              ? 'No classes have been registered for your school or you have not been assigned to any classes yet.'
              : emptyMessage}
          </p>
          {onRetry && classes.length === 0 && (
            <button
              onClick={onRetry}
              className="mt-4 inline-flex items-center px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Check Again
            </button>
          )}
        </div>
      ) : (
        /* Grid of class cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map((cls) => {
            const levelName =
              typeof cls.classLevelId === 'object' && cls.classLevelId
                ? cls.classLevelId.name
                : cls.className || cls.name || 'Class';
            const arm = cls.arm || '';
            const studentCount = cls.studentCount ?? 0;
            const teachers = cls.assignedTeachers && cls.assignedTeachers.length > 0
              ? cls.assignedTeachers.join(', ')
              : 'Unassigned';

            return (
              <div
                key={cls._id}
                onClick={() => onSelectClass(cls)}
                className="bg-white rounded-xl border border-gray-200 shadow-xs hover:shadow-md hover:border-indigo-400 p-5 cursor-pointer transition-all flex flex-col justify-between group hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      {arm || levelName.charAt(0) || 'C'}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {renderExtraBadge && renderExtraBadge(cls)}
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {studentCount} {studentCount === 1 ? 'Student' : 'Students'}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mt-3 group-hover:text-indigo-600 transition-colors">
                    {levelName} - {arm}
                  </h3>

                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                    Teacher(s):{' '}
                    <span className="text-gray-700 font-medium">{teachers}</span>
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100">
                  {renderProgressOrMeta && (
                    <div className="mb-3">{renderProgressOrMeta(cls)}</div>
                  )}

                  <div className="flex items-center justify-between text-xs text-indigo-600 font-semibold group-hover:text-indigo-700">
                    <span>{actionText}</span>
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClassSelectionGrid;

