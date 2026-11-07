import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface DocumentHeaderProps {
  title: string;
  subtitle?: string;
  documentNumber?: string;
  documentNumberLabel?: string;
  date?: string;
  dateLabel?: string;
  sessionTerm?: string;
  schoolOverride?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    logoUrl?: string;
    motto?: string;
  };
}

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({
  title,
  subtitle,
  documentNumber,
  documentNumberLabel = 'Doc No',
  date,
  dateLabel = 'Date',
  sessionTerm,
  schoolOverride,
}) => {
  const { school: authSchool } = useAuth();
  const school = schoolOverride || authSchool;

  const schoolName = school?.name || 'Ijebu-Ode Comprehensive College';
  const schoolAddress = school?.address || '';
  const schoolPhone = (school as any)?.phone || '';
  const schoolEmail = (school as any)?.email || '';
  const schoolWebsite = (school as any)?.website || '';
  const schoolLogo = (school as any)?.logoUrl || (school as any)?.logo;
  const schoolMotto = (school as any)?.motto || '';

  return (
    <div className="w-full pb-4 mb-5 border-b-2 border-gray-900 text-gray-900">
      {/* Top School Brand Bar */}
      <div className="flex items-center justify-between gap-4">
        {/* School Logo */}
        <div className="flex-shrink-0">
          {schoolLogo ? (
            <img
              src={schoolLogo}
              alt={schoolName}
              className="h-16 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-gray-900 text-white flex items-center justify-center font-black text-xl tracking-wider">
              {schoolName.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* School Particulars */}
        <div className="flex-1 text-center px-2">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-gray-900 leading-tight">
            {schoolName}
          </h1>

          {schoolMotto && (
            <p className="text-[11px] italic font-medium text-gray-600 mt-0.5">
              "{schoolMotto}"
            </p>
          )}

          {schoolAddress && (
            <p className="text-xs text-gray-700 mt-0.5 leading-snug">
              {schoolAddress}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] text-gray-600 mt-1">
            {schoolPhone && (
              <span>
                <strong>Tel:</strong> {schoolPhone}
              </span>
            )}
            {schoolEmail && (
              <span>
                <strong>Email:</strong> {schoolEmail}
              </span>
            )}
            {schoolWebsite && (
              <span>
                <strong>Web:</strong> {schoolWebsite}
              </span>
            )}
          </div>
        </div>

        {/* Right Balance Box (for visual symmetry) */}
        <div className="hidden sm:block flex-shrink-0 w-16 text-right">
          {sessionTerm && (
            <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
              {sessionTerm}
            </div>
          )}
        </div>
      </div>

      {/* Document Title Banner */}
      <div className="mt-3 text-center">
        <div className="inline-block px-5 py-1 bg-gray-900 text-white font-black text-xs uppercase tracking-widest rounded-md shadow-2xs">
          {title}
        </div>
        {subtitle && (
          <p className="text-xs font-semibold text-gray-600 mt-1 uppercase tracking-wide">
            {subtitle}
          </p>
        )}
      </div>

      {/* Optional Top Meta Strip (Doc Number & Date) */}
      {(documentNumber || date || sessionTerm) && (
        <div className="flex flex-wrap items-center justify-between text-xs mt-3 pt-2.5 border-t border-gray-200 text-gray-700 font-medium">
          {documentNumber && (
            <div>
              <span className="text-gray-500 uppercase">{documentNumberLabel}: </span>
              <span className="font-mono font-bold text-gray-900">{documentNumber}</span>
            </div>
          )}
          {sessionTerm && (
            <div className="sm:hidden">
              <span className="text-gray-500 uppercase">Term: </span>
              <span className="font-bold text-gray-900">{sessionTerm}</span>
            </div>
          )}
          {date && (
            <div className="ml-auto text-right">
              <span className="text-gray-500 uppercase">{dateLabel}: </span>
              <span className="font-bold text-gray-900">{date}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentHeader;

