import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';
import { uploadStaffPhoto, uploadStudentPhoto, uploadGeneralImage } from '../controllers/uploadController';
import multer from 'multer';

const router = express.Router();

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, and GIF images are allowed'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// Upload generic image (branding logo, pre-registration photo) - available to staff & admin
router.post('/image', upload.single('image'), uploadGeneralImage);

// Admin-restricted routes
router.use(requireAdmin);

// Upload staff photo
router.post('/staff/:staffId', upload.single('photo'), uploadStaffPhoto);

// Upload student photo
router.post('/students/:studentId', upload.single('photo'), uploadStudentPhoto);

export default router;
