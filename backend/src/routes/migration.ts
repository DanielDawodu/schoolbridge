import { Router } from 'express';
import multer from 'multer';
import {
  uploadFile,
  validateAndPreview,
  confirmImport,
  getMigrationBatches,
  getMigrationBatch,
  downloadErrorReport,
  rollbackBatch,
  getClasses,
  createClass,
} from '../controllers/migrationController';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';

const router = Router();

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: Math.floor(4.5 * 1024 * 1024), // 4.5MB limit (Vercel serverless payload ceiling)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
});

router.post('/upload', authenticate, requireAdmin, upload.single('file'), uploadFile);
router.post('/validate', authenticate, requireAdmin, validateAndPreview);
router.post('/confirm', authenticate, requireAdmin, confirmImport);
router.get('/batches', authenticate, requireAdmin, getMigrationBatches);
router.get('/batches/:id', authenticate, requireAdmin, getMigrationBatch);
router.get('/batches/:id/error-report', authenticate, requireAdmin, downloadErrorReport);
router.delete('/batches/:id/rollback', authenticate, requireAdmin, rollbackBatch);
router.get('/classes', authenticate, requireAdmin, getClasses);
router.post('/classes', authenticate, requireAdmin, createClass);

export default router;
