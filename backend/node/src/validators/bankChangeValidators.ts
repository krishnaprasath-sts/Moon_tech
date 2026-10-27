import { z } from 'zod';
import { BankChangeStatus } from '../types/index.js';

const blankToUndefined = (v: unknown) => (v === '' || v === undefined || v === null ? undefined : v);

// Customer: ask to replace the payout bank account (multipart form; proof file is "proof")
export const createBankChangeSchema = z
  .object({
    accountHolderName: z
      .string({ required_error: 'Account holder name is required' })
      .trim()
      .min(2, 'Account holder name must be at least 2 characters')
      .max(255),
    accountNumber: z
      .string({ required_error: 'Account number is required' })
      .trim()
      .regex(/^[0-9]{8,25}$/, 'Bank account number must be 8 to 25 digits'),
    confirmAccountNumber: z.string({ required_error: 'Re-enter the account number' }).trim(),
    ifscCode: z
      .string({ required_error: 'IFSC code is required' })
      .trim()
      .regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, 'Invalid IFSC code (e.g. HDFC0001234)')
      .transform((v) => v.toUpperCase()),
    bankName: z.string({ required_error: 'Bank name is required' }).trim().min(2, 'Enter the bank name').max(100),
    bankBranch: z.string({ required_error: 'Branch is required' }).trim().min(2, 'Enter the branch').max(100),
    reason: z.preprocess(blankToUndefined, z.string().trim().max(500).optional()),
    currentPassword: z.string({ required_error: 'Enter your password to confirm' }).min(1, 'Enter your password to confirm'),
  })
  .refine((v) => v.accountNumber === v.confirmAccountNumber, {
    path: ['confirmAccountNumber'],
    message: 'Account numbers do not match',
  });

export const bankChangeListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.preprocess(blankToUndefined, z.nativeEnum(BankChangeStatus).optional()),
  search: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
});

export const bankChangeReviewSchema = z.object({
  remarks: z.preprocess(blankToUndefined, z.string().trim().max(500).optional()),
});

export type CreateBankChangeInput = z.infer<typeof createBankChangeSchema>;
export type BankChangeListQuery = z.infer<typeof bankChangeListQuerySchema>;
export type BankChangeReviewInput = z.infer<typeof bankChangeReviewSchema>;
