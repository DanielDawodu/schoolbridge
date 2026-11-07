import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Building,
  User,
  GraduationCap,
  Calendar,
  CreditCard,
  FileText,
  ArrowLeft,
} from 'lucide-react';

interface VerificationData {
  isValid: boolean;
  status: 'valid' | 'voided' | 'reversed';
  receiptNumber: string;
  verificationCode: string;
  paidAt: string;
  amountPaid: number;
  amountInWords: string;
  paymentMethod: string;
  referenceNumber?: string;
  student: {
    fullName: string;
    admissionNo: string;
  };
  className: string;
  termName: string;
  school: {
    name: string;
    address: string;
  };
  cashier: string;
  reversalReason?: string;
  reversedAt?: string;
  error?: string;
}

export const VerifyReceipt: React.FC = () => {
  const { verificationCode } = useParams<{ verificationCode: string }>();
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifyReceipt();
  }, [verificationCode]);

  const verifyReceipt = async () => {
    try {
      setLoading(true);
      setError(null);
      // Public route without Authorization headers
      const res = await axios.get(
        `http://localhost:5000/api/fees/public/verify-receipt/${verificationCode}`
      );
      setData(res.data);
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(
        err.response?.data?.error ||
          'Receipt verification failed. The provided verification code is invalid or does not match any official school record.'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'pos':
        return 'Point of Sale (POS)';
      case 'cash':
        return 'Cash Payment';
      case 'cheque':
        return 'Bank Cheque';
      default:
        return method || 'Cash';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-gray-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-md mb-3">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            SchoolBridge Official Verification
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Official Public Document & Receipt Authenticity Portal
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600 mb-3"></div>
            <p className="text-sm font-semibold text-gray-800">Verifying official receipt...</p>
            <p className="text-xs text-gray-400 mt-1">
              Checking cryptographic verification code with school records
            </p>
          </div>
        ) : error || !data || !data.isValid ? (
          <div className="bg-white rounded-2xl shadow-sm border border-rose-200 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 text-rose-600 mb-4">
              <XCircle className="w-9 h-9" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Invalid or Unverified Receipt</h2>
            <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
              {error ||
                'This receipt could not be verified against the school database. It may be altered, invalid, or expired.'}
            </p>
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 font-mono">Code: {verificationCode}</p>
              <div className="mt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Return to SchoolBridge Home
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
            {/* Status Banner */}
            {data.status === 'valid' ? (
              <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider">
                      Official Receipt Verified
                    </h2>
                    <p className="text-xs text-emerald-100">
                      Authentic record confirmed in school ledger
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-emerald-700/60 rounded-md">
                  AUTHENTIC
                </span>
              </div>
            ) : (
              <div className="bg-amber-600 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider">
                      Receipt Reversed / Voided
                    </h2>
                    <p className="text-xs text-amber-100">
                      This transaction was subsequently reversed
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-amber-700/60 rounded-md">
                  REVERSED
                </span>
              </div>
            )}

            {/* School & Receipt Header */}
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center text-gray-900 font-bold text-lg">
                    <Building className="w-5 h-5 text-indigo-600 mr-2 flex-shrink-0" />
                    <span>{data.school.name}</span>
                  </div>
                  {data.school.address && (
                    <p className="text-xs text-gray-500 mt-0.5 ml-7">{data.school.address}</p>
                  )}
                </div>

                <div className="sm:text-right">
                  <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
                    Receipt Number
                  </p>
                  <p className="text-base font-black text-indigo-700 font-mono mt-0.5">
                    {data.receiptNumber}
                  </p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    Verification: {data.verificationCode}
                  </p>
                </div>
              </div>
            </div>

            {/* Reversal Warning if applicable */}
            {data.status === 'reversed' && data.reversalReason && (
              <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs">
                <p className="font-bold">Reversal Notice:</p>
                <p className="mt-0.5">{data.reversalReason}</p>
                {data.reversedAt && (
                  <p className="text-amber-700 mt-1">
                    Reversed on: {new Date(data.reversedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Details Grid */}
            <div className="p-6 space-y-6">
              {/* Amount Highlight */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-5 text-center">
                <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                  Amount Paid
                </span>
                <p className="text-3xl font-black text-gray-900 mt-1">
                  ₦{data.amountPaid.toLocaleString()}
                </p>
                <p className="text-xs font-medium text-gray-600 mt-1 italic">
                  {data.amountInWords}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Student Info */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    <User className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                    Student Details
                  </div>
                  <p className="text-sm font-bold text-gray-900">{data.student.fullName}</p>
                  <p className="text-xs text-gray-600 font-mono mt-0.5">
                    Admission No: {data.student.admissionNo}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Class: <span className="font-semibold text-gray-800">{data.className}</span>
                  </p>
                </div>

                {/* Session & Term */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    <GraduationCap className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                    Academic Period
                  </div>
                  <p className="text-sm font-bold text-gray-900">{data.termName}</p>
                  <div className="flex items-center text-xs text-gray-600 mt-2">
                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                    <span>Payment Date: {new Date(data.paidAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    <CreditCard className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                    Transaction Info
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {formatPaymentMethod(data.paymentMethod)}
                  </p>
                  {data.referenceNumber && (
                    <p className="text-xs text-gray-600 font-mono mt-0.5">
                      Ref: {data.referenceNumber}
                    </p>
                  )}
                </div>

                {/* Cashier / Recorded By */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                    Authorized Cashier
                  </div>
                  <p className="text-sm font-bold text-gray-900">{data.cashier}</p>
                  <p className="text-xs text-emerald-700 font-medium mt-0.5">
                    Verified Digital Signature
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                This verification record was securely fetched in real-time from SchoolBridge Cloud.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyReceipt;

