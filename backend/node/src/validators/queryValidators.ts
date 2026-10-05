import { z } from 'zod';
import { KycStatus, UserStatus } from '../types/index.js';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
});

export const kycFilterQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(KycStatus).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const customerFilterQuerySchema = paginationQuerySchema.extend({
  kycStatus: z.nativeEnum(KycStatus).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});
