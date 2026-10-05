import { z } from 'zod';
import { UserRole, UserStatus } from '../types/index.js';

export const createStaffSchema = z.object({
  email: z.string().email('Invalid email address'),
  phone: z.string().min(8, 'Phone number must be at least 8 digits').max(20),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  role: z.enum([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR]),
});

export const updateStaffRoleSchema = z.object({
  role: z.enum([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR]),
});

export const updateStaffStatusSchema = z.object({
  status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.INACTIVE]),
  reason: z.string().max(255).optional(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>;
export type UpdateStaffStatusInput = z.infer<typeof updateStaffStatusSchema>;
