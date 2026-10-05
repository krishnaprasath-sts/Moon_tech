import { Router } from 'express';
import { StaffController } from '../controllers/staffController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { UserRole } from '../types/index.js';
import {
  createStaffSchema,
  updateStaffRoleSchema,
  updateStaffStatusSchema,
} from '../validators/staffValidators.js';

const router = Router();

// All staff endpoints require authentication
router.use(authenticate);

// List staff members (Admins and Super Admins can view)
router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  StaffController.list
);

// Create new staff member (Super Admin and Admin can create staff)
router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate(createStaffSchema),
  StaffController.create
);

// Update staff role (Super Admin only can edit/assign RBAC roles)
router.put(
  '/:id/role',
  authorize(UserRole.SUPER_ADMIN),
  validate(updateStaffRoleSchema),
  StaffController.updateRole
);

// Update staff status (Super Admin and Admin)
router.put(
  '/:id/status',
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate(updateStaffStatusSchema),
  StaffController.updateStatus
);

// Delete staff account (Super Admin only)
router.delete(
  '/:id',
  authorize(UserRole.SUPER_ADMIN),
  StaffController.delete
);

export default router;
