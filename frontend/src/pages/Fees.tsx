import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import {
  CreditCard,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  FileText,
  Printer,
  ArrowLeft,
  Search,
  DollarSign,
  TrendingUp,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import ClassSelectionGrid, { type ClassItem } from '../components/ClassSelectionGrid';
import { amountToWords } from '../utils/numberToWords';

interface ChargeItem {
  id: string;
  name: string;
  amount: number | '';
  note?: string;
  isTuition?: boolean;
}

interface StudentInvoice {
  _id: string;
  invoiceNumber: string;
  studentId: string;
  fullName: string;
  admissionNo: string;
  gender?: string;
  currentTermCharges: number;
  previousTermCarryover: number;
  amountDue: number;
  amountPaid: number;
  remainingBalance: number;
  status: 'unpaid' | 'partial' | 'paid';
  dueDate?: string;
  lineItems?: Array<{ name: string; amount: number; isTuition?: boolean; isCarryover?: boolean }>;
}

interface ReceiptData {
  _id: string;
  receiptNumber: string;
  verificationCode: string;
  paidAt: string;
  amountPaid: number;
  amountInWords: string;
  paymentMethod: string;
  referenceNumber?: string;
  previousBalance: number;
  remainingBalance: number;
  status: 'valid' | 'voided' | 'reversed';
  note?: string;
  student: {
    _id: string;
    fullName: string;
    admissionNo: string;
  };
  className: string;
  termName: string;
  school: {
    name: string;
    address: string;
    signatureUrl?: string;
  };
  cashier: string;
}

export const Fees: React.FC = () => {
  // Navigation / Workflow view
  // 'classes' -> class list
  // 'class_fees' -> class payment management (financial summary, student table, payment reports)
  // 'generate_bill_class_select' -> select class to bill
  // 'generate_bill_form' -> bill creation form
  const [view, setView] = useState<'classes' | 'class_fees' | 'generate_bill_class_select' | 'generate_bill_form'>('classes');

  // Active configuration (strictly centralized from Settings)
  const [hasActiveTerm, setHasActiveTerm] = useState<boolean>(true);
  const [activeTermInfo, setActiveTermInfo] = useState<any>(null);

  // Class list data
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Class Fee-Management data
  const [classInvoices, setClassInvoices] = useState<StudentInvoice[]>([]);
  const [fullyPaidStudents, setFullyPaidStudents] = useState<any[]>([]);
  const [debtorsList, setDebtorsList] = useState<any[]>([]);
  const [classSummary, setClassSummary] = useState<{
    totalExpected: number;
    totalCollected: number;
    totalOutstanding: number;
  }>({ totalExpected: 0, totalCollected: 0, totalOutstanding: 0 });

  // Bill Generation data & form
  const [tuitionAmount, setTuitionAmount] = useState<number | ''>(30000);
  const [tuitionNote, setTuitionNote] = useState<string>('Standard Term Tuition');
  const [additionalCharges, setAdditionalCharges] = useState<ChargeItem[]>([
    { id: '1', name: 'School Lessons', amount: 5000, note: 'Compulsory Term Extra Lessons' },
    { id: '2', name: 'Examination Fee', amount: 3000, note: 'End of Term Assessment' },
  ]);
  const [billDueDate, setBillDueDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [carryoverPreview, setCarryoverPreview] = useState<{
    totalCarryover: number;
    studentsWithCarryover: number;
    alreadyBilled: boolean;
    existingCount: number;
    students: any[];
  }>({ totalCarryover: 0, studentsWithCarryover: 0, alreadyBilled: false, existingCount: 0, students: [] });

  // Modals & Popups
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentTargetInvoice, setPaymentTargetInvoice] = useState<StudentInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'pos' | 'cheque' | 'other'>('bank_transfer');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [recordingPayment, setRecordingPayment] = useState<boolean>(false);

  // Printable Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptData | null>(null);

  // Printable Bill Modal
  const [showPrintBillModal, setShowPrintBillModal] = useState<boolean>(false);
  const [billToPrint, setBillToPrint] = useState<{
    invoice: any;
    school: any;
    classInfo: any;
    totalPaid?: number;
    remainingBalance?: number;
  } | null>(null);

  // Confirmation dialog for bill generation
  const [showConfirmBillModal, setShowConfirmBillModal] = useState<boolean>(false);
  const [generatingBill, setGeneratingBill] = useState<boolean>(false);
  const [overwriteBill, setOverwriteBill] = useState<boolean>(false);

  // Dashboard Stats Toggle
  const [showDashboardStats, setShowDashboardStats] = useState<boolean>(false);
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load active academic period and class summaries on mount
  useEffect(() => {
    initFees();
  }, []);

  const initFees = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // Verify active period
      const periodRes = await api.get('/schools/active-period');
      if (!periodRes.data || !periodRes.data.hasActivePeriod) {
        setHasActiveTerm(false);
        setLoading(false);
        return;
      }
      setHasActiveTerm(true);
      setActiveTermInfo(periodRes.data);

      await Promise.all([loadClassesSummary(), loadFeesDashboard()]);
    } catch (err: any) {
      console.error('Failed to initialize fees:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to initialize Fees module.');
    } finally {
      setLoading(false);
    }
  };

  const loadClassesSummary = async () => {
    try {
      const res = await api.get('/fees/classes-summary');
      setClasses(res.data?.classes || []);
    } catch (err: any) {
      console.error('Failed to load class billing summary:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to load class summaries.');
    }
  };

  const loadFeesDashboard = async () => {
    try {
      const res = await api.get('/fees/dashboard');
      setDashboardStats(res.data);
    } catch (err) {
      console.error('Failed to load fees dashboard stats:', err);
    }
  };

  // Open class fee management view
  const handleOpenClassFees = async (cls: ClassItem) => {
    setSelectedClass(cls);
    setView('class_fees');
    setStudentSearch('');
    setStudentStatusFilter('all');
    setSuccessMessage(null);
    setErrorMessage(null);

    await Promise.all([loadClassInvoices(cls._id), loadClassReports(cls._id)]);
  };

  const loadClassInvoices = async (classId: string) => {
    try {
      setLoading(true);
      const res = await api.get('/fees/class-invoices', { params: { classId } });
      const invoices: StudentInvoice[] = res.data?.invoices || [];
      setClassInvoices(invoices);

      // Compute actual class financial summary
      let totalExpected = 0;
      let totalCollected = 0;
      let totalOutstanding = 0;

      invoices.forEach((inv) => {
        totalExpected += inv.amountDue;
        totalCollected += inv.amountPaid;
        totalOutstanding += inv.remainingBalance;
      });

      setClassSummary({ totalExpected, totalCollected, totalOutstanding });
    } catch (err: any) {
      console.error('Failed to load class invoices:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to load class invoices.');
    } finally {
      setLoading(false);
    }
  };

  const loadClassReports = async (classId: string) => {
    try {
      const res = await api.get('/fees/class-reports', { params: { classId } });
      setFullyPaidStudents(res.data?.fullyPaidStudents || []);
      setDebtorsList(res.data?.debtorsList || []);
    } catch (err) {
      console.error('Failed to load class payment reports:', err);
    }
  };

  // =========================================================================
  // RECORD PAYMENT WORKFLOW
  // =========================================================================
  const handleOpenRecordPayment = (inv: StudentInvoice) => {
    setPaymentTargetInvoice(inv);
    setPaymentAmount(inv.remainingBalance > 0 ? inv.remainingBalance : '');
    setPaymentMethod('bank_transfer');
    setPaymentRef('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNote('');
    setShowPaymentModal(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetInvoice) return;

    const numAmount = Number(paymentAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    try {
      setRecordingPayment(true);
      const payload = {
        invoiceId: paymentTargetInvoice._id,
        amountPaid: numAmount,
        paymentMethod,
        referenceNumber: paymentRef.trim() || undefined,
        paidAt: paymentDate,
        note: paymentNote.trim() || undefined,
      };

      const res = await api.post('/fees/payments', payload);

      setShowPaymentModal(false);
      setSuccessMessage(
        `Payment of ₦${numAmount.toLocaleString()} recorded successfully! Official Receipt: ${res.data?.receipt?.receiptNumber}`
      );
      setTimeout(() => setSuccessMessage(null), 6000);

      // Show receipt for printing
      if (res.data?.receipt) {
        setCurrentReceipt(res.data.receipt);
        setShowReceiptModal(true);
      }

      // Refresh class invoices and reports
      if (selectedClass) {
        await Promise.all([
          loadClassInvoices(selectedClass._id),
          loadClassReports(selectedClass._id),
          loadClassesSummary(),
          loadFeesDashboard(),
        ]);
      }
    } catch (err: any) {
      console.error('Record payment error:', err);
      alert(err.response?.data?.error || 'Failed to record payment.');
    } finally {
      setRecordingPayment(false);
    }
  };

  // View / Print Bill for a student
  const handlePrintStudentBill = async (invoiceId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/fees/invoice-detail/${invoiceId}`);
      setBillToPrint(res.data);
      setShowPrintBillModal(true);
    } catch (err: any) {
      console.error('Failed to load bill detail:', err);
      alert(err.response?.data?.error || 'Failed to load bill detail for printing.');
    } finally {
      setLoading(false);
    }
  };

  // Reprint Receipt for a student's last payment or specific payment
  const handleReprintReceipt = async (invoiceId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/fees/invoices/${invoiceId}/payments`);
      const payments = res.data?.payments || [];
      if (payments.length === 0) {
        alert('No payments have been recorded for this student invoice yet.');
        return;
      }
      // Get the latest payment
      const latestPayment = payments[payments.length - 1];
      const receiptRes = await api.get(`/fees/receipts/${latestPayment._id}`);
      setCurrentReceipt(receiptRes.data?.receipt);
      setShowReceiptModal(true);
    } catch (err: any) {
      console.error('Failed to load receipt:', err);
      alert(err.response?.data?.error || 'Failed to retrieve receipt.');
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // GENERATE BILL WORKFLOW
  // =========================================================================
  const handleStartGenerateBill = () => {
    setView('generate_bill_class_select');
  };

  const handleSelectClassToBill = async (cls: ClassItem) => {
    setSelectedClass(cls);
    setView('generate_bill_form');
    setOverwriteBill(false);

    try {
      setLoading(true);
      const previewRes = await api.get('/fees/class-preview', {
        params: { classId: cls._id },
      });

      const pData = previewRes.data;
      setCarryoverPreview({
        totalCarryover: pData.totalCarryoverAcrossClass || 0,
        studentsWithCarryover: pData.studentsWithCarryoverCount || 0,
        alreadyBilled: Boolean(pData.alreadyBilled),
        existingCount: pData.existingInvoiceCount || 0,
        students: pData.students || [],
      });
    } catch (err: any) {
      console.error('Failed to load billing preview:', err);
      alert(err.response?.data?.error || 'Failed to load class billing preview.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChargeRow = () => {
    setAdditionalCharges((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', amount: '', note: '' },
    ]);
  };

  const handleRemoveChargeRow = (id: string) => {
    setAdditionalCharges((prev) => prev.filter((c) => c.id !== id));
  };

  const handleUpdateChargeRow = (id: string, field: 'name' | 'amount' | 'note', val: any) => {
    setAdditionalCharges((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return { ...c, [field]: val };
        }
        return c;
      })
    );
  };

  const currentTermBaseTotal = useMemo(() => {
    const t = Number(tuitionAmount) || 0;
    const add = additionalCharges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    return t + add;
  }, [tuitionAmount, additionalCharges]);

  const handleConfirmGenerateBill = async () => {
    if (!selectedClass) return;

    try {
      setGeneratingBill(true);
      const formattedCharges = additionalCharges
        .filter((c) => c.name.trim() && Number(c.amount) > 0)
        .map((c) => ({
          name: c.name.trim(),
          amount: Number(c.amount),
          note: c.note?.trim() || undefined,
        }));

      const payload = {
        classId: selectedClass._id,
        tuition: Number(tuitionAmount) || 0,
        additionalCharges: formattedCharges,
        dueDate: billDueDate,
        overwrite: overwriteBill,
      };

      const res = await api.post('/fees/generate-class-bill', payload);

      setShowConfirmBillModal(false);
      setSuccessMessage(
        `Class bill generated successfully! ${res.data?.invoicesCount} student invoices created.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);

      // Open class fee management
      await handleOpenClassFees(selectedClass);
    } catch (err: any) {
      console.error('Generate bill error:', err);
      alert(err.response?.data?.error || 'Failed to generate class bill.');
    } finally {
      setGeneratingBill(false);
    }
  };

  // Filtered students in student payment table
  const filteredInvoices = useMemo(() => {
    return classInvoices.filter((inv) => {
      const matchSearch =
        inv.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
        inv.admissionNo.toLowerCase().includes(studentSearch.toLowerCase());

      if (studentStatusFilter === 'paid') return matchSearch && inv.status === 'paid';
      if (studentStatusFilter === 'partial') return matchSearch && inv.status === 'partial';
      if (studentStatusFilter === 'unpaid') return matchSearch && inv.status === 'unpaid';
      return matchSearch;
    });
  }, [classInvoices, studentSearch, studentStatusFilter]);

  // If central active period is not configured, show blocker alert
  if (!loading && !hasActiveTerm) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg shadow-sm">
          <div className="flex items-start">
            <ShieldAlert className="h-7 w-7 text-amber-500 mr-4 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-bold text-amber-900">Active Academic Session & Term Required</h2>
              <p className="mt-2 text-sm text-amber-800 leading-relaxed">
                Fees management and bill generation require an active academic session and current term to be configured centrally in Settings.
                Currently, no active term is configured for your school.
              </p>
              <div className="mt-4">
                <a
                  href="/settings"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md shadow-xs text-white bg-amber-600 hover:bg-amber-700"
                >
                  Go to Settings to Configure Active Term →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fees Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            {view === 'classes' && 'Select a class to manage student billing, payments, receipts, and debtor reports.'}
            {view === 'class_fees' && selectedClass && (
              <>
                Class: <strong className="text-indigo-600">{selectedClass.name}</strong> • Record payments and view financial ledger
              </>
            )}
            {view === 'generate_bill_class_select' && 'Select a class to configure tuition, fees, and automated carryover.'}
            {view === 'generate_bill_form' && selectedClass && (
              <>
                Generating bill for <strong className="text-indigo-600">{selectedClass.name}</strong>
              </>
            )}
          </p>
        </div>

        {/* Central Active Period Badge & Top Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {activeTermInfo && (
            <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Active Period: {activeTermInfo.name}</span>
            </div>
          )}

          {view === 'classes' && (
            <>
              <button
                onClick={() => setShowDashboardStats(!showDashboardStats)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                {showDashboardStats ? 'Hide Summary' : 'Fees Dashboard'}
              </button>

              <button
                onClick={handleStartGenerateBill}
                className="inline-flex items-center px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Generate Bill
              </button>
            </>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex items-center shadow-xs">
          <CheckCircle className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg flex items-center shadow-xs">
          <AlertCircle className="h-5 w-5 text-rose-500 mr-3 flex-shrink-0" />
          <span className="text-sm font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Fees Dashboard Collapsible Stats */}
      {showDashboardStats && dashboardStats && view === 'classes' && (
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-700/60 pb-3">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider">
                Active Period Financial Summary ({dashboardStats.termName})
              </h2>
            </div>
            <span className="text-xs text-indigo-200 font-mono">
              {dashboardStats.totalBillsGenerated} Bills Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-xs">
              <span className="text-xs text-indigo-200 uppercase font-semibold">Total Expected</span>
              <p className="text-2xl font-black mt-1">₦{dashboardStats.totalExpected.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-xs">
              <span className="text-xs text-emerald-300 uppercase font-semibold">Total Collected</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                ₦{dashboardStats.totalCollected.toLocaleString()}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-xs">
              <span className="text-xs text-rose-300 uppercase font-semibold">Total Outstanding</span>
              <p className="text-2xl font-black text-rose-400 mt-1">
                ₦{dashboardStats.totalOutstanding.toLocaleString()}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-xs">
              <span className="text-xs text-amber-300 uppercase font-semibold">Prior Carryover</span>
              <p className="text-2xl font-black text-amber-400 mt-1">
                ₦{dashboardStats.totalCarryover.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: CLASS SELECTION (REUSABLE GRID) */}
      {/* ========================================================================= */}
      {view === 'classes' && (
        <ClassSelectionGrid
          classes={classes}
          loading={loading}
          error={errorMessage}
          onSelectClass={handleOpenClassFees}
          onRetry={initFees}
          actionText="Open class fee ledger"
          renderExtraBadge={(cls) => {
            const status = cls.billingStatus;
            if (status === 'billed') {
              return (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Billed
                </span>
              );
            }
            if (status === 'partial') {
              return (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Partially Billed
                </span>
              );
            }
            return (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                Not Billed
              </span>
            );
          }}
          renderProgressOrMeta={(cls) => {
            const billed = cls.totalAmountDue ?? 0;
            const collected = cls.totalPaid ?? 0;
            const percent = billed > 0 ? Math.round((collected / billed) * 100) : 0;
            return (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Collection</span>
                  <span className="font-semibold text-indigo-600">
                    ₦{collected.toLocaleString()} / ₦{billed.toLocaleString()} ({percent}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, percent)}%` }}
                  ></div>
                </div>
              </div>
            );
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: CLASS FEE-MANAGEMENT PAGE */}
      {/* ========================================================================= */}
      {view === 'class_fees' && selectedClass && (
        <div className="space-y-6">
          {/* Back & Breadcrumb bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setView('classes');
                  setSelectedClass(null);
                }}
                className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-indigo-600 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to Classes
              </button>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500">
                Class: <strong className="text-gray-900">{selectedClass.name}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectClassToBill(selectedClass)}
                className="inline-flex items-center px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Revise / Create Class Bill
              </button>
            </div>
          </div>

          {/* FINANCIAL SUMMARY AT TOP: 3 PROMINENT FIGURES */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                1. Expected Amount
              </span>
              <p className="text-3xl font-black text-gray-900 mt-2 font-mono">
                ₦{classSummary.totalExpected.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total billed across active students in class</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                2. Amount Received
              </span>
              <p className="text-3xl font-black text-emerald-600 mt-2 font-mono">
                ₦{classSummary.totalCollected.toLocaleString()}
              </p>
              <p className="text-xs text-emerald-600 mt-1">Total payments successfully verified</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/20">
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                3. Outstanding Amount
              </span>
              <p className="text-3xl font-black text-rose-600 mt-2 font-mono">
                ₦{classSummary.totalOutstanding.toLocaleString()}
              </p>
              <p className="text-xs text-rose-600 mt-1">Total unpaid balances due</p>
            </div>
          </div>

          {/* Student Payment Table Header & Search Filter */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search student by name or admission number..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStudentStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border cursor-pointer ${
                  studentStatusFilter === 'all'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                All ({classInvoices.length})
              </button>
              <button
                onClick={() => setStudentStatusFilter('paid')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border cursor-pointer ${
                  studentStatusFilter === 'paid'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Fully Paid ({fullyPaidStudents.length})
              </button>
              <button
                onClick={() => setStudentStatusFilter('partial')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border cursor-pointer ${
                  studentStatusFilter === 'partial'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Part Payment
              </button>
              <button
                onClick={() => setStudentStatusFilter('unpaid')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border cursor-pointer ${
                  studentStatusFilter === 'unpaid'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Unpaid
              </button>
            </div>
          </div>

          {/* Student Payment Table */}
          {classInvoices.length === 0 ? (
            <div className="bg-white border rounded-xl p-12 text-center text-gray-500 shadow-xs">
              <CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="font-bold text-gray-800 text-base">No bills generated for this class yet</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                No active invoices exist for students in this class. Click "Create Class Bill" to set tuition and charges.
              </p>
              <button
                onClick={() => handleSelectClassToBill(selectedClass)}
                className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Generate Class Bill Now
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left">Student Name</th>
                      <th className="px-5 py-3 text-left">Admission No</th>
                      <th className="px-5 py-3 text-right">Total Bill</th>
                      <th className="px-5 py-3 text-right">Amount Paid</th>
                      <th className="px-5 py-3 text-right">Outstanding</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv._id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-900">{inv.fullName}</span>
                          {inv.previousTermCarryover > 0 && (
                            <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded ml-2">
                              Carryover: ₦{inv.previousTermCarryover.toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono text-gray-600">
                          {inv.admissionNo}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm font-bold font-mono text-gray-900">
                          ₦{inv.amountDue.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm font-bold font-mono text-emerald-600">
                          ₦{inv.amountPaid.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm font-black font-mono text-rose-600">
                          ₦{inv.remainingBalance.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-center">
                          {inv.status === 'paid' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" /> Fully Paid
                            </span>
                          ) : inv.status === 'partial' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3 mr-1 text-amber-600" /> Part Payment
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                              Unpaid
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right text-xs">
                          <div className="flex items-center justify-end space-x-2">
                            {/* Record Payment Button */}
                            <button
                              onClick={() => handleOpenRecordPayment(inv)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer"
                            >
                              Record Payment
                            </button>

                            {/* View / Print Bill */}
                            <button
                              onClick={() => handlePrintStudentBill(inv._id)}
                              className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                              title="Print School Bill"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            {/* Print Receipt if paid */}
                            {inv.amountPaid > 0 && (
                              <button
                                onClick={() => handleReprintReceipt(inv._id)}
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Reprint Official Receipt"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 7: PAYMENT REPORTS BELOW TABLE */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            {/* A. FULLY PAID STUDENTS */}
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-gray-900">Fully Paid Students</h3>
                </div>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Print List
                </button>
              </div>

              {fullyPaidStudents.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center italic">
                  No students in this class have fully settled their term fees yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Student</th>
                        <th className="px-3 py-2 text-left">Admission No</th>
                        <th className="px-3 py-2 text-right">Amount Paid</th>
                        <th className="px-3 py-2 text-right">Settled Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {fullyPaidStudents.map((s, idx) => (
                        <tr key={idx} className="hover:bg-emerald-50/30">
                          <td className="px-3 py-2 font-bold text-gray-900">{s.fullName}</td>
                          <td className="px-3 py-2 font-mono text-gray-600">{s.admissionNo}</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700 font-mono">
                            ₦{s.totalAmountPaid.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500">
                            {new Date(s.dateFullySettled).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* B. OUTSTANDING PAYMENTS / DEBTORS LIST */}
            <div className="bg-white rounded-2xl border border-rose-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  <h3 className="text-base font-bold text-gray-900">Outstanding Payments / Debtors List</h3>
                </div>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Print Debtors
                </button>
              </div>

              {debtorsList.length === 0 ? (
                <p className="text-xs text-emerald-600 py-6 text-center font-bold">
                  All students in this class have completely settled their payments!
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Student</th>
                        <th className="px-3 py-2 text-left">Admission No</th>
                        <th className="px-3 py-2 text-right">Outstanding</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {debtorsList.map((d, idx) => (
                        <tr key={idx} className="hover:bg-rose-50/30">
                          <td className="px-3 py-2 font-bold text-gray-900">{d.fullName}</td>
                          <td className="px-3 py-2 font-mono text-gray-600">{d.admissionNo}</td>
                          <td className="px-3 py-2 text-right font-black text-rose-700 font-mono">
                            ₦{d.outstandingAmount.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                d.paymentStatus === 'Part Payment'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {d.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: SELECT CLASS TO BILL */}
      {/* ========================================================================= */}
      {view === 'generate_bill_class_select' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setView('classes')}
                className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-indigo-600 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Fees
              </button>
              <span className="text-gray-300">|</span>
              <span className="text-xs font-bold text-gray-800">
                Step 1: Select Class to Generate Bill
              </span>
            </div>
          </div>

          <ClassSelectionGrid
            classes={classes}
            loading={loading}
            error={errorMessage}
            onSelectClass={handleSelectClassToBill}
            onRetry={initFees}
            actionText="Configure Bill for Class"
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: CLASS BILLING FORM */}
      {/* ========================================================================= */}
      {view === 'generate_bill_form' && selectedClass && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <button
              onClick={() => setView('generate_bill_class_select')}
              className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-indigo-600 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Change Class
            </button>
            <span className="text-xs font-bold text-gray-800">
              Billing Class: <span className="text-indigo-600">{selectedClass.name}</span>
            </span>
          </div>

          {/* Already Billed Warning */}
          {carryoverPreview.alreadyBilled && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg text-amber-900 text-xs">
              <p className="font-bold">A Bill has already been generated for this class.</p>
              <p className="mt-0.5">
                {carryoverPreview.existingCount} student invoices exist for the active term. Generating a new bill will revise and overwrite existing bill charges safely.
              </p>
            </div>
          )}

          {/* Automated Carryover Summary Card */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Automated Previous Term Carryover
              </span>
              <p className="text-2xl font-black text-amber-950 mt-1 font-mono">
                ₦{carryoverPreview.totalCarryover.toLocaleString()}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {carryoverPreview.studentsWithCarryover} student(s) in this class have genuine unpaid balances from prior terms.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-amber-200/60 text-amber-900 rounded-lg">
              Auto-Applied Per Student
            </span>
          </div>

          {/* Billing Form Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
              Define Current-Term Charges
            </h2>

            {/* Tuition (Default First Item) */}
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                  Tuition (Default Primary Charge) *
                </span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                  Tuition
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 font-medium mb-1">
                    Tuition Amount (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="30000"
                    value={tuitionAmount}
                    onChange={(e) =>
                      setTuitionAmount(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full text-base font-bold font-mono border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 font-medium mb-1">
                    Description / Note
                  </label>
                  <input
                    type="text"
                    value={tuitionNote}
                    onChange={(e) => setTuitionNote(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Additional Charge Rows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Additional School Charges / Levies
                </h3>
                <button
                  type="button"
                  onClick={handleAddChargeRow}
                  className="inline-flex items-center px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Charge
                </button>
              </div>

              {additionalCharges.map((charge) => (
                <div
                  key={charge.id}
                  className="p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] text-gray-500 font-medium mb-1">
                      Charge Description *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Development Levy"
                      value={charge.name}
                      onChange={(e) => handleUpdateChargeRow(charge.id, 'name', e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] text-gray-500 font-medium mb-1">
                      Amount (₦) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="5000"
                      value={charge.amount}
                      onChange={(e) =>
                        handleUpdateChargeRow(
                          charge.id,
                          'amount',
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      className="w-full text-xs font-bold font-mono border border-gray-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] text-gray-500 font-medium mb-1">
                      Optional Note
                    </label>
                    <input
                      type="text"
                      placeholder="Optional note"
                      value={charge.note}
                      onChange={(e) => handleUpdateChargeRow(charge.id, 'note', e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-1 text-right sm:text-center pt-2 sm:pt-4">
                    <button
                      type="button"
                      onClick={() => handleRemoveChargeRow(charge.id)}
                      className="text-gray-400 hover:text-rose-600 cursor-pointer p-1"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Payment Due Date
              </label>
              <input
                type="date"
                value={billDueDate}
                onChange={(e) => setBillDueDate(e.target.value)}
                className="w-full sm:max-w-xs text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Live Bill Summary */}
            <div className="bg-gray-900 text-white p-6 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-400 uppercase font-bold tracking-wider">
                <span>Standard Current-Term Total Per Student</span>
                <span>Carryover Added Individually</span>
              </div>
              <p className="text-3xl font-black font-mono text-emerald-400">
                ₦{currentTermBaseTotal.toLocaleString()}
              </p>
              <p className="text-xs text-gray-300 italic">
                {amountToWords(currentTermBaseTotal)} (plus prior term carryovers where applicable)
              </p>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setView('classes')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (carryoverPreview.alreadyBilled) {
                    setOverwriteBill(true);
                  }
                  setShowConfirmBillModal(true);
                }}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                Generate Bill for All Students in Class →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECORD PAYMENT MODAL */}
      {/* ========================================================================= */}
      {showPaymentModal && paymentTargetInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Record Student Payment</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Generates an official verifiable payment receipt
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Student & Invoice Summary Strip */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Student:</span>
                <span className="font-bold text-gray-900">{paymentTargetInvoice.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Admission No:</span>
                <span className="font-mono text-gray-800">{paymentTargetInvoice.admissionNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Total Bill:</span>
                <span className="font-mono font-bold text-gray-900">
                  ₦{paymentTargetInvoice.amountDue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Previously Paid:</span>
                <span className="font-mono font-bold text-emerald-600">
                  ₦{paymentTargetInvoice.amountPaid.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5">
                <span className="text-rose-600 font-bold">Outstanding Balance:</span>
                <span className="font-mono font-black text-rose-600 text-sm">
                  ₦{paymentTargetInvoice.remainingBalance.toLocaleString()}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Amount Being Paid (₦) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full text-base font-black font-mono border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                  required
                />
                {typeof paymentAmount === 'number' && paymentAmount > 0 && (
                  <p className="text-[11px] text-indigo-700 mt-1 italic font-medium">
                    {amountToWords(paymentAmount)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e: any) => setPaymentMethod(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white font-medium focus:ring-indigo-500"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="pos">POS Terminal</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Bank Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Reference / Transaction Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. STANBIC-849129 or POS Ref"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full text-xs font-mono border border-gray-300 rounded-lg p-2.5 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Payment Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid by father via bank transfer"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {recordingPayment ? 'Recording Payment...' : 'Record Payment & Generate Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6: PRINTABLE OFFICIAL RECEIPT WITH QR CODE */}
      {/* ========================================================================= */}
      {showReceiptModal && currentReceipt && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8">
            {/* Top Toolbar (Hidden when printing) */}
            <div className="bg-gray-900 text-white px-6 py-3.5 flex items-center justify-between print:hidden">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-bold">Official Payment Receipt Generated</span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Receipt
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="text-gray-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* A4 Printable Receipt Content (Lagos State University Style Layout) */}
            <div className="p-8 sm:p-10 text-gray-900 bg-white" id="printable-receipt">
              {/* Header with School Branding */}
              <div className="border-b-2 border-gray-900 pb-4 mb-6 text-center">
                <h1 className="text-2xl font-black uppercase tracking-wider text-gray-900">
                  {currentReceipt.school?.name || 'Ijebu-Ode Comprehensive College'}
                </h1>
                {currentReceipt.school?.address && (
                  <p className="text-xs text-gray-600 mt-0.5">{currentReceipt.school.address}</p>
                )}
                <div className="inline-block mt-3 px-5 py-1 bg-gray-900 text-white font-black text-xs uppercase tracking-widest rounded-md">
                  Official Student Fee Payment Receipt
                </div>
              </div>

              {/* Receipt Number & Date Strip */}
              <div className="flex items-center justify-between text-xs border border-gray-300 p-3 rounded-lg bg-gray-50/60 mb-6">
                <div>
                  <span className="text-gray-500 font-semibold uppercase">Receipt No: </span>
                  <span className="font-mono font-black text-indigo-900 text-sm">
                    {currentReceipt.receiptNumber}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 font-semibold uppercase">Date: </span>
                  <span className="font-bold">
                    {new Date(currentReceipt.paidAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Student & Academic Particulars Table */}
              <div className="border border-gray-300 rounded-lg overflow-hidden mb-6">
                <table className="min-w-full divide-y divide-gray-300 text-xs">
                  <tbody>
                    <tr className="divide-x divide-gray-300">
                      <td className="w-1/3 px-4 py-2.5 bg-gray-100 font-bold uppercase text-gray-600">
                        Student Full Name
                      </td>
                      <td className="px-4 py-2.5 font-bold text-gray-900">
                        {currentReceipt.student.fullName}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-300">
                      <td className="px-4 py-2.5 bg-gray-100 font-bold uppercase text-gray-600">
                        Admission Number
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-gray-900">
                        {currentReceipt.student.admissionNo}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-300">
                      <td className="px-4 py-2.5 bg-gray-100 font-bold uppercase text-gray-600">
                        Class & Arm
                      </td>
                      <td className="px-4 py-2.5 font-bold text-gray-900">
                        {currentReceipt.className}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-300">
                      <td className="px-4 py-2.5 bg-gray-100 font-bold uppercase text-gray-600">
                        Academic Session & Term
                      </td>
                      <td className="px-4 py-2.5 font-bold text-gray-900">
                        {currentReceipt.termName}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-300">
                      <td className="px-4 py-2.5 bg-gray-100 font-bold uppercase text-gray-600">
                        Payment Method
                      </td>
                      <td className="px-4 py-2.5 font-bold text-gray-900">
                        {currentReceipt.paymentMethod.replace('_', ' ').toUpperCase()}{' '}
                        {currentReceipt.referenceNumber ? `(Ref: ${currentReceipt.referenceNumber})` : ''}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-300 bg-gray-50">
                      <td className="px-4 py-3 bg-gray-200 font-black uppercase text-gray-900">
                        Amount Paid
                      </td>
                      <td className="px-4 py-3 font-black text-xl text-gray-900 font-mono">
                        ₦{currentReceipt.amountPaid.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-300">
                      <td className="px-4 py-2.5 bg-gray-100 font-bold uppercase text-gray-600">
                        Amount in Words
                      </td>
                      <td className="px-4 py-2.5 font-bold text-gray-900 italic">
                        {currentReceipt.amountInWords}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-300">
                      <td className="px-4 py-2.5 bg-gray-100 font-bold uppercase text-gray-600">
                        Remaining Balance
                      </td>
                      <td className="px-4 py-2.5 font-black font-mono text-rose-700">
                        ₦{currentReceipt.remainingBalance.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* QR Verification & Signature Block */}
              <div className="grid grid-cols-2 gap-6 pt-6 border-t-2 border-gray-900 items-center">
                {/* QR Code Block */}
                <div className="flex items-center space-x-4">
                  <div className="p-2 border border-gray-300 rounded-lg bg-white shadow-xs">
                    <QRCodeSVG
                      value={`http://localhost:5173/verify-receipt/${currentReceipt.verificationCode}`}
                      size={92}
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-gray-800 uppercase block">
                      Scan to Verify
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono block mt-0.5">
                      Code: {currentReceipt.verificationCode}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold block mt-1">
                      Official Security Seal
                    </span>
                  </div>
                </div>

                {/* Cashier & Stamp Area */}
                <div className="text-right text-xs">
                  <div className="border-b border-gray-900 pb-1 mb-1 font-bold">
                    {currentReceipt.cashier || 'Authorized Cashier'}
                  </div>
                  <p className="text-[11px] font-bold text-gray-600 uppercase">
                    Authorized Cashier / Bursar
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Stamp & Signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 8: PRINTABLE SCHOOL FEE BILL MODAL */}
      {/* ========================================================================= */}
      {showPrintBillModal && billToPrint && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-8">
            <div className="bg-gray-900 text-white px-6 py-3.5 flex items-center justify-between print:hidden">
              <span className="text-sm font-bold">Official School Fee Invoice / Bill</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Bill
                </button>
                <button
                  onClick={() => setShowPrintBillModal(false)}
                  className="text-gray-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* A4 Printable Bill Content */}
            <div className="p-8 sm:p-12 text-gray-900 bg-white" id="printable-bill">
              {/* Header */}
              <div className="border-b-2 border-gray-900 pb-4 mb-6 text-center">
                <h1 className="text-2xl font-black uppercase tracking-wider text-gray-900">
                  {billToPrint.school?.name || 'Ijebu-Ode Comprehensive College'}
                </h1>
                {billToPrint.school?.address && (
                  <p className="text-xs text-gray-600 mt-0.5">{billToPrint.school.address}</p>
                )}
                <div className="inline-block mt-3 px-5 py-1 bg-gray-900 text-white font-black text-xs uppercase tracking-widest rounded-md">
                  Official School Fee Bill & Invoice
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-gray-300 p-4 rounded-lg bg-gray-50/50 mb-6">
                <div>
                  <span className="text-gray-500 font-semibold uppercase">Bill / Invoice #: </span>
                  <span className="font-mono font-black text-indigo-900">
                    {billToPrint.invoice?.invoiceNumber}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 font-semibold uppercase">Bill Date: </span>
                  <span className="font-bold">
                    {new Date(billToPrint.invoice?.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold uppercase">Student: </span>
                  <span className="font-bold text-gray-900">
                    {billToPrint.invoice?.studentId?.fullName} ({billToPrint.invoice?.studentId?.admissionNo})
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 font-semibold uppercase">Class: </span>
                  <span className="font-bold">
                    {billToPrint.classInfo?.name} - {billToPrint.classInfo?.arm}
                  </span>
                </div>
              </div>

              {/* Itemised Breakdown */}
              <div className="border border-gray-300 rounded-lg overflow-hidden mb-6">
                <table className="min-w-full divide-y divide-gray-300 text-xs">
                  <thead className="bg-gray-100 font-bold uppercase text-gray-700">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Description / Particulars</th>
                      <th className="px-4 py-2.5 text-right">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(billToPrint.invoice?.lineItems || []).map((item: any, idx: number) => (
                      <tr key={idx} className={item.isCarryover ? 'bg-amber-50/50' : ''}>
                        <td className="px-4 py-2.5 font-medium">
                          {item.name}
                          {item.isCarryover && (
                            <span className="text-[10px] text-amber-800 font-bold ml-2">
                              (Previous Term Carryover)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold">
                          ₦{item.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-900 text-white font-black text-sm">
                      <td className="px-4 py-3 uppercase">Total Amount Due</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400">
                        ₦{billToPrint.invoice?.amountDue.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bank Details & School Fee Policy */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/70 text-xs space-y-2 mb-8">
                <p className="font-bold text-gray-900 uppercase">Payment Instructions & Bank Account</p>
                <p className="text-gray-700">
                  Bank Name: <span className="font-bold">Stanbic IBTC Bank / Zenith Bank</span> • Account Name: <span className="font-bold">{billToPrint.school?.name}</span>
                </p>
                <p className="text-gray-700">
                  Account Number: <span className="font-mono font-bold text-indigo-900">0084920194</span>
                </p>
                <p className="text-gray-500 text-[11px] pt-1">
                  Please use the student's full name and admission number as the payment reference or deposit description.
                </p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-300 text-xs">
                <div>
                  <div className="border-b border-gray-900 pb-1 mb-1 font-semibold">
                    Authorized Bursar / Accounts Office
                  </div>
                  <p className="text-[10px] text-gray-500 uppercase">Stamp & Signature</p>
                </div>
                <div className="text-right">
                  <div className="border-b border-gray-900 pb-1 mb-1 font-semibold">
                    School Principal / Administrator
                  </div>
                  <p className="text-[10px] text-gray-500 uppercase">Approved For Issue</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Bill Generation */}
      {showConfirmBillModal && selectedClass && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Confirm Class Bill Generation</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              You are about to generate bills for all active students in <strong className="text-gray-900">{selectedClass.name}</strong>.
            </p>

            <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Base Term Total:</span>
                <span className="font-bold font-mono">₦{currentTermBaseTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Students with Carryover:</span>
                <span className="font-bold text-amber-700">{carryoverPreview.studentsWithCarryover}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Prior Carryover:</span>
                <span className="font-bold font-mono text-amber-800">
                  ₦{carryoverPreview.totalCarryover.toLocaleString()}
                </span>
              </div>
            </div>

            {carryoverPreview.alreadyBilled && (
              <label className="flex items-start space-x-2 text-xs text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                <input
                  type="checkbox"
                  checked={overwriteBill}
                  onChange={(e) => setOverwriteBill(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                />
                <span>I confirm that I wish to overwrite and revise the existing bills for this class.</span>
              </label>
            )}

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowConfirmBillModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmGenerateBill}
                disabled={generatingBill || (carryoverPreview.alreadyBilled && !overwriteBill)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {generatingBill ? 'Generating Bills...' : 'Confirm & Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fees;
