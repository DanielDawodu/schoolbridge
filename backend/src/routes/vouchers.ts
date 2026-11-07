import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAccountantOrAdmin } from '../middleware/permissions';
import {
  getVouchers,
  getVoucherById,
  createVoucher,
  updateVoucher,
  updateVoucherStatus,
  deleteVoucher,
} from '../controllers/voucherController';

const router = express.Router();

// All voucher routes require authentication and accountant or admin role
router.use(authenticate);
router.use(requireAccountantOrAdmin);

router.get('/', getVouchers);
router.get('/:id', getVoucherById);
router.post('/', createVoucher);
router.put('/:id', updateVoucher);
router.put('/:id/status', updateVoucherStatus);
router.delete('/:id', deleteVoucher);

export default router;

