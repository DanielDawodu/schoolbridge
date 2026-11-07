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
  getReceiptDetail,
  verifyReceiptPublic,
  reversePayment,
  getClassPaymentReports,
} from '../controllers/feesController';

const router = express.Router();

// =========================================================================
// PUBLIC ROUTES (No Authentication Required for QR Verification)
// =========================================================================
router.get('/public/verify-receipt/:verificationCode', verifyReceiptPublic);

// =========================================================================
// AUTHENTICATED ROUTES (Admin or Accountant Role Required)
// =========================================================================
router.use(authenticate);
router.use(requireAccountantOrAdmin);

// Class billing summary for active term
router.get('/classes-summary', getClassBillingSummary);

// Preview class billing with automated carryover
router.get('/class-preview', getClassBillingPreview);

// Generate class-wide bill with tuition, additional charges, and carryover
router.post('/generate-class-bill', generateClassBill);

// Class invoices list
router.get('/class-invoices', getClassInvoices);

// Single invoice detail with payment history and branding for printing
router.get('/invoice-detail/:invoiceId', getInvoiceDetail);

// Payment receipt detail for printing/reprinting
router.get('/receipts/:paymentId', getReceiptDetail);

// Reverse / void payment with audit trail
router.post('/payments/:paymentId/reverse', reversePayment);

// Payment reports (Fully Paid Students & Debtors List)
router.get('/class-reports', getClassPaymentReports);

// Create single invoice (manual)
router.post('/invoices', createInvoice);

// Delete invoice
router.delete('/invoices/:invoiceId', deleteInvoice);

// Record payment (generates unique receipt & QR verification)
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
