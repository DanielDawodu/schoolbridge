import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import {
  Search,
  Plus,
  Trash2,
  Printer,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronRight,
  ShieldAlert,
  FileText,
  Building,
  RefreshCw,
  X,
} from 'lucide-react';

interface ClassSummary {
  _id: string;
  name: string;
  className: string;
  arm: string;
  assignedTeachers: string[];
  studentCount: number;
  billingStatus: 'not_billed' | 'partial' | 'billed';
  invoicesCount: number;
  totalAmountDue: number;
  totalPaid: number;
  totalOutstanding: number;
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
  dueDate: string;
  lineItems: Array<{ name: string; amount: number; isTuition?: boolean; isCarryover?: boolean }>;
  createdAt: string;
}

interface CarryoverPreviewStudent {
  studentId: string;
  fullName: string;
  admissionNo: string;
  gender?: string;
  previousTermCarryover: number;
  carryoverSources: Array<{ invoiceId: string; termName: string; amount: number }>;
}

interface ChargeLine {
  id: string;
  name: string;
  amount: number | '';
}

const COMMON_CHARGE_PRESETS = [
  'Examination Fee',
  'Development Levy',
  'ICT Fee',
  'Sports Fee',
  'Books and Educational Materials',
  'Transportation',
  'Uniform & Badges',
  'PTA Levy',
];

