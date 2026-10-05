import { Response } from 'express';

export interface ApiResponseOptions<T = any> {
  res: Response;
  statusCode?: number;
  success?: boolean;
  message?: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: any;
  };
}

export function sendResponse<T>({
  res,
  statusCode = 200,
  success = true,
  message = 'Success',
  data,
  meta,
}: ApiResponseOptions<T>): Response {
  return res.status(statusCode).json({
    success,
    message,
    data,
    meta,
  });
}

export function sendError(
  res: Response,
  statusCode = 500,
  message = 'Internal Server Error',
  errors?: any
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}
