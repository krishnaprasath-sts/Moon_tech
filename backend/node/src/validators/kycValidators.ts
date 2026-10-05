import { z } from 'zod';
import { KycStatus } from '../types/index.js';

export const kycSubmitSchema = z.object({
  pan: z
    .string()
    .min(10, 'PAN must be exactly 10 characters')
    .max(10, 'PAN must be exactly 10 characters')
    .regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/, 'Invalid PAN number format (e.g. ABCDE1234F)'),
  aadhaarReference: z
    .string()
    .min(4, 'Aadhaar reference must be at least 4 digits')
    .max(20, 'Aadhaar reference is too long'),
  accountNumber: z
    .string()
    .min(8, 'Bank account number must be at least 8 digits')
    .max(25, 'Bank account number is too long')
    .regex(/^[0-9]+$/, 'Bank account number must contain only digits'),
  accountHolderName: z
    .string()
    .min(2, 'Account holder name must be at least 2 characters')
    .max(255),
  ifsc: z
    .string()
    .min(11, 'IFSC code must be 11 characters')
    .max(11, 'IFSC code must be 11 characters')
    .regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, 'Invalid IFSC format (e.g. HDFC0001234)'),
});

export const manualKycSubmitSchema = z.object({
  customerId: z.coerce.number().positive('Valid customer ID is required'),
  pan: z
    .string()
    .min(10, 'PAN must be exactly 10 characters')
    .max(10, 'PAN must be exactly 10 characters')
    .regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/, 'Invalid PAN number format (e.g. ABCDE1234F)'),
  aadhaarReference: z
    .string()
    .min(4, 'Aadhaar reference must be at least 4 digits')
    .max(20, 'Aadhaar reference is too long'),
  accountNumber: z
    .string()
    .min(8, 'Bank account number must be at least 8 digits')
    .max(25, 'Bank account number is too long')
    .regex(/^[0-9]+$/, 'Bank account number must contain only digits'),
  accountHolderName: z
    .string()
    .min(2, 'Account holder name must be at least 2 characters')
    .max(255),
  ifsc: z
    .string()
    .min(11, 'IFSC code must be 11 characters')
    .max(11, 'IFSC code must be 11 characters')
    .regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, 'Invalid IFSC format (e.g. HDFC0001234)'),
  status: z.enum([KycStatus.PENDING, KycStatus.VERIFIED]).default(KycStatus.PENDING).optional(),
  remarks: z.string().max(500).optional().nullable(),
});

export const kycVerifySchema = z.object({
  remarks: z.string().max(500).optional().nullable(),
});

export const kycRejectSchema = z.object({
  rejectionReason: z
    .string()
    .min(5, 'Rejection reason must be at least 5 characters long')
    .max(1000),
  remarks: z.string().max(500).optional().nullable(),
});

export const kycResubmitSchema = z.object({
  remarks: z
    .string()
    .min(5, 'Resubmission instructions/remarks must be at least 5 characters')
    .max(1000),
});

export type KycSubmitInput = z.infer<typeof kycSubmitSchema>;
export type ManualKycSubmitInput = z.infer<typeof manualKycSubmitSchema>;
export type KycVerifyInput = z.infer<typeof kycVerifySchema>;
export type KycRejectInput = z.infer<typeof kycRejectSchema>;
export type KycResubmitInput = z.infer<typeof kycResubmitSchema>;
