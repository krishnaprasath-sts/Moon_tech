import { Response, NextFunction } from 'express';
import { ReferralService } from '../services/referralService.js';
import { sendResponse } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';

export class ReferralController {
  public static async myReferrals(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const result = await ReferralService.getMyReferrals(userId);

      sendResponse({
        res,
        statusCode: 200,
        message: 'My referrals retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async adminReferrals(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ReferralService.getAllReferrals(req.query);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Referrals retrieved successfully',
        data: result.referrals,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
}
