import { Router } from 'express';
import {
  createSession,
  getSessions,
  getSession,
  updateSession,
  deleteSession,
} from '../controllers/academicSessionController';
import { getAcademicSessionsCompat } from '../controllers/sessionController';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/permissions';

const router = Router();

// Compatibility route: Returns Session+Period data in AcademicSession format (for dropdowns)
router.get('/compat', authenticate, getAcademicSessionsCompat);

// Legacy routes for Settings page (mapped to Session/Period/Term structure)
router.post('/', authenticate, requireAdmin, createSession);
router.get('/', authenticate, requireAdmin, getSessions);
router.get('/:id', authenticate, requireAdmin, getSession);
router.put('/:id', authenticate, requireAdmin, updateSession);
router.delete('/:id', authenticate, requireAdmin, deleteSession);

export default router;
