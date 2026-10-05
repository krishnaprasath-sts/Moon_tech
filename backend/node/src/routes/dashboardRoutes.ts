import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { UserRole } from '../types/index.js';

const router = Router();

router.get(
  '/stats',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR),
  DashboardController.stats
);

export default router;
