import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AuthenticatedRequest, JwtUserPayload, UserStatus } from '../types/index.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { User } from '../models/index.js';

export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication token missing or invalid');
    }

    let decoded: JwtUserPayload;
    try {
      decoded = jwt.verify(token, config.jwt.secret) as JwtUserPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Authentication token expired');
      }
      throw new UnauthorizedError('Invalid authentication token');
    }

    // Verify user still exists in database and is active
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'role', 'status'],
    });

    if (!user) {
      throw new UnauthorizedError('User associated with token no longer exists');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Your account has been suspended. Please contact support.');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenError('Your account is inactive. Please contact support.');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    next();
  } catch (error) {
    next(error);
  }
}
