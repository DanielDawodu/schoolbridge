import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Student {
  _id: string;
  fullName: string;
  admissionNo: string;
}

interface AcademicSession {
  _id: string;
  year: string;
  currentTerm: 'first' | 'second' | 'third';
  createdAt: string;
}

interface ClassGroup {
  _id: string;
  name: string;
  arm: string;
}

interface BillLineItem {
  label: string;
  amount: number;
}

interface BillAppliesTo {
  type: 'class' | 'school';
  classId?: string;
}

interface BillTemplate {
  _id: string;
  schoolId: string;
  termId: string;
  name: string;
  lineItems: BillLineItem[];
  totalAmount: number;
  appliesTo: BillAppliesTo;
  createdAt: string;
  term?: AcademicSession;
  appliesToClass?: ClassGroup;
}

interface FeeInvoice {
  _id: string;
  studentId: Student;
  termId: AcademicSession;
  billTemplate?: BillTemplate;
  amountDue: number;
  dueDate: string;
  status: 'unpaid' | 'partial' | 'paid';
  credit: number;
  createdAt: string;
}

interface FeePayment {
  _id: string;
  invoiceId: string;
  studentId: string;
  amountPaid: number;
  paidAt: string;
  recordedBy: any;
  note?: string;
}

interface FeesDashboard {
  termId: string;
  termName: string;
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
  totalCredit: number;
  outstandingBalances: Array<{
    student: Student;
    invoiceId: string;
    amountDue: number;
    amountPaid: number;
    remainingBalance: number;
    status: string;
    credit: number;
  }>;
}

interface School {
  _id: string;
  name: string;
  address: string;
}

