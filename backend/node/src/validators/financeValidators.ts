import { z } from 'zod';
import {
  ProfitType,
  ProfitPayoutMode,
  PayoutMethod,
  WalletTxnDirection,
  DepositMethod,
  RateBasis,
  WalletBucket,
} from '../types/index.js';
import { MAX_MONEY } from '../utils/money.js';

const hasMaxTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

/**
 * Rupee amount: positive, max 2 decimals. Coerced because multipart fields arrive as strings.
 */
const moneySchema = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .finite(`${label} must be a valid number`)
    .positive(`${label} must be greater than 0`)
    .max(MAX_MONEY, `${label} is too large`)
    .refine(hasMaxTwoDecimals, `${label} supports a maximum of 2 decimal places`);

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export const updateSettingsSchema = z
  .object({
    walletMinTopup: moneySchema('Minimum wallet top-up').optional(),
    walletMaxTopup: moneySchema('Maximum wallet top-up').optional(),
    upiId: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/, 'Invalid UPI ID (e.g. business@upi)')
      .optional(),
    upiPayeeName: z.string().trim().min(2, 'Payee name must be at least 2 characters').max(100).optional(),
    depositInstructions: z.string().trim().min(5).max(1000).optional(),
    // Bank transfer destination; empty strings clear the fields
    bankAccountName: z.string().trim().max(100).optional(),
    bankAccountNumber: z
      .string()
      .trim()
      .regex(/^(|[0-9]{9,18})$/, 'Account number must be 9-18 digits')
      .optional(),
    bankIfsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^(|[A-Z]{4}0[A-Z0-9]{6})$/, 'Invalid IFSC code (e.g. SBIN0001234)')
      .optional(),
    bankName: z.string().trim().max(100).optional(),
    bankTransferInstructions: z.string().trim().min(5).max(1000).optional(),
    requireKycForInvestment: z.boolean().optional(),
    requireKycForWithdrawal: z.boolean().optional(),
    walletMinWithdrawal: moneySchema('Minimum wallet withdrawal').optional(),
    referralCommissionPercent: z.coerce
      .number({ invalid_type_error: 'Referral commission must be a number' })
      .finite()
      .min(0, 'Referral commission cannot be negative')
      .max(100, 'Referral commission cannot exceed 100%')
      .refine(hasMaxTwoDecimals, 'Referral commission supports a maximum of 2 decimal places')
      .optional(),
    capitalWithdrawalFeePercent: z.coerce
      .number({ invalid_type_error: 'Capital withdrawal fee must be a number' })
      .finite()
      .min(0, 'Capital withdrawal fee cannot be negative')
      .max(100, 'Capital withdrawal fee cannot exceed 100%')
      .refine(hasMaxTwoDecimals, 'Capital withdrawal fee supports a maximum of 2 decimal places')
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one setting must be provided');

// ---------------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------------
export const createDepositSchema = z.object({
  amount: moneySchema('Amount'),
  // Only bank transfers (NEFT / IMPS / RTGS) are accepted; UPI is kept in the enum for old records
  paymentMethod: z
    .nativeEnum(DepositMethod)
    .optional()
    .default(DepositMethod.BANK_TRANSFER)
    .refine((m): boolean => m === DepositMethod.BANK_TRANSFER, 'UPI payments are not accepted. Please pay by bank transfer.'),
  // Bank transfer reference number (UTR / RRN)
  upiTransactionId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{8,35}$/, 'Transaction reference must be 8-35 letters/digits without spaces')
    .transform((value) => value.toUpperCase()),
});

export const remarksSchema = z.object({
  remarks: optionalText(1000),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(5, 'Rejection reason must be at least 5 characters').max(1000),
  remarks: optionalText(1000),
});

