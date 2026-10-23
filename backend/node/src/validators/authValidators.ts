import { z } from 'zod';
import { UserStatus } from '../types/index.js';

/** Empty strings from optional form inputs are treated as "not provided" */
const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]*$/;
/** Indian mobile number: optional +91 / 91 / 0 prefix, then 10 digits starting with 6-9. Spaces and dashes are stripped first. */
export const INDIAN_MOBILE_PATTERN = /^(?:\+?91|0)?[6-9][0-9]{9}$/;
/** Referral codes are generated as 4 letters + 4 digits (see AuthService.generateUniqueReferralCode) */
export const REFERRAL_CODE_PATTERN = /^[A-Z]{4}[0-9]{4}$/;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
const PLACE_PATTERN = /^[A-Za-z][A-Za-z .'-]*$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const MIN_CUSTOMER_AGE = 18;
export const MAX_CUSTOMER_AGE = 120;

export function ageOn(dateOfBirth: Date, on: Date = new Date()): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const hadBirthday =
    on.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (on.getUTCMonth() === dateOfBirth.getUTCMonth() && on.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!hadBirthday) age -= 1;
  return age;
}

const nameField = z
  .string({ required_error: 'Full name is required' })
  .trim()
  .min(2, 'Name must be at least 2 characters long')
  .max(100, 'Name cannot be longer than 100 characters')
  .regex(NAME_PATTERN, 'Name can only contain letters, spaces, dots, apostrophes and hyphens');

const emailField = z
  .string({ required_error: 'Email address is required' })
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .max(255, 'Email cannot be longer than 255 characters');

const phoneField = z
  .string({ required_error: 'Phone number is required' })
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(INDIAN_MOBILE_PATTERN, 'Enter a valid 10-digit Indian mobile number (starts with 6-9, optional +91)'));

const passwordRules = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(100, 'Password cannot be longer than 100 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .refine((v) => !/\s/.test(v), 'Password cannot contain spaces');

const referralField = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(REFERRAL_CODE_PATTERN, 'Referral code must be 4 letters followed by 4 digits (e.g. RAHU1001)')
    .optional()
    .nullable()
);

const dateOfBirthField = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .regex(ISO_DATE_PATTERN, 'Date of birth must be in YYYY-MM-DD format')
    .refine((v) => {
      const d = new Date(`${v}T00:00:00.000Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, 'Date of birth is not a valid calendar date')
    .refine((v) => new Date(`${v}T00:00:00.000Z`).getTime() <= Date.now(), 'Date of birth cannot be in the future')
    .refine((v) => ageOn(new Date(`${v}T00:00:00.000Z`)) >= MIN_CUSTOMER_AGE, `Customer must be at least ${MIN_CUSTOMER_AGE} years old`)
    .refine((v) => ageOn(new Date(`${v}T00:00:00.000Z`)) <= MAX_CUSTOMER_AGE, 'Date of birth is not realistic')
    .optional()
    .nullable()
);

const placeField = (label: string) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .min(2, `${label} must be at least 2 characters long`)
      .max(100, `${label} cannot be longer than 100 characters`)
      .regex(PLACE_PATTERN, `${label} can only contain letters, spaces, dots, apostrophes and hyphens`)
      .optional()
      .nullable()
  );

/**
 * Public self-registration ("Open Investor Account" on the customer site). Same field rules as the
 * admin form, plus: a referral code is mandatory, the password must be typed twice, and the terms
 * must be accepted.
 */
export const registerSchema = z
  .object({
    name: nameField,
    email: emailField,
    phone: phoneField,
    password: passwordRules,
    confirmPassword: z.string({ required_error: 'Please confirm your password' }),
    referralNumber: z
      .string({ required_error: 'Referral code is required' })
      .trim()
      .toUpperCase()
      .min(1, 'Referral code is required')
      .regex(REFERRAL_CODE_PATTERN, 'Referral code must be 4 letters followed by 4 digits (e.g. RAHU1001)'),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms and conditions to open an account' }),
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

/** Second step of the customer login: the 6-digit code emailed after a correct password */
export const loginOtpVerifySchema = z.object({
  challengeId: z.string().trim().regex(/^[a-f0-9]{32,64}$/, 'Invalid login session. Please sign in again.'),
  otp: z.string().trim().regex(/^[0-9]{6}$/, 'Enter the 6-digit code from your email'),
});

export const loginOtpResendSchema = z.object({
  challengeId: z.string().trim().regex(/^[a-f0-9]{32,64}$/, 'Invalid login session. Please sign in again.'),
});

/** Admin "Add Customer" form. Optional fields may be omitted, null or empty strings. */
export const createCustomerSchema = z.object({
  name: nameField,
  email: emailField,
  phone: phoneField,
  // Optional: when blank the service assigns the default initial password
  password: z.preprocess(emptyToUndefined, passwordRules.optional()),
  referralNumber: referralField,
  dateOfBirth: dateOfBirthField,
  address: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .min(5, 'Address must be at least 5 characters long')
      .max(255, 'Address cannot be longer than 255 characters')
      .optional()
      .nullable()
  ),
  city: placeField('City'),
  state: placeField('State'),
  pincode: z.preprocess(
    emptyToUndefined,
    z.string().trim().regex(PINCODE_PATTERN, 'Pincode must be 6 digits and cannot start with 0').optional().nullable()
  ),
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
export type LoginOtpVerifyInput = z.infer<typeof loginOtpVerifySchema>;
export type LoginOtpResendInput = z.infer<typeof loginOtpResendSchema>;
export type UpdateCustomerStatusInput = z.infer<typeof updateCustomerStatusSchema>;
