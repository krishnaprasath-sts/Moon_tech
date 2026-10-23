import { Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { sendResponse } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';

export class AuthController {
  public static async register(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.register(req.body, ipAddress, userAgent);

      sendResponse({
        res,
        statusCode: 201,
        message: 'Account registered successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async login(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.login(req.body, ipAddress, userAgent);

      // Customers get a code by email first; the session is issued by verifyLoginOtp
      if ('otpRequired' in result) {
        sendResponse({
          res,
          statusCode: 200,
          message: `A 6-digit verification code has been sent to ${result.email}. It is valid for 2 minutes.`,
          data: result,
        });
        return;
      }

      // Set auth cookie
      res.cookie('token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });

      sendResponse({
        res,
        statusCode: 200,
        message: 'Logged in successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async verifyLoginOtp(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await AuthService.verifyLoginOtp(req.body, ipAddress, userAgent);

      res.cookie('token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });

      sendResponse({ res, statusCode: 200, message: 'Logged in successfully', data: result });
    } catch (error) {
      next(error);
    }
  }

  public static async resendLoginOtp(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await AuthService.resendLoginOtp(req.body, ipAddress, userAgent);
      sendResponse({
        res,
        statusCode: 200,
        message: `A new verification code has been sent to ${result.email}. It is valid for 2 minutes.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const user = await AuthService.getCurrentUser(userId);

      sendResponse({
        res,
        statusCode: 200,
        message: 'User profile fetched successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async logout(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie('token');
      sendResponse({
        res,
        statusCode: 200,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