// ---------------------------------------------------------------------------
// Investment plans
// ---------------------------------------------------------------------------
const planFields = {
  name: z.string().trim().min(2, 'Plan name must be at least 2 characters').max(100),
  description: optionalText(2000),
  minAmount: moneySchema('Minimum investment'),
  maxAmount: moneySchema('Maximum investment'),
  // 0 = open-ended: runs until the customer withdraws the capital (daily-profit plans only)
  durationDays: z.coerce
    .number()
    .int('Investment period must be a whole number of days')
    .min(0, 'Investment period cannot be negative')
    .max(3650, 'Investment period cannot exceed 3650 days'),
  lockInDays: z.coerce
    .number()
    .int('Lock-in period must be a whole number of days')
    .min(0, 'Lock-in period cannot be negative')
    .max(3650, 'Lock-in period cannot exceed 3650 days')
    .optional(),
  profitType: z.nativeEnum(ProfitType, { errorMap: () => ({ message: 'Profit type must be PERCENTAGE or FIXED' }) }),
  profitValue: moneySchema('Profit value'),
  payoutMode: z
    .nativeEnum(ProfitPayoutMode, { errorMap: () => ({ message: 'Payout mode must be AT_MATURITY or DAILY' }) })
    .optional(),
  rateBasis: z
    .nativeEnum(RateBasis, { errorMap: () => ({ message: 'Rate basis must be PER_MONTH, PER_YEAR or PER_DAY' }) })
    .optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  featuredTagline: optionalText(160),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
};

export const createInvestmentPlanSchema = z.object(planFields);

export const updateInvestmentPlanSchema = z
  .object({
    name: planFields.name.optional(),
    description: planFields.description,
    minAmount: planFields.minAmount.optional(),
    maxAmount: planFields.maxAmount.optional(),
    durationDays: planFields.durationDays.optional(),
    lockInDays: planFields.lockInDays,
    profitType: planFields.profitType.optional(),
    profitValue: planFields.profitValue.optional(),
    payoutMode: planFields.payoutMode,
    rateBasis: planFields.rateBasis,
    isActive: planFields.isActive,
    isFeatured: planFields.isFeatured,
    featuredTagline: planFields.featuredTagline,
    sortOrder: planFields.sortOrder,
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export const planStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive flag is required' }),
});

export const planFeaturedSchema = z.object({
  isFeatured: z.boolean({ required_error: 'isFeatured flag is required' }),
  featuredTagline: optionalText(160),
});

// ---------------------------------------------------------------------------
// Investments
// ---------------------------------------------------------------------------
export const investSchema = z.object({
  planId: z.coerce.number().int().positive('Valid planId is required'),
  amount: moneySchema('Investment amount'),
  // Which wallet balance pays for the investment. Profit that is re-invested becomes capital.
  source: z
    .nativeEnum(WalletBucket, { errorMap: () => ({ message: 'Source must be CAPITAL or PROFIT' }) })
    .optional()
    .default(WalletBucket.CAPITAL),
});

export const cancelInvestmentSchema = z.object({
  reason: z.string().trim().min(5, 'Cancellation reason must be at least 5 characters').max(1000),
});

export const earlyWithdrawalSchema = z.object({
  allowed: z.boolean({ required_error: 'allowed flag is required' }),
});

// ---------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------
export const requestWithdrawalSchema = z.object({
  payoutMethod: z.nativeEnum(PayoutMethod).optional(),
});

export const walletWithdrawalSchema = z
  .object({
    // PROFIT: any amount, no fee. CAPITAL: the whole available capital balance, less the fee.
    bucket: z
      .nativeEnum(WalletBucket, { errorMap: () => ({ message: 'Bucket must be CAPITAL or PROFIT' }) })
      .optional()
      .default(WalletBucket.PROFIT),
    amount: moneySchema('Withdrawal amount').optional(),
    payoutMethod: z.nativeEnum(PayoutMethod).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.bucket === WalletBucket.PROFIT && value.amount === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'Withdrawal amount is required' });
    }
  });

export const approveWithdrawalSchema = z.object({
  remarks: optionalText(1000),
  // Only honoured for early withdrawals, where profit is at the admin's discretion
  profitAmount: z.coerce
    .number()
    .finite()
    .min(0, 'Profit amount cannot be negative')
    .max(MAX_MONEY)
    .refine(hasMaxTwoDecimals, 'Profit amount supports a maximum of 2 decimal places')
    .optional(),
});

