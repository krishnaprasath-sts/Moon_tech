import { Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboardService.js';
import { sendResponse } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';

export class DashboardController {
  public static async stats(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await DashboardService.getStats();

      sendResponse({
        res,
        statusCode: 200,
        message: 'Dashboard statistics retrieved successfully',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}