const Fees: React.FC = () => {
  // Navigation / Workflow steps
  const [activeTab, setActiveTab] = useState<'billing' | 'dashboard'>('billing');
  const [billingStep, setBillingStep] = useState<'classes' | 'create_bill' | 'invoices'>('classes');

  // Selected class & invoice
  const [selectedClass, setSelectedClass] = useState<ClassSummary | null>(null);
  const [classInvoices, setClassInvoices] = useState<StudentInvoice[]>([]);
  const [printingInvoice, setPrintingInvoice] = useState<any | null>(null);

  // Class summaries
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [activeTermInfo, setActiveTermInfo] = useState<any>(null);
  const [hasActiveTerm, setHasActiveTerm] = useState<boolean>(true);

  // Form states for creating class bill
  const [tuition, setTuition] = useState<number | ''>(50000);
  const [additionalCharges, setAdditionalCharges] = useState<ChargeLine[]>([
    { id: '1', name: 'Examination Fee', amount: 5000 },
    { id: '2', name: 'Development Levy', amount: 3000 },
  ]);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Carryover preview data
  const [carryoverStudents, setCarryoverStudents] = useState<CarryoverPreviewStudent[]>([]);
  const [totalCarryoverAcrossClass, setTotalCarryoverAcrossClass] = useState<number>(0);
  const [alreadyBilled, setAlreadyBilled] = useState<boolean>(false);
  const [existingInvoiceCount, setExistingInvoiceCount] = useState<number>(0);

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);

  // Payment recording modal
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentInvoice, setPaymentInvoice] = useState<StudentInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [recordingPayment, setRecordingPayment] = useState<boolean>(false);

  // Fees Dashboard stats
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [classSearch, setClassSearch] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      await Promise.all([loadClassSummaries(), loadFeesDashboard()]);
    } catch (err: any) {
      console.error('Failed to initialize fees:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to initialize Fees module.');
    } finally {
      setLoading(false);
    }
  };

  const loadClassSummaries = async () => {
    try {
      const res = await api.get('/fees/classes-summary');
      setClasses(res.data?.classes || []);
    } catch (err) {
      console.error('Failed to load class billing summary:', err);
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

  // Step 1: Select class -> Step 2: Open class billing
  const handleSelectClass = async (cls: ClassSummary) => {
    setSelectedClass(cls);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      setLoading(true);
      // Fetch carryover preview
      const previewRes = await api.get('/fees/class-preview', {
        params: { classId: cls._id },
      });

      const pData = previewRes.data;
      setCarryoverStudents(pData.students || []);
      setTotalCarryoverAcrossClass(pData.totalCarryoverAcrossClass || 0);
      setAlreadyBilled(Boolean(pData.alreadyBilled));
      setExistingInvoiceCount(pData.existingInvoiceCount || 0);

      // If already billed, load invoices and go to invoice view
      if (pData.alreadyBilled) {
        await loadClassInvoices(cls._id);
        setBillingStep('invoices');
      } else {
        setBillingStep('create_bill');
      }
    } catch (err: any) {
      console.error('Failed to load class preview:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to inspect class billing details.');
    } finally {
      setLoading(false);
    }
  };

  const loadClassInvoices = async (classId: string) => {
    try {
      const res = await api.get('/fees/class-invoices', {
        params: { classId },
      });
      setClassInvoices(res.data?.invoices || []);
    } catch (err) {
      console.error('Failed to load class invoices:', err);
    }
  };

  // Additional charges management
  const handleAddChargeLine = (presetName: string = '') => {
    setAdditionalCharges([
      ...additionalCharges,
      { id: Date.now().toString(), name: presetName, amount: 0 },
    ]);
  };

  const handleRemoveChargeLine = (id: string) => {
    setAdditionalCharges(additionalCharges.filter((c) => c.id !== id));
  };

  const handleChargeChange = (id: string, field: 'name' | 'amount', value: any) => {
    setAdditionalCharges(
      additionalCharges.map((c) => {
        if (c.id === id) {
          if (field === 'amount') {
            const num = value === '' ? '' : Math.max(0, parseFloat(value) || 0);
            return { ...c, amount: num };
          }
          return { ...c, [field]: value };
        }
        return c;
      })
    );
  };

  // Automatic calculation of current term charges
  const currentTermCharges = useMemo(() => {
    const t = typeof tuition === 'number' ? tuition : 0;
    const addtl = additionalCharges.reduce((sum, c) => sum + (typeof c.amount === 'number' ? c.amount : 0), 0);
    return t + addtl;
  }, [tuition, additionalCharges]);

  const totalClassExpectedAmount = useMemo(() => {
    const studentCount = carryoverStudents.length;
    return studentCount * currentTermCharges + totalCarryoverAcrossClass;
  }, [carryoverStudents, currentTermCharges, totalCarryoverAcrossClass]);

  // Execute class bill generation
  const handleConfirmGenerateBill = async (overwrite: boolean = false) => {
    if (!selectedClass) return;

    if (typeof tuition !== 'number' || tuition < 0) {
      alert('Please enter a valid tuition amount.');
      return;
    }

    try {
      setGenerating(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const payload = {
        classId: selectedClass._id,
        tuition,
        additionalCharges: additionalCharges.map((c) => ({
          name: c.name,
          amount: Number(c.amount) || 0,
        })),
        dueDate,
        overwrite,
      };

      const res = await api.post('/fees/generate-class-bill', payload);

      setSuccessMessage(res.data.message || 'Invoices successfully generated for the entire class!');
      setShowConfirmModal(false);

      // Load generated invoices and switch to invoice view
      await Promise.all([loadClassInvoices(selectedClass._id), loadClassSummaries(), loadFeesDashboard()]);
      setBillingStep('invoices');
    } catch (err: any) {
      console.error('Generate bill error:', err);
      if (err.response?.status === 409) {
        if (window.confirm('A bill already exists for this class in this term. Would you like to revise/overwrite the existing invoices?')) {
          handleConfirmGenerateBill(true);
          return;
        }
      }
      setErrorMessage(err.response?.data?.error || 'Failed to generate class bills.');
    } finally {
      setGenerating(false);
    }
  };

  // Record payment
  const handleOpenPaymentModal = (invoice: StudentInvoice) => {
    setPaymentInvoice(invoice);
    setPaymentAmount(invoice.remainingBalance);
    setPaymentNote('School fee payment');
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!paymentInvoice || typeof paymentAmount !== 'number' || paymentAmount <= 0) {
      alert('Please enter a valid positive payment amount.');
      return;
    }

    try {
      setRecordingPayment(true);
      await api.post('/fees/payments', {
        invoiceId: paymentInvoice._id,
        amountPaid: paymentAmount,
        note: paymentNote,
      });

      setShowPaymentModal(false);
      setSuccessMessage(`Payment of ₦${paymentAmount.toLocaleString()} recorded successfully!`);

      // Refresh invoices and dashboard
      if (selectedClass) {
        await loadClassInvoices(selectedClass._id);
        await loadClassSummaries();
      }
      await loadFeesDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to record payment.');
    } finally {
      setRecordingPayment(false);
    }
  };

  // Open printable bill
  const handleOpenPrintBill = async (invoiceId: string) => {
    try {
      const res = await api.get(`/fees/invoice-detail/${invoiceId}`);
      setPrintingInvoice(res.data);
    } catch (err) {
      alert('Failed to load invoice details for printing.');
    }
  };

  const filteredClassList = classes.filter((cls) => {
    const q = classSearch.toLowerCase();
    return cls.name.toLowerCase().includes(q) || cls.assignedTeachers.join(' ').toLowerCase().includes(q);
  });

  const filteredInvoices = classInvoices.filter((inv) => {
    const q = studentSearch.toLowerCase();
    return (
      inv.fullName.toLowerCase().includes(q) ||
      inv.admissionNo.toLowerCase().includes(q) ||
      inv.invoiceNumber.toLowerCase().includes(q)
    );
  });

  if (!loading && !hasActiveTerm) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg shadow-sm">
          <div className="flex items-start">
            <ShieldAlert className="h-7 w-7 text-amber-500 mr-4 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-bold text-amber-900">Active Academic Session Required</h2>
              <p className="mt-2 text-sm text-amber-800 leading-relaxed">
                Bill Generation requires an active academic session and term to be configured centrally in Settings.
                All fee invoices and payments must be associated with the school's active period.
              </p>
              <div className="mt-4">
                <a
                  href="/settings"
                  className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-md shadow-xs text-white bg-amber-600 hover:bg-amber-700"
                >
                  Go to Settings →
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fees & Class Billing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Automated class billing with carryover balance calculation and invoice printing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTermInfo && (
            <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>
                Active Period: {activeTermInfo.session?.year || 'Current'} · Term {activeTermInfo.session?.currentTerm || 'Term'}
              </span>
            </div>
          )}

          <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-gray-50">
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'billing' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Class Billing
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'dashboard' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Fees Dashboard
            </button>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex items-center print:hidden shadow-xs">
          <CheckCircle className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg flex items-center print:hidden shadow-xs">
          <AlertCircle className="h-5 w-5 text-rose-500 mr-3 flex-shrink-0" />
          <span className="text-sm font-medium">{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CLASS BILLING WORKFLOW */}
      {/* ========================================================================= */}
      {activeTab === 'billing' && (
        <>
          {/* STEP 1: SELECT CLASS */}
          {billingStep === 'classes' && (
            <div className="space-y-5 print:hidden">
              <div className="relative max-w-md">
                <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search class or assigned teacher..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {loading ? (
                <div className="p-12 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                  <p>Loading school classes & billing statuses...</p>
                </div>
              ) : filteredClassList.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-lg border border-gray-200 text-gray-500">
                  <Building className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="font-semibold text-gray-700">No classes found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredClassList.map((cls) => {
                    return (
                      <div
                        key={cls._id}
                        onClick={() => handleSelectClass(cls)}
                        className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group shadow-xs"
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                              {cls.arm || 'C'}
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              {cls.studentCount} Students
                            </span>
                          </div>

                          <h3 className="text-lg font-bold text-gray-900 mt-3 group-hover:text-indigo-600 transition-colors">
                            {cls.name}
                          </h3>

                          <p className="text-xs text-gray-500 mt-1">
                            Teacher:{' '}
                            <span className="text-gray-700 font-medium">
                              {cls.assignedTeachers?.length ? cls.assignedTeachers.join(', ') : 'Unassigned'}
                            </span>
                          </p>
                        </div>

                        <div className="mt-5 pt-4 border-t border-gray-100 space-y-2 text-xs">
                          <div className="flex justify-between items-center text-gray-600">
                            <span>Billing Status:</span>
                            {cls.billingStatus === 'billed' ? (
                              <span className="inline-flex items-center text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                                <CheckCircle className="h-3 w-3 mr-1 text-emerald-600" /> Billed ({cls.invoicesCount})
                              </span>
                            ) : cls.billingStatus === 'partial' ? (
                              <span className="inline-flex items-center text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                                <Clock className="h-3 w-3 mr-1 text-amber-600" /> Partial ({cls.invoicesCount}/{cls.studentCount})
                              </span>
                            ) : (
                              <span className="text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded">
                                Not Billed
                              </span>
                            )}
                          </div>

                          {cls.totalAmountDue > 0 && (
                            <div className="flex justify-between items-center text-gray-600">
                              <span>Total Expected:</span>
                              <strong className="text-gray-900 font-mono">₦{cls.totalAmountDue.toLocaleString()}</strong>
                            </div>
                          )}

                          <div className="pt-2 flex items-center justify-between text-indigo-600 font-semibold">
                            <span>{cls.billingStatus === 'billed' ? 'View Invoices' : 'Create Term Bill'}</span>
                            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CREATE / CONFIGURE CLASS BILL */}
          {billingStep === 'create_bill' && selectedClass && (
            <div className="space-y-6 print:hidden">
              <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
                <button
                  onClick={() => {
                    setBillingStep('classes');
                    setSelectedClass(null);
                  }}
                  className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-indigo-600"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Back to Classes
                </button>

                <span className="text-xs text-gray-500">
                  Creating Bill for Class: <strong className="text-gray-800">{selectedClass.name}</strong> ({carryoverStudents.length} Students)
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Inputs (Left 2 cols) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Default Charge: Tuition */}
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
                    <div className="border-b pb-3">
                      <h3 className="text-base font-bold text-gray-900">Default Charge: Tuition</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Tuition is automatically included for every student in this class.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                        Tuition Amount (₦)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={tuition}
                        onChange={(e) => setTuition(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value)))}
                        className="w-full p-2.5 text-base font-bold text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="50000"
                      />
                    </div>
                  </div>

                  {/* Additional Charges */}
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Additional Charges</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Add levies, exam fees, sports, ICT, or textbooks for the class.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddChargeLine()}
                        className="inline-flex items-center px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Charge Line
                      </button>
                    </div>

                    {/* Presets */}
                    <div>
                      <span className="text-xs text-gray-500 font-medium block mb-2">Quick Add Common Presets:</span>
                      <div className="flex flex-wrap gap-2">
                        {COMMON_CHARGE_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleAddChargeLine(preset)}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-xs font-medium cursor-pointer"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Charges list */}
                    {additionalCharges.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2">No additional charges added.</p>
                    ) : (
                      <div className="space-y-3">
                        {additionalCharges.map((c) => (
                          <div key={c.id} className="flex items-center gap-3">
                            <input
                              type="text"
                              value={c.name}
                              placeholder="Description / Service Name"
                              onChange={(e) => handleChargeChange(c.id, 'name', e.target.value)}
                              className="flex-1 p-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                            />
                            <div className="relative w-36">
                              <span className="absolute left-2.5 top-2 text-xs text-gray-400">₦</span>
                              <input
                                type="number"
                                min="0"
                                value={c.amount}
                                placeholder="0"
                                onChange={(e) => handleChargeChange(c.id, 'amount', e.target.value)}
                                className="w-full pl-6 pr-2 py-2 text-xs font-bold border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveChargeLine(c.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-md"
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-3 border-t">
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Due Date</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="p-2 text-xs border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  {/* Carryover Breakdown Accordion */}
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Automated Previous-Term Carryover
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Unpaid debts from previous terms are automatically rolled over without duplication.
                        </p>
                      </div>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
                        Total Carryover: ₦{totalCarryoverAcrossClass.toLocaleString()}
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Student</th>
                            <th className="px-3 py-2 text-left">Admission No</th>
                            <th className="px-3 py-2 text-right">Previous Unpaid Debt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {carryoverStudents.map((s) => (
                            <tr key={s.studentId} className={s.previousTermCarryover > 0 ? 'bg-amber-50/50' : ''}>
                              <td className="px-3 py-2 font-medium text-gray-900">{s.fullName}</td>
                              <td className="px-3 py-2 font-mono text-gray-500">{s.admissionNo}</td>
                              <td className={`px-3 py-2 text-right font-bold ${s.previousTermCarryover > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                                ₦{s.previousTermCarryover.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Summary Card (1 col) */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl space-y-5 sticky top-6">
                    <h3 className="text-base font-bold tracking-wide uppercase border-b border-indigo-700 pb-3">
                      Class Bill Summary
                    </h3>

                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-indigo-200">Class:</span>
                        <strong className="text-white">{selectedClass.name}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-200">Eligible Students:</span>
                        <strong className="text-white">{carryoverStudents.length}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-200">Tuition per Student:</span>
                        <strong className="text-white">₦{Number(tuition || 0).toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-200">Additional Charges:</span>
                        <strong className="text-white">
                          ₦{(currentTermCharges - Number(tuition || 0)).toLocaleString()}
                        </strong>
                      </div>
                      <div className="flex justify-between border-t border-indigo-800 pt-2 font-semibold">
                        <span className="text-indigo-200">Current Term Charge:</span>
                        <strong className="text-amber-300 text-sm">₦{currentTermCharges.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-200">Total Carryover Debt:</span>
                        <strong className="text-rose-300">₦{totalCarryoverAcrossClass.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between border-t border-indigo-700 pt-3">
                        <span className="text-sm font-bold text-white">Total Expected:</span>
                        <strong className="text-lg font-bold text-emerald-400">
                          ₦{totalClassExpectedAmount.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(true)}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer text-center"
                    >
                      Confirm & Generate Class Invoices
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CLASS INVOICES LIST */}
          {billingStep === 'invoices' && selectedClass && (
            <div className="space-y-5 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setBillingStep('classes');
                      setSelectedClass(null);
                    }}
                    className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-indigo-600"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Back to Classes
                  </button>
                  <span className="text-gray-300">|</span>
                  <span className="text-xs text-gray-500">
                    Invoices for <strong className="text-gray-800">{selectedClass.name}</strong> ({classInvoices.length} invoices)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setBillingStep('create_bill')}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Revise / Re-create Bill
                  </button>
                </div>
              </div>

              <div className="relative max-w-md">
                <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search invoice by student or invoice #..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {filteredInvoices.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-lg border border-gray-200 text-gray-500">
                  <FileText className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="font-semibold text-gray-700">No invoices found</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 font-semibold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-left">Invoice #</th>
                        <th className="px-4 py-3 text-left">Student Name</th>
                        <th className="px-4 py-3 text-left">Admission No</th>
                        <th className="px-4 py-3 text-right">Current Charges</th>
                        <th className="px-4 py-3 text-right">Carryover</th>
                        <th className="px-4 py-3 text-right">Total Payable</th>
                        <th className="px-4 py-3 text-right">Paid</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredInvoices.map((inv) => (
                        <tr key={inv._id} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap font-mono font-semibold text-indigo-700">
                            {inv.invoiceNumber}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                            {inv.fullName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-500">
                            {inv.admissionNo}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-gray-700">
                            ₦{inv.currentTermCharges.toLocaleString()}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-right font-medium ${inv.previousTermCarryover > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                            ₦{inv.previousTermCarryover.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-gray-900">
                            ₦{inv.amountDue.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-emerald-700">
                            ₦{inv.amountPaid.toLocaleString()}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-right font-bold ${inv.remainingBalance > 0 ? 'text-rose-700' : 'text-gray-400'}`}>
                            ₦{inv.remainingBalance.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            {inv.status === 'paid' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Paid
                              </span>
                            ) : inv.status === 'partial' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                Partial
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                Unpaid
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                            {inv.remainingBalance > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentModal(inv)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-semibold"
                              >
                                Pay
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenPrintBill(inv._id)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-semibold inline-flex items-center"
                            >
                              <Printer className="h-3 w-3 mr-1" /> View/Print
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FEES DASHBOARD SUMMARY */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && dashboardStats && (
        <div className="space-y-6 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase">Total Bills Generated</span>
              <p className="text-2xl font-bold text-gray-900 mt-2">{dashboardStats.totalBillsGenerated || 0}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-blue-600 uppercase">Total Expected Fees</span>
              <p className="text-2xl font-bold text-blue-700 mt-2">₦{Number(dashboardStats.totalExpected || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-emerald-600 uppercase">Total Collections</span>
              <p className="text-2xl font-bold text-emerald-700 mt-2">₦{Number(dashboardStats.totalCollected || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-rose-600 uppercase">Outstanding Balances</span>
              <p className="text-2xl font-bold text-rose-700 mt-2">₦{Number(dashboardStats.totalOutstanding || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRM BILL GENERATION MODAL */}
      {/* ========================================================================= */}
      {showConfirmModal && selectedClass && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Confirm Class Bill Generation</h3>
              <button onClick={() => setShowConfirmModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              You are about to generate individual student invoices for the entire class.
              Each invoice will apply the current term charges and automatically include each student's previous term carryover debt.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Class:</span>
                <strong className="text-gray-900">{selectedClass.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Students to Bill:</span>
                <strong className="text-gray-900">{carryoverStudents.length} students</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Term Charge / Student:</span>
                <strong className="text-indigo-700">₦{currentTermCharges.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Carryover Debt Across Class:</span>
                <strong className="text-rose-600">₦{totalCarryoverAcrossClass.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold text-sm">
                <span className="text-gray-900">Total Expected Amount:</span>
                <span className="text-emerald-700">₦{totalClassExpectedAmount.toLocaleString()}</span>
              </div>
            </div>

            {alreadyBilled && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900">
                <strong>Notice:</strong> Invoices already exist for this class ({existingInvoiceCount} existing invoice{existingInvoiceCount === 1 ? '' : 's'}). Proceeding will revise/update existing invoices.
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-gray-300 text-xs font-semibold rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmGenerateBill(alreadyBilled)}
                disabled={generating}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                {generating ? 'Generating Invoices...' : 'Yes, Generate Invoices'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECORD PAYMENT MODAL */}
      {/* ========================================================================= */}
      {showPaymentModal && paymentInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">Record Fee Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                <p>Student: <strong>{paymentInvoice.fullName}</strong> ({paymentInvoice.admissionNo})</p>
                <p>Invoice #: <strong className="font-mono text-indigo-700">{paymentInvoice.invoiceNumber}</strong></p>
                <p>Remaining Balance: <strong className="text-rose-600">₦{paymentInvoice.remainingBalance.toLocaleString()}</strong></p>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Amount Paid (₦)</label>
                <input
                  type="number"
                  min="1"
                  max={paymentInvoice.remainingBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full p-2.5 border rounded-lg text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Payment Note / Reference</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full p-2.5 border rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border text-xs font-semibold rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordPayment}
                disabled={recordingPayment}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                {recordingPayment ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE BILL / INVOICE MODAL (A4 Layout with School Branding) */}
      {/* ========================================================================= */}
      {printingInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-gray-200 overflow-hidden my-8">
            <div className="p-4 bg-gray-100 flex items-center justify-between border-b print:hidden">
              <button
                onClick={() => setPrintingInvoice(null)}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 inline-flex items-center"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Close Preview
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg inline-flex items-center shadow-xs cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Bill (A4)
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* School Branding Header */}
              <div className="text-center border-b-2 border-gray-900 pb-4">
                <h1 className="text-2xl font-black text-gray-900 uppercase tracking-wide">
                  {printingInvoice.school?.name || 'School Bridge Academy'}
                </h1>
                <p className="text-gray-600 text-xs mt-1">{printingInvoice.school?.address || 'School Address'}</p>
                <h2 className="text-lg font-bold text-indigo-900 mt-2 uppercase tracking-wide">
                  Official Student Fee Invoice / Bill
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Invoice #: {printingInvoice.invoice?.invoiceNumber}
                </p>
              </div>

              {/* Student & Bill Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 block">Student Name:</span>
                  <strong className="text-gray-900 text-sm">{printingInvoice.invoice?.studentId?.fullName}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Admission Number:</span>
                  <strong className="font-mono text-gray-900">{printingInvoice.invoice?.studentId?.admissionNo}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Class:</span>
                  <strong className="text-gray-900">{printingInvoice.classInfo?.name} - {printingInvoice.classInfo?.arm}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Due Date:</span>
                  <strong className="text-gray-900">
                    {new Date(printingInvoice.invoice?.dueDate).toLocaleDateString()}
                  </strong>
                </div>
              </div>

              {/* Itemized Charges */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 border-b pb-1">
                  Current Term Charges Breakdown
                </h3>
                <table className="min-w-full divide-y divide-gray-200 text-xs border border-gray-200">
                  <thead className="bg-gray-100 font-bold text-gray-700 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Description / Service</th>
                      <th className="px-4 py-2 text-right">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(printingInvoice.invoice?.lineItems || [])
                      .filter((item: any) => !item.isCarryover)
                      .map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-gray-900 font-medium">{item.name}</td>
                          <td className="px-4 py-2 text-right font-bold text-gray-900">
                            ₦{Number(item.amount).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-4 py-2 text-gray-900">Subtotal Current Charges</td>
                      <td className="px-4 py-2 text-right text-indigo-700 font-bold">
                        ₦{Number(printingInvoice.invoice?.currentTermCharges || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Previous Term Outstanding (Carryover) */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 border-b pb-1">
                  Previous Term Outstanding (Carryover)
                </h3>
                <table className="min-w-full divide-y divide-gray-200 text-xs border border-gray-200">
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-2 text-gray-900 font-medium">Previous Term Outstanding Balance</td>
                      <td className="px-4 py-2 text-right font-bold text-rose-700">
                        ₦{Number(printingInvoice.invoice?.previousTermCarryover || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-indigo-900">Total Current Term Charges:</span>
                  <strong className="text-indigo-950 font-mono">
                    ₦{Number(printingInvoice.invoice?.currentTermCharges || 0).toLocaleString()}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-indigo-900">Previous Term Carryover:</span>
                  <strong className="text-rose-700 font-mono">
                    ₦{Number(printingInvoice.invoice?.previousTermCarryover || 0).toLocaleString()}
                  </strong>
                </div>
                <div className="flex justify-between border-t border-indigo-200 pt-2 text-sm font-bold">
                  <span className="text-indigo-950">Total Payable Amount:</span>
                  <span className="text-indigo-950 font-mono">
                    ₦{Number(printingInvoice.invoice?.amountDue || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-800">Total Payments Recorded:</span>
                  <strong className="text-emerald-800 font-mono">
                    ₦{Number(printingInvoice.totalPaid || 0).toLocaleString()}
                  </strong>
                </div>
                <div className="flex justify-between border-t border-indigo-200 pt-2 text-sm font-bold">
                  <span className="text-rose-800">Net Outstanding Balance:</span>
                  <span className="text-rose-800 font-mono">
                    ₦{Number(printingInvoice.remainingBalance || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 border-t-2 border-gray-300 flex justify-between text-xs text-gray-600">
                <div className="text-center">
                  <div className="w-40 border-b border-gray-400 mb-1"></div>
                  <span>Bursar / Accountant Signature</span>
                </div>
                <div className="text-center">
                  <div className="w-40 border-b border-gray-400 mb-1"></div>
                  <span>Official School Stamp</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fees;
