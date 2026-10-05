import { Response, NextFunction } from 'express';
import { ActivityLogService } from '../services/activityLogService.js';
import { sendResponse } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';

export class ActivityLogController {
  public static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ActivityLogService.getLogs(req.query);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Activity logs retrieved successfully',
        data: result.logs,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
}
