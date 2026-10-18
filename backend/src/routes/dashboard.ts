import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/stats', verifyToken, getDashboardStats);

export default router;
