import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types/index.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

/**
 * RBAC authorization middleware
 * @param allowedRoles List of UserRole permitted to access the route
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('User is not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Role '${req.user.role}' is not authorized to perform this action. Required: [${allowedRoles.join(', ')}]`
        )
      );
    }

    next();
  };
}
