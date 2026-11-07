import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import {
  Receipt,
  Plus,
  Search,
  CheckCircle,
  Clock,
  Printer,
  AlertCircle,
  Check,
  X,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { amountToWords } from '../utils/numberToWords';

export type VoucherCategory =
  | 'Teaching Staff Salary'
  | 'Non-teaching Staff Salary'
  | 'Allowances'
  | 'Utilities'
  | 'Maintenance'
  | 'Supplies'
  | 'Other Expenditure';

export type VoucherStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Paid' | 'Cancelled';

export interface PaymentVoucher {
  _id: string;
  voucherNumber: string;
  date: string;
  payee: string;
  staffId?: any;
  category: VoucherCategory;
  purpose: string;
  amount: number;
  amountInWords: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'pos' | 'other';
  referenceNumber?: string;
  paymentPeriod?: string;
  preparedBy: {
    name: string;
    date: string;
  };
  approvedBy?: {
    name: string;
    date: string;
  };
  paidBy?: {
    name: string;
    date: string;
  };
  status: VoucherStatus;
  notes?: string;
  createdAt: string;
}

const CATEGORIES: VoucherCategory[] = [
  'Teaching Staff Salary',
  'Non-teaching Staff Salary',
  'Allowances',
  'Utilities',
  'Maintenance',
  'Supplies',
  'Other Expenditure',
];

export const PaymentVouchers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'history' | 'create'>('history');

  // Vouchers state
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [stats, setStats] = useState<any>({
    totalVouchers: 0,
    totalAmountPaid: 0,
    totalPendingApproval: 0,
    totalApproved: 0,
    totalDraft: 0,
  });

  // Staff members for quick salary recipient picker
  const [staffList, setStaffList] = useState<any[]>([]);

  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Loading & feedback
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Print voucher modal state
  const [printVoucher, setPrintVoucher] = useState<PaymentVoucher | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // Create form state
  const [formPayee, setFormPayee] = useState('');
  const [formStaffId, setFormStaffId] = useState('');
  const [formCategory, setFormCategory] = useState<VoucherCategory>('Teaching Staff Salary');
  const [formPurpose, setFormPurpose] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'pos' | 'other'>('bank_transfer');
  const [formReferenceNumber, setFormReferenceNumber] = useState('');
  const [formPaymentPeriod, setFormPaymentPeriod] = useState(
    new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
  );
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formNotes, setFormNotes] = useState('');
  const [formInitialStatus, setFormInitialStatus] = useState<VoucherStatus>('Pending Approval');

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const [vouchersRes, staffRes, schoolRes] = await Promise.all([
        api.get('/vouchers'),
        api.get('/staff'),
        api.get('/schools/me'),
      ]);

      setVouchers(vouchersRes.data?.vouchers || []);
      setStats(vouchersRes.data?.stats || {});
      setStaffList(staffRes.data || []);
      setSchoolInfo(schoolRes.data || {});
    } catch (err: any) {
      console.error('Failed to load vouchers:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to initialize payment vouchers.');
    } finally {
      setLoading(false);
    }
  };

  // When staff selection changes in form
  const handleSelectStaff = (staffId: string) => {
    setFormStaffId(staffId);
    if (!staffId) return;

    const staffMember = staffList.find((s) => s._id === staffId);
    if (staffMember) {
      const name = staffMember.fullName || staffMember.name;
      setFormPayee(name);
      if (staffMember.role === 'teacher') {
        setFormCategory('Teaching Staff Salary');
      } else {
        setFormCategory('Non-teaching Staff Salary');
      }
      setFormPurpose(`Monthly Salary for ${name} (${formPaymentPeriod})`);
    }
  };

  // Form amount change with live words preview
  const liveAmountInWords = useMemo(() => {
    if (typeof formAmount === 'number' && formAmount > 0) {
      return amountToWords(formAmount);
    }
    return '';
  }, [formAmount]);

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPayee.trim()) {
      alert('Please enter payee name.');
      return;
    }
    if (!formAmount || formAmount <= 0) {
      alert('Please enter a valid amount greater than zero.');
      return;
    }
    if (!formPurpose.trim()) {
      alert('Please specify the payment purpose/description.');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      const payload = {
        payee: formPayee.trim(),
        staffId: formStaffId || undefined,
        category: formCategory,
        purpose: formPurpose.trim(),
        amount: Number(formAmount),
        paymentMethod: formPaymentMethod,
        referenceNumber: formReferenceNumber.trim() || undefined,
        paymentPeriod: formPaymentPeriod.trim() || undefined,
        date: formDate,
        notes: formNotes.trim() || undefined,
        status: formInitialStatus,
      };

      const res = await api.post('/vouchers', payload);

      setSuccessMessage(`Payment Voucher ${res.data?.voucherNumber} created successfully!`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // Reset form
      setFormPayee('');
      setFormStaffId('');
      setFormPurpose('');
      setFormAmount('');
      setFormReferenceNumber('');
      setFormNotes('');
      setActiveTab('history');

      // Reload
      await initPage();
    } catch (err: any) {
      console.error('Failed to create voucher:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to create payment voucher.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (voucherId: string, newStatus: VoucherStatus) => {
    try {
      await api.put(`/vouchers/${voucherId}/status`, { status: newStatus });
      setSuccessMessage(`Voucher marked as ${newStatus}!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await initPage();
    } catch (err: any) {
      console.error('Failed to update status:', err);
      alert(err.response?.data?.error || 'Failed to update voucher status.');
    }
  };

  const handleDeleteVoucher = async (voucherId: string, vNumber: string) => {
    if (!window.confirm(`Delete draft voucher ${vNumber}? This cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/vouchers/${voucherId}`);
      setSuccessMessage(`Draft voucher ${vNumber} deleted.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await initPage();
    } catch (err: any) {
      console.error('Delete voucher error:', err);
      alert(err.response?.data?.error || 'Failed to delete voucher.');
    }
  };

  // Filtered vouchers in table
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const matchCategory = categoryFilter === 'all' || v.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchSearch =
        !searchTerm.trim() ||
        v.voucherNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.payee.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.referenceNumber && v.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchCategory && matchStatus && matchSearch;
    });
  }, [vouchers, categoryFilter, statusFilter, searchTerm]);

  const getStatusBadge = (status: VoucherStatus) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" /> Paid
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <Check className="w-3 h-3 mr-1 text-blue-600" /> Approved
          </span>
        );
      case 'Pending Approval':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1 text-amber-600" /> Pending Approval
          </span>
        );
      case 'Draft':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            Draft
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <X className="w-3 h-3 mr-1 text-rose-600" /> Cancelled
          </span>
        );
    }
  };

  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'cash':
        return 'Cash';
      case 'cheque':
        return 'Cheque';
      case 'pos':
        return 'POS';
      default:
        return method || 'Cash';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Vouchers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage school salary disbursements, operational expenses, and printable expenditure vouchers.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-xs">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Voucher History
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer inline-flex items-center ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Create Voucher
          </button>
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

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Total Paid Out
          </span>
          <p className="text-2xl font-black text-gray-900 mt-1">
            ₦{(stats.totalAmountPaid || 0).toLocaleString()}
          </p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">Completed disbursements</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-xs">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            Awaiting Approval
          </span>
          <p className="text-2xl font-black text-amber-900 mt-1">
            {stats.totalPendingApproval || 0}
          </p>
          <p className="text-xs text-amber-600 mt-1 font-medium">Pending authorisations</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-xs">
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
            Approved Vouchers
          </span>
          <p className="text-2xl font-black text-blue-900 mt-1">{stats.totalApproved || 0}</p>
          <p className="text-xs text-blue-600 mt-1 font-medium">Ready for disbursement</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Total Vouchers
          </span>
          <p className="text-2xl font-black text-gray-900 mt-1">{stats.totalVouchers || 0}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">All financial records</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: VOUCHER HISTORY & TABLE */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search voucher #, payee, purpose, ref..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 font-medium">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-medium focus:ring-indigo-500"
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-medium focus:ring-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Approved">Approved</option>
                  <option value="Paid">Paid</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
              <p>Loading payment vouchers...</p>
            </div>
          ) : filteredVouchers.length === 0 ? (
            <div className="bg-white border rounded-xl p-12 text-center text-gray-500 shadow-xs">
              <Receipt className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="font-bold text-gray-800 text-base">No payment vouchers found</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                No expenditure vouchers match your active filters. Click "Create Voucher" to record salary or operational payments.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left">Voucher #</th>
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-left">Payee / Recipient</th>
                      <th className="px-5 py-3 text-left">Category & Purpose</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3 text-left">Method</th>
                      <th className="px-5 py-3 text-left">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredVouchers.map((v) => (
                      <tr key={v._id} className="hover:bg-indigo-50/40 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono font-bold text-indigo-700">
                          {v.voucherNumber}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-600">
                          {new Date(v.date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">{v.payee}</div>
                          {v.staffId && (
                            <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded">
                              Staff Record
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 max-w-xs truncate">
                          <span className="text-xs font-semibold text-gray-800 block">
                            {v.category}
                          </span>
                          <span className="text-xs text-gray-500 truncate block mt-0.5">
                            {v.purpose}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm font-black text-gray-900 font-mono">
                          ₦{v.amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-600">
                          {formatPaymentMethod(v.paymentMethod)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {getStatusBadge(v.status)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right text-xs">
                          <div className="flex items-center justify-end space-x-2">
                            {/* Print Voucher */}
                            <button
                              onClick={() => setPrintVoucher(v)}
                              className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                              title="Print Voucher"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {/* Status transitions */}
                            {v.status === 'Draft' && (
                              <button
                                onClick={() => handleUpdateStatus(v._id, 'Pending Approval')}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[11px] font-semibold cursor-pointer"
                              >
                                Submit
                              </button>
                            )}

                            {v.status === 'Pending Approval' && (
                              <button
                                onClick={() => handleUpdateStatus(v._id, 'Approved')}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-semibold cursor-pointer"
                              >
                                Approve
                              </button>
                            )}

                            {v.status === 'Approved' && (
                              <button
                                onClick={() => handleUpdateStatus(v._id, 'Paid')}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[11px] font-semibold cursor-pointer"
                              >
                                Mark Paid
                              </button>
                            )}

                            {v.status === 'Draft' && (
                              <button
                                onClick={() => handleDeleteVoucher(v._id, v.voucherNumber)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Draft"
                              >
                                <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CREATE VOUCHER FORM */}
      {/* ========================================================================= */}
      {activeTab === 'create' && (
        <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Create Payment Expenditure Voucher</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Record staff salaries, allowances, supplies, or school operational expenditures.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('history')}
              className="inline-flex items-center text-xs font-semibold text-gray-500 hover:text-indigo-600"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to History
            </button>
          </div>

          <form onSubmit={handleCreateVoucher} className="space-y-6">
            {/* Category & Staff Picker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Voucher Category *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as VoucherCategory)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Select Existing Staff (Optional for Salary)
                </label>
                <select
                  value={formStaffId}
                  onChange={(e) => handleSelectStaff(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Manual Payee / Non-Staff --</option>
                  {staffList.map((st) => (
                    <option key={st._id} value={st._id}>
                      {st.fullName || st.name} ({st.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Payee & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Payee / Recipient Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mr. Lekan Johnson or PHCN Electric Co."
                  value={formPayee}
                  onChange={(e) => setFormPayee(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Voucher Date *
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Payment Purpose / Description *
              </label>
              <input
                type="text"
                placeholder="e.g. Full Monthly Salary for Teaching Services rendered during October 2026"
                value={formPurpose}
                onChange={(e) => setFormPurpose(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Amount & Method */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Amount (₦) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="e.g. 75000"
                  value={formAmount}
                  onChange={(e) =>
                    setFormAmount(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 font-bold font-mono focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Payment Method
                </label>
                <select
                  value={formPaymentMethod}
                  onChange={(e: any) => setFormPaymentMethod(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="pos">POS</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Reference / Cheque #
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-894120"
                  value={formReferenceNumber}
                  onChange={(e) => setFormReferenceNumber(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Live Amount in words banner */}
            {liveAmountInWords && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-900">
                <span className="font-bold">Amount in Words: </span>
                <span className="italic">{liveAmountInWords}</span>
              </div>
            )}

            {/* Payment Period & Initial Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Payment Period
                </label>
                <input
                  type="text"
                  placeholder="e.g. October 2026 or 1st Term 2026/2027"
                  value={formPaymentPeriod}
                  onChange={(e) => setFormPaymentPeriod(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Initial Voucher Status
                </label>
                <select
                  value={formInitialStatus}
                  onChange={(e: any) => setFormInitialStatus(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Pending Approval">Pending Approval (Standard)</option>
                  <option value="Approved">Approved</option>
                  <option value="Paid">Mark Directly as Paid</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Internal Financial Notes / Remarks
              </label>
              <textarea
                rows={2}
                placeholder="Optional notes or accounting code references..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Creating Voucher...' : 'Save & Generate Voucher'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE VOUCHER MODAL */}
      {/* ========================================================================= */}
      {printVoucher && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-8">
            {/* Modal Actions Header */}
            <div className="bg-gray-800 text-white px-6 py-3.5 flex items-center justify-between print:hidden">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-bold">Print Payment Voucher</span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Voucher
                </button>
                <button
                  onClick={() => setPrintVoucher(null)}
                  className="text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* A4 Voucher Printable Content */}
            <div className="p-8 sm:p-12 text-gray-900 bg-white" id="printable-voucher">
              {/* School Header */}
              <div className="border-b-2 border-gray-900 pb-5 mb-6 text-center">
                <h1 className="text-2xl font-black uppercase tracking-wider text-gray-900">
                  {schoolInfo?.name || 'Ijebu-Ode Comprehensive College'}
                </h1>
                {schoolInfo?.address && (
                  <p className="text-xs text-gray-600 mt-1">{schoolInfo.address}</p>
                )}
                <div className="inline-block mt-3 px-4 py-1 bg-gray-900 text-white font-black text-sm uppercase tracking-widest rounded">
                  Official Payment Voucher
                </div>
              </div>

              {/* Voucher Meta Strip */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-xs border border-gray-300 p-4 rounded-lg bg-gray-50/50">
                <div>
                  <span className="text-gray-500 font-semibold uppercase">Voucher Number: </span>
                  <span className="font-mono font-black text-indigo-900 text-sm">
                    {printVoucher.voucherNumber}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 font-semibold uppercase">Date: </span>
                  <span className="font-bold">
                    {new Date(printVoucher.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold uppercase">Category: </span>
                  <span className="font-bold text-gray-800">{printVoucher.category}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 font-semibold uppercase">Status: </span>
                  <span className="font-bold uppercase tracking-wider text-indigo-700">
                    {printVoucher.status}
                  </span>
                </div>
              </div>

              {/* Payee and Particulars Table */}
              <div className="border border-gray-300 rounded-lg overflow-hidden mb-6">
                <table className="min-w-full divide-y divide-gray-300 text-xs">
                  <tbody>
                    <tr className="divide-x divide-gray-300">
                      <td className="w-1/3 px-4 py-3 bg-gray-100 font-bold uppercase text-gray-600">
                        Paid To (Payee)
                      </td>
                      <td className="px-4 py-3 font-bold text-sm text-gray-900">
                        {printVoucher.payee}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-300">
                      <td className="px-4 py-3 bg-gray-100 font-bold uppercase text-gray-600">
                        Payment Period
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {printVoucher.paymentPeriod || 'Current Period'}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-300">
                      <td className="px-4 py-3 bg-gray-100 font-bold uppercase text-gray-600">
                        Purpose / Particulars
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 leading-relaxed">
                        {printVoucher.purpose}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-300">
                      <td className="px-4 py-3 bg-gray-100 font-bold uppercase text-gray-600">
                        Payment Method & Ref
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {formatPaymentMethod(printVoucher.paymentMethod)}{' '}
                        {printVoucher.referenceNumber ? `(Ref: ${printVoucher.referenceNumber})` : ''}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-300 bg-gray-50">
                      <td className="px-4 py-4 bg-gray-200 font-black uppercase text-gray-900">
                        Amount in Figures
                      </td>
                      <td className="px-4 py-4 font-black text-xl text-gray-900 font-mono">
                        ₦{printVoucher.amount.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-300">
                      <td className="px-4 py-3 bg-gray-100 font-bold uppercase text-gray-600">
                        Amount in Words
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900 italic">
                        {printVoucher.amountInWords}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signatures Area */}
              <div className="grid grid-cols-3 gap-6 pt-12 mt-12 border-t-2 border-dashed border-gray-300 text-center text-xs">
                <div>
                  <div className="border-b border-gray-900 pb-1 mb-2 font-semibold">
                    {printVoucher.preparedBy?.name || 'Staff Member'}
                  </div>
                  <p className="font-bold text-gray-700 uppercase">Prepared By</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(printVoucher.preparedBy?.date || printVoucher.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <div className="border-b border-gray-900 pb-1 mb-2 font-semibold min-h-[22px]">
                    {printVoucher.approvedBy?.name || '_____________________'}
                  </div>
                  <p className="font-bold text-gray-700 uppercase">Approved By (Principal/Admin)</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {printVoucher.approvedBy?.date
                      ? new Date(printVoucher.approvedBy.date).toLocaleDateString()
                      : 'Date & Stamp'}
                  </p>
                </div>

                <div>
                  <div className="border-b border-gray-900 pb-1 mb-2 font-semibold min-h-[22px]">
                    {printVoucher.paidBy?.name ? `Received / Disbursed` : '_____________________'}
                  </div>
                  <p className="font-bold text-gray-700 uppercase">Received By (Payee Signature)</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Signature & Date</p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400">
                SchoolBridge Financial Voucher · Generated for official audit compliance
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentVouchers;

