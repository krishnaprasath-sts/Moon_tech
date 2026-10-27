import { z } from 'zod';
import { SupportTopic } from '../types/index.js';

const topicSchema = z.nativeEnum(SupportTopic, {
  errorMap: () => ({ message: 'Topic must be KYC, DEPOSIT, WITHDRAWAL or PLANS' }),
});

const messageSchema = z
  .string({ required_error: 'Message is required' })
  .trim()
  .min(2, 'Message must be at least 2 characters')
  .max(2000, 'Message cannot exceed 2000 characters');

// Customer: send a message to support
export const sendSupportMessageSchema = z.object({
  topic: topicSchema,
  message: messageSchema,
});

// Admin: reply inside a customer thread
export const supportReplySchema = z.object({
  topic: topicSchema,
  message: messageSchema,
});

// Empty query params arrive as '' from the browser; treat them as absent
const blankToUndefined = (v: unknown) => (v === '' || v === undefined ? undefined : v);
const optionalTopic = z.preprocess(blankToUndefined, topicSchema.optional());

export const supportListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  topic: optionalTopic,
});

export const supportThreadsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  topic: optionalTopic,
  status: z.preprocess(blankToUndefined, z.enum(['open', 'all']).optional()),
  search: z.string().trim().max(100).optional(),
});

export const supportThreadQuerySchema = z.object({
  topic: optionalTopic,
});

export type SendSupportMessageInput = z.infer<typeof sendSupportMessageSchema>;
export type SupportReplyInput = z.infer<typeof supportReplySchema>;
export type SupportListQuery = z.infer<typeof supportListQuerySchema>;
export type SupportThreadsQuery = z.infer<typeof supportThreadsQuerySchema>;
export type SupportThreadQuery = z.infer<typeof supportThreadQuerySchema>;

// ---------------------------------------------------------------------------
// Visitors (not signed in)
// ---------------------------------------------------------------------------
const guestTokenSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/, 'Invalid chat session');

// Visitor: send a message. The first message carries name / email / phone and returns a token;
// later messages send the token instead.
export const guestSendSchema = z
  .object({
    token: guestTokenSchema.optional(),
    name: z.string().trim().min(2, 'Enter your name').max(100, 'Name is too long').optional(),
    email: z.string().trim().toLowerCase().email('Enter a valid email address').max(255).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^(\+91)?[6-9][0-9]{9}$/, 'Enter a valid 10-digit mobile number')
      .optional()
      .or(z.literal('')),
    topic: topicSchema,
    message: messageSchema,
  })
  .superRefine((v, ctx) => {
    if (v.token) return;
    if (!v.name) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['name'], message: 'Enter your name' });
    if (!v.email) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Enter your email address' });
  });

// Visitor: read the conversation (token in the body so it never appears in URLs or logs)
export const guestThreadSchema = z.object({ token: guestTokenSchema });

export const guestThreadsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.preprocess(blankToUndefined, z.enum(['open', 'all']).optional()),
  search: z.string().trim().max(100).optional(),
});

export type GuestSendInput = z.infer<typeof guestSendSchema>;
export type GuestThreadsQuery = z.infer<typeof guestThreadsQuerySchema>;
