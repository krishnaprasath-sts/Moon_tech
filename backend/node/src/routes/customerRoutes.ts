import { Router } from 'express';
import { CustomerController } from '../controllers/customerController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { UserRole } from '../types/index.js';
import { customerFilterQuerySchema } from '../validators/queryValidators.js';
import { updateCustomerStatusSchema, createCustomerSchema } from '../validators/authValidators.js';

const router = Router();

// Manually create customer (SUPER_ADMIN & ADMIN ONLY)
router.post(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate(createCustomerSchema),
  CustomerController.create
);

// List customers
router.get(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR),
  validate(customerFilterQuerySchema, 'query'),
  CustomerController.list
);

// Customer 360 profile
router.get(
  '/:id',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR),
  CustomerController.getDetail
);

// Update customer status (Activate / Suspend) - SUPER_ADMIN & ADMIN ONLY
router.patch(
  '/:id/status',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate(updateCustomerStatusSchema),
  CustomerController.updateStatus
);

export default router;
