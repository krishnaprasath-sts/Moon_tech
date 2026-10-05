import { Response, NextFunction, RequestHandler } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { BadRequestError } from './errors.js';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

type AsyncHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;

/**
 * Wraps an async controller so rejected promises reach the error handler
 */
export function asyncHandler(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    handler(req as AuthenticatedRequest, res, next).catch(next);
  };
}

export function getRequestMeta(req: AuthenticatedRequest): RequestMeta {
  return {
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

export function parseIdParam(value: string | undefined, label = 'ID'): number {
  const id = Number(value);
  if (!value || !Number.isInteger(id) || id <= 0) {
    throw new BadRequestError(`Invalid ${label}`);
  }
  return id;
}

export function getPagination(params: { page?: unknown; limit?: unknown }, defaultLimit = 10) {
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit)) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export function buildMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