const Fees: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [amountDue, setAmountDue] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [studentFees, setStudentFees] = useState<{ invoices: FeeInvoice[]; payments: FeePayment[] }>({
    invoices: [],
    payments: [],
  });
  const [dashboard, setDashboard] = useState<FeesDashboard | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showStudentFees, setShowStudentFees] = useState(false);
  
  // Bill Template state
  const [billTemplates, setBillTemplates] = useState<BillTemplate[]>([]);
  const [showBillTemplates, setShowBillTemplates] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    termId: '',
    lineItems: [{ label: '', amount: 0 }] as BillLineItem[],
    appliesTo: { type: 'school' as 'class' | 'school', classId: '' },
  });

  useEffect(() => {
    fetchStudents();
    fetchSessions();
    fetchClasses();
    fetchBillTemplates();
    fetchSchool();
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [selectedSession]);

  const fetchStudents = async () => {
    try {
      const response = await api.get('/students');
      setStudents(response.data);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await api.get('/academic-sessions');
      setSessions(response.data);
      
      // Try to get the school's active term
      try {
        const schoolResponse = await api.get('/schools/me');
        const activeTermId = schoolResponse.data.activeTermId;
        if (activeTermId) {
          setSelectedSession(activeTermId.toString());
          return;
        }
      } catch (error) {
        // If fetching school fails, fall back to most recent
      }
      
      // Fall back to most recent session (by createdAt)
      const sortedSessions = [...response.data].sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      if (sortedSessions.length > 0) {
        setSelectedSession(sortedSessions[0]._id);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await api.get('/classes');
      setClasses(response.data);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    }
  };

  const fetchBillTemplates = async () => {
    try {
      const response = await api.get('/fees/bill-templates');
      setBillTemplates(response.data);
    } catch (error) {
      console.error('Failed to fetch bill templates:', error);
    }
  };

  const fetchSchool = async () => {
    try {
      const response = await api.get('/schools/me');
      setSchool(response.data);
    } catch (error) {
      console.error('Failed to fetch school:', error);
    }
  };

  const fetchDashboard = async () => {
    try {
      const url = selectedSession ? `/fees/dashboard?termId=${selectedSession}` : '/fees/dashboard';
      const response = await api.get(url);
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    }
  };

  const fetchStudentFees = async (studentId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/fees/student/${studentId}`);
      setStudentFees(response.data);
      setShowStudentFees(true);
    } catch (error) {
      console.error('Failed to fetch student fees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedStudent || !selectedSession || !amountDue || !dueDate) {
      alert('Please fill all fields');
      return;
    }

    try {
      setLoading(true);
      await api.post('/fees/invoices', {
        studentId: selectedStudent,
        termId: selectedSession,
        amountDue: parseFloat(amountDue),
        dueDate,
      });
      alert('Invoice created successfully');
      setShowCreateInvoice(false);
      setAmountDue('');
      setDueDate('');
      fetchDashboard();
      if (selectedStudent) {
        fetchStudentFees(selectedStudent);
      }
    } catch (error: any) {
      console.error('Failed to create invoice:', error);
      alert(error.response?.data?.error || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoiceForPayment || !paymentAmount) {
      alert('Please select an invoice and enter payment amount');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/fees/payments', {
        invoiceId: selectedInvoiceForPayment,
        amountPaid: parseFloat(paymentAmount),
        note: paymentNote,
      });
      
      if (response.data.credit > 0) {
        alert(`Payment recorded successfully. Credit balance: ₦${response.data.credit.toLocaleString()}`);
      } else {
        alert('Payment recorded successfully');
      }
      
      setPaymentAmount('');
      setPaymentNote('');
      setSelectedInvoiceForPayment('');
      fetchDashboard();
      if (selectedStudent) {
        fetchStudentFees(selectedStudent);
      }
    } catch (error: any) {
      console.error('Failed to record payment:', error);
      alert(error.response?.data?.error || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const getInvoiceTotalPaid = (invoiceId: string) => {
    const payments = studentFees.payments.filter((p) => p.invoiceId === invoiceId);
    return payments.reduce((sum, p) => sum + p.amountPaid, 0);
  };

  // Bill Template Functions
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validLineItems = templateForm.lineItems.filter(item => item.label && item.amount > 0);
      if (validLineItems.length === 0) {
        alert('Please add at least one line item with a label and amount');
        return;
      }

      await api.post('/fees/bill-templates', {
        ...templateForm,
        lineItems: validLineItems,
      });

      alert('Bill template created successfully');
      setShowCreateTemplate(false);
      setTemplateForm({
        name: '',
        termId: '',
        lineItems: [{ label: '', amount: 0 }],
        appliesTo: { type: 'school', classId: '' },
      });
      fetchBillTemplates();
    } catch (error: any) {
      console.error('Failed to create template:', error);
      alert(error.response?.data?.error || 'Failed to create template');
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    if (!confirm('This will create invoices for all active students in the target. Continue?')) return;
    
    try {
      const response = await api.post(`/fees/bill-templates/${templateId}/apply`);
      alert(response.data.message);
      fetchDashboard();
    } catch (error: any) {
      console.error('Failed to apply template:', error);
      alert(error.response?.data?.error || 'Failed to apply template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this bill template?')) return;
    
    try {
      await api.delete(`/fees/bill-templates/${templateId}`);
      alert('Bill template deleted successfully');
      fetchBillTemplates();
    } catch (error: any) {
      console.error('Failed to delete template:', error);
      alert(error.response?.data?.error || 'Failed to delete template');
    }
  };

  const addLineItem = () => {
    setTemplateForm({
      ...templateForm,
      lineItems: [...templateForm.lineItems, { label: '', amount: 0 }],
    });
  };

  const removeLineItem = (index: number) => {
    setTemplateForm({
      ...templateForm,
      lineItems: templateForm.lineItems.filter((_, i) => i !== index),
    });
  };

  const updateLineItem = (index: number, field: 'label' | 'amount', value: string | number) => {
    const updatedItems = [...templateForm.lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setTemplateForm({ ...templateForm, lineItems: updatedItems });
  };

  const getTemplateTotal = () => {
    return templateForm.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const handlePrintBill = (invoice: FeeInvoice) => {
    // Create a printable bill view
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print bills');
      return;
    }

    const student = invoice.studentId;
    const term = invoice.termId;
    const template = invoice.billTemplate;
    const totalPaid = getInvoiceTotalPaid(invoice._id);
    const remaining = Math.max(0, invoice.amountDue - totalPaid);

    let lineItemsHtml = '';
    if (template && template.lineItems) {
      lineItemsHtml = template.lineItems.map((item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.label}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₦${item.amount.toLocaleString()}</td>
        </tr>
      `).join('');
    } else {
      lineItemsHtml = `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">Fees</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₦${invoice.amountDue.toLocaleString()}</td>
        </tr>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fee Bill - ${student.fullName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #1f2937; }
          .header p { margin: 5px 0; color: #6b7280; }
          .student-info { margin-bottom: 30px; }
          .student-info table { width: 100%; border-collapse: collapse; }
          .student-info td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
          .student-info td:first-child { font-weight: bold; width: 150px; }
          .line-items { margin-bottom: 30px; }
          .line-items table { width: 100%; border-collapse: collapse; }
          .line-items th { background: #f3f4f6; padding: 10px; text-align: left; border-bottom: 2px solid #d1d5db; }
          .totals { margin-top: 20px; text-align: right; }
          .totals p { margin: 5px 0; font-size: 18px; }
          .totals .amount { font-weight: bold; }
          .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${school?.name || 'Fee Bill'}</h1>
          <p>Fee Bill</p>
        </div>

        <div class="student-info">
          <table>
            <tr>
              <td>Student Name:</td>
              <td>${student.fullName}</td>
            </tr>
            <tr>
              <td>Admission No:</td>
              <td>${student.admissionNo}</td>
            </tr>
            <tr>
              <td>Term:</td>
              <td>${term.year} - ${term.currentTerm}</td>
            </tr>
            <tr>
              <td>Invoice Date:</td>
              <td>${new Date(invoice.createdAt).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td>Due Date:</td>
              <td>${new Date(invoice.dueDate).toLocaleDateString()}</td>
            </tr>
          </table>
        </div>

        <div class="line-items">
          <h3>Fee Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
            </tbody>
          </table>
        </div>

        <div class="totals">
          <p>Total Due: <span class="amount">₦${invoice.amountDue.toLocaleString()}</span></p>
          <p>Amount Paid: <span class="amount">₦${totalPaid.toLocaleString()}</span></p>
          <p>Outstanding Balance: <span class="amount ${remaining > 0 ? 'text-red-600' : 'text-green-600'}">₦${remaining.toLocaleString()}</span></p>
          ${(invoice.credit || 0) > 0 ? `<p>Credit Balance: <span class="amount">₦${invoice.credit.toLocaleString()}</span></p>` : ''}
        </div>

        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fees</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowBillTemplates(!showBillTemplates)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            {showBillTemplates ? 'View Dashboard' : 'Bill Templates'}
          </button>
          <button
            onClick={() => setShowCreateInvoice(!showCreateInvoice)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            {showCreateInvoice ? 'View Dashboard' : 'Create Invoice'}
          </button>
        </div>
      </div>

      {showBillTemplates ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Bill Templates</h2>
            <button
              onClick={() => {
                setTemplateForm({
                  name: '',
                  termId: selectedSession || '',
                  lineItems: [{ label: '', amount: 0 }],
                  appliesTo: { type: 'school', classId: '' },
                });
                setShowCreateTemplate(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              Create Template
            </button>
          </div>

          {showCreateTemplate ? (
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="e.g., First Term Fees"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={templateForm.termId}
                  onChange={(e) => setTemplateForm({ ...templateForm, termId: e.target.value })}
                >
                  <option value="">Select a term...</option>
                  {sessions.map((session) => (
                    <option key={session._id} value={session._id}>
                      {session.year} - {session.currentTerm}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applies To</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={templateForm.appliesTo.type}
                  onChange={(e) => setTemplateForm({
                    ...templateForm,
                    appliesTo: { type: e.target.value as 'class' | 'school', classId: '' },
                  })}
                >
                  <option value="school">Whole School</option>
                  <option value="class">Specific Class</option>
                </select>
              </div>

              {templateForm.appliesTo.type === 'class' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={templateForm.appliesTo.classId}
                    onChange={(e) => setTemplateForm({
                      ...templateForm,
                      appliesTo: { ...templateForm.appliesTo, classId: e.target.value },
                    })}
                  >
                    <option value="">Select a class...</option>
                    {classes.map((cls) => (
                      <option key={cls._id} value={cls._id}>
                        {cls.name} - {cls.arm}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Line Items</label>
                {templateForm.lineItems.map((item, index) => (
                  <div key={index} className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      required
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Label (e.g., Tuition)"
                      value={item.label}
                      onChange={(e) => updateLineItem(index, 'label', e.target.value)}
                    />
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Amount"
                      value={item.amount}
                      onChange={(e) => updateLineItem(index, 'amount', parseFloat(e.target.value) || 0)}
                    />
                    {templateForm.lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addLineItem}
                  className="mt-2 text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + Add Line Item
                </button>
              </div>

              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm font-medium text-gray-700">
                  Total: ₦{getTemplateTotal().toLocaleString()}
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateTemplate(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Create Template
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {billTemplates.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No bill templates found. Create one to get started.</p>
              ) : (
                billTemplates.map((template) => (
                  <div key={template._id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{template.name}</h3>
                        <p className="text-sm text-gray-500">
                          {template.term?.year} - {template.term?.currentTerm}
                        </p>
                        <p className="text-sm text-gray-500">
                          {template.appliesTo?.type === 'class'
                            ? `Class: ${template.appliesToClass?.name} - ${template.appliesToClass?.arm}`
                            : 'Whole School'}
                        </p>
                        <p className="text-sm font-medium text-gray-900 mt-2">
                          Total: ₦{template.totalAmount.toLocaleString()}
                        </p>
                        <div className="text-sm text-gray-600 mt-1">
                          {template.lineItems.map((item, i) => (
                            <span key={i}>
                              {item.label}: ₦{item.amount.toLocaleString()}
                              {i < template.lineItems.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApplyTemplate(template._id)}
                          className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template._id)}
                          className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : showCreateInvoice ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Invoice</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
              >
                <option value="">Select a student...</option>
                {students.map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.fullName} ({student.admissionNo})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
              >
                <option value="">Select a term...</option>
                {sessions.map((session) => (
                  <option key={session._id} value={session._id}>
                    {session.year} - {session.currentTerm}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Due</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={amountDue}
                onChange={(e) => setAmountDue(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={handleCreateInvoice}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      ) : (
        <>
          {dashboard && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-800">Total Expected</h3>
                <p className="text-3xl font-bold text-blue-900">
                  ₦{dashboard.totalExpected.toLocaleString()}
                </p>
                <p className="text-sm text-blue-600 mt-1">{dashboard.termName}</p>
                <div className="mt-2">
                  <select
                    className="text-xs px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                  >
                    {sessions.map((session) => (
                      <option key={session._id} value={session._id}>
                        {session.year} - {session.currentTerm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800">Total Collected</h3>
                <p className="text-3xl font-bold text-green-900">
                  ₦{dashboard.totalCollected.toLocaleString()}
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-red-800">Outstanding</h3>
                <p className="text-3xl font-bold text-red-900">
                  ₦{dashboard.totalOutstanding.toLocaleString()}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-purple-800">Total Credit</h3>
                <p className="text-3xl font-bold text-purple-900">
                  ₦{dashboard.totalCredit?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          )}

          {dashboard && dashboard.outstandingBalances.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Outstanding Balances</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount Due
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Paid
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Remaining
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboard.outstandingBalances.map((balance) => (
                      <tr key={balance.invoiceId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {balance.student.fullName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₦{balance.amountDue.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₦{balance.amountPaid.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                          ₦{balance.remainingBalance.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              balance.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : balance.status === 'partial'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {balance.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">View Student Fees</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                >
                  <option value="">Select a student...</option>
                  {students.map((student) => (
                    <option key={student._id} value={student._id}>
                      {student.fullName} ({student.admissionNo})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => selectedStudent && fetchStudentFees(selectedStudent)}
                  disabled={loading || !selectedStudent}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'View Fees'}
                </button>
              </div>
            </div>

            {showStudentFees && (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Invoices</h3>
                  {studentFees.invoices.length === 0 ? (
                    <p className="text-gray-500">No invoices found for this student.</p>
                  ) : (
                    <div className="space-y-3">
                      {studentFees.invoices.map((invoice) => {
                        const totalPaid = getInvoiceTotalPaid(invoice._id);
                        const remaining = Math.max(0, invoice.amountDue - totalPaid);
                        const hasCredit = (invoice.credit || 0) > 0;
                        return (
                          <div key={invoice._id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {invoice.termId.year} - {invoice.termId.currentTerm}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Due: {new Date(invoice.dueDate).toLocaleDateString()}
                                </p>
                              </div>
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  invoice.status === 'paid'
                                    ? 'bg-green-100 text-green-800'
                                    : invoice.status === 'partial'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {invoice.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Amount Due</p>
                                <p className="font-medium text-gray-900">
                                  ₦{invoice.amountDue.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Paid</p>
                                <p className="font-medium text-green-600">
                                  ₦{totalPaid.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Remaining</p>
                                <p className={`font-medium ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  ₦{remaining.toLocaleString()}
                                </p>
                              </div>
                            </div>
                            {hasCredit && (
                              <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                                <p className="text-sm text-blue-800">
                                  Credit balance: ₦{(invoice.credit || 0).toLocaleString()}
                                </p>
                              </div>
                            )}
                            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between">
                              <button
                                onClick={() => {
                                  setSelectedInvoiceForPayment(invoice._id);
                                  handlePrintBill(invoice);
                                }}
                                className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                              >
                                Print Bill
                              </button>
                              {remaining > 0 && (
                                <button
                                  onClick={() => {
                                    setSelectedInvoiceForPayment(invoice._id);
                                    handleRecordPayment();
                                  }}
                                  disabled={loading}
                                  className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50"
                                >
                                  {loading ? 'Recording...' : 'Record Payment'}
                                </button>
                              )}
                            </div>
                            {remaining > 0 && selectedInvoiceForPayment === invoice._id && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Record Payment
                                </label>
                                <div className="flex space-x-2">
                                  <input
                                    type="number"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Amount"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    min="0"
                                    step="0.01"
                                  />
                                  <input
                                    type="text"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Note (optional)"
                                    value={paymentNote}
                                    onChange={(e) => setPaymentNote(e.target.value)}
                                  />
                                  <button
                                    onClick={handleRecordPayment}
                                    disabled={
                                      loading ||
                                      !paymentAmount ||
                                      selectedInvoiceForPayment !== invoice._id
                                    }
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                                  >
                                    Record
                                  </button>
                                </div>
                              </div>
                            )}
                            {hasCredit && !remaining && (
                              <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                                <p className="text-sm text-blue-800">
                                  Additional payments will add to credit balance
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment History</h3>
                  {studentFees.payments.length === 0 ? (
                    <p className="text-gray-500">No payments recorded for this student.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Amount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Recorded By
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Note
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {studentFees.payments.map((payment) => (
                            <tr key={payment._id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(payment.paidAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                ₦{payment.amountPaid.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {payment.recordedBy?.fullName || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {payment.note || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Overall Credit Balance */}
                {studentFees.invoices.length > 0 && (
                  <div className="mt-6">
                    {(() => {
                      const totalCredit = studentFees.invoices.reduce((sum, inv) => sum + (inv.credit || 0), 0);
                      if (totalCredit > 0) {
                        return (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                              Total credit balance: ₦{totalCredit.toLocaleString()}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Fees;
