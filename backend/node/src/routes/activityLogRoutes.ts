import { Router } from 'express';
import { ActivityLogController } from '../controllers/activityLogController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { UserRole } from '../types/index.js';
import { paginationQuerySchema } from '../validators/queryValidators.js';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR),
  validate(paginationQuerySchema, 'query'),
  ActivityLogController.list
);

export default router;
