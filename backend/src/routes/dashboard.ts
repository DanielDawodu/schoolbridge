import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/', verifyToken, getDashboardStats);

export default router;