export const completeWithdrawalSchema = z.object({
  paymentReference: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9/_-]{6,50}$/, 'Payment reference must be 6-50 letters/digits')
    .transform((value) => value.toUpperCase()),
  remarks: optionalText(1000),
});

// ---------------------------------------------------------------------------
// Wallet adjustment
// ---------------------------------------------------------------------------
export const walletAdjustmentSchema = z.object({
  direction: z.nativeEnum(WalletTxnDirection, {
    errorMap: () => ({ message: 'Direction must be CREDIT or DEBIT' }),
  }),
  bucket: z
    .nativeEnum(WalletBucket, { errorMap: () => ({ message: 'Bucket must be CAPITAL or PROFIT' }) })
    .optional()
    .default(WalletBucket.PROFIT),
  amount: moneySchema('Adjustment amount'),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
});

// ---------------------------------------------------------------------------
// Profile & payout details
// ---------------------------------------------------------------------------
export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(255).optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD')
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
      }, 'Date of birth must be a valid past date')
      .optional()
      .nullable(),
    address: optionalText(500),
    city: optionalText(100),
    state: optionalText(100),
    pincode: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/, 'Pincode must be 6 digits')
      .optional()
      .nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export const updatePayoutDetailsSchema = z
  .object({
    // Payouts go to a bank account only; UPI stays in the enum for old records
    preferredMethod: z
      .nativeEnum(PayoutMethod, {
        errorMap: () => ({ message: 'Preferred method must be BANK' }),
      })
      .refine((m): boolean => m === PayoutMethod.BANK, 'Withdrawals are paid to your bank account only.'),
    upiId: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/, 'Invalid UPI ID (e.g. name@bank)')
      .optional()
      .nullable(),
    accountHolderName: z.string().trim().min(2).max(255).optional().nullable(),
    accountNumber: z
      .string()
      .trim()
      .regex(/^[0-9]{8,25}$/, 'Bank account number must be 8 to 25 digits')
      .optional()
      .nullable(),
    ifscCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, 'Invalid IFSC code (e.g. HDFC0001234)')
      .transform((value) => value.toUpperCase())
      .optional()
      .nullable(),
    bankName: optionalText(100),
  })
  .superRefine((value, ctx) => {
    if (value.preferredMethod === PayoutMethod.UPI && !value.upiId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['upiId'], message: 'UPI ID is required for UPI payouts' });
    }
  });

// ---------------------------------------------------------------------------
// Password management
// ---------------------------------------------------------------------------
const newPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(100)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: newPasswordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

// Password resets are email-only: the code is delivered to the registered email address
const resetEmailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email address is required')
  .max(255)
  .email('Enter a valid email address');

export const forgotPasswordSchema = z.object({
  email: resetEmailField,
});

export const resetPasswordSchema = z.object({
  email: resetEmailField,
  otp: z.string().trim().regex(/^[0-9]{6}$/, 'OTP must be 6 digits'),
  newPassword: newPasswordSchema,
});

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
export const announcementSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  message: z.string().trim().min(5, 'Message must be at least 5 characters').max(2000),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type CreateDepositInput = z.infer<typeof createDepositSchema>;
export type CreateInvestmentPlanInput = z.infer<typeof createInvestmentPlanSchema>;
export type UpdateInvestmentPlanInput = z.infer<typeof updateInvestmentPlanSchema>;
export type InvestInput = z.infer<typeof investSchema>;
export type RequestWithdrawalInput = z.infer<typeof requestWithdrawalSchema>;
export type WalletWithdrawalInput = z.infer<typeof walletWithdrawalSchema>;
export type ApproveWithdrawalInput = z.infer<typeof approveWithdrawalSchema>;
export type CompleteWithdrawalInput = z.infer<typeof completeWithdrawalSchema>;
export type WalletAdjustmentInput = z.infer<typeof walletAdjustmentSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePayoutDetailsInput = z.infer<typeof updatePayoutDetailsSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AnnouncementInput = z.infer<typeof announcementSchema>;
