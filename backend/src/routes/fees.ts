import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAccountantOrAdmin } from '../middleware/permissions';
import {
  createInvoice,
  recordPayment,
  getStudentFees,
  getFeesDashboard,
  getInvoicePayments,
  deletePayment,
  deleteInvoice,
  createBillTemplate,
  getBillTemplates,
  getBillTemplate,
  deleteBillTemplate,
  applyBillTemplate,
  getClassBillingSummary,
  getClassBillingPreview,
  generateClassBill,
  getClassInvoices,
  getInvoiceDetail,
} from '../controllers/feesController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// All fees routes require accountant or admin role
router.use(requireAccountantOrAdmin);

// Phase 4 Step 1: Class billing summary for active term
router.get('/classes-summary', getClassBillingSummary);

// Phase 4 Step 2: Preview class billing with automated carryover
router.get('/class-preview', getClassBillingPreview);

// Phase 4 Step 3: Generate class-wide bill with tuition, additional charges, and carryover
router.post('/generate-class-bill', generateClassBill);

// Phase 4 Step 4: Class invoices list
router.get('/class-invoices', getClassInvoices);

// Phase 4 Step 5: Single invoice detail with payment history and branding for printing
router.get('/invoice-detail/:invoiceId', getInvoiceDetail);

// Create single invoice (manual)
router.post('/invoices', createInvoice);

// Delete invoice
router.delete('/invoices/:invoiceId', deleteInvoice);

// Record payment
router.post('/payments', recordPayment);

// Delete payment
router.delete('/payments/:paymentId', deletePayment);

// Get student's fee history
router.get('/student/:studentId', getStudentFees);

// Get fees dashboard
router.get('/dashboard', getFeesDashboard);

// Get invoice with payments
router.get('/invoices/:invoiceId/payments', getInvoicePayments);

// Bill Templates
router.post('/bill-templates', createBillTemplate);
router.get('/bill-templates', getBillTemplates);
router.get('/bill-templates/:id', getBillTemplate);
router.delete('/bill-templates/:id', deleteBillTemplate);
router.post('/bill-templates/:templateId/apply', applyBillTemplate);

export default router;
