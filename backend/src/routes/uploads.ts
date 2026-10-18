import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import { uploadStaffPhoto, uploadStudentPhoto } from '../controllers/uploadController';
import multer from 'multer';

const router = express.Router();

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB limit (photos are now resized client-side)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and GIF images are allowed'));
    }
  },
});

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Upload staff photo
router.post('/staff/:staffId', upload.single('photo'), uploadStaffPhoto);

// Upload student photo
router.post('/students/:studentId', upload.single('photo'), uploadStudentPhoto);

export default router;
