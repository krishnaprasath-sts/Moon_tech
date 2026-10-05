import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import multer from 'multer';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Multer errors
  if (err instanceof multer.MulterError) {
    logger.warn(`Multer upload error: ${err.message}`, { code: err.code, path: req.path });
    res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
      code: err.code,
    });
    return;
  }

  // CORS rejections
  if (typeof err.message === 'string' && err.message.includes('not allowed by CORS')) {
    res.status(403).json({ success: false, message: err.message });
    return;
  }

  // Sequelize Unique Constraint Error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const fields = err.errors ? err.errors.map((e: any) => e.path).join(', ') : 'field';
    logger.warn(`Sequelize Unique Constraint: ${fields} already exists`);
    res.status(409).json({
      success: false,
      message: `A record with the given ${fields} already exists`,
      fields,
    });
    return;
  }

  // Sequelize Validation Error
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors ? err.errors.map((e: any) => ({ field: e.path, message: e.message })) : [];
    logger.warn(`Sequelize Validation Error: ${err.message}`);
    res.status(422).json({
      success: false,
      message: 'Database validation error',
      errors,
    });
    return;
  }

  // Application Operational Errors
  if (err instanceof AppError) {
    logger.warn(`AppError [${err.statusCode}]: ${err.message}`, {
      url: req.originalUrl,
      method: req.method,
      errors: err.errors,
    });
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  // Unhandled / 500 Internal Errors
  logger.error(`Unhandled Server Error: ${err.message}`, err);
  res.status(500).json({
    success: false,
    message: config.isDev ? err.message : 'An unexpected internal server error occurred',
    ...(config.isDev ? { stack: err.stack } : {}),
  });
}
