import { z } from 'zod';
import { UserStatus } from '../types/index.js';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').max(255),
  email: z.string().email('Invalid email address').max(255),
  phone: z
    .string()
    .regex(/^[0-9+ -]{10,15}$/, 'Invalid phone number format (10-15 digits)'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100)
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  referralNumber: z.string().optional().nullable(),
});

export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').max(255),
  email: z.string().email('Invalid email address').max(255),
  phone: z
    .string()
    .regex(/^[0-9+ -]{10,15}$/, 'Invalid phone number format (10-15 digits)'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters long')
    .max(100)
    .optional(),
  referralNumber: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
});

export const updateCustomerStatusSchema = z.object({
  status: z.nativeEnum(UserStatus, {
    errorMap: () => ({ message: 'Invalid user status' }),
  }),
  reason: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateCustomerStatusInput = z.infer<typeof updateCustomerStatusSchema>;
