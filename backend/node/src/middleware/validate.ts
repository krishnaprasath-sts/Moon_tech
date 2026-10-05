import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

type RequestLocation = 'body' | 'query' | 'params';

export function validate(schema: ZodTypeAny, location: RequestLocation = 'body') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req[location]);
      req[location] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Input validation failed', formattedErrors));
      } else {
        next(error);
      }
    }
  };
}
