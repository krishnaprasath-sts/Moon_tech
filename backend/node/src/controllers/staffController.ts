import { Response, NextFunction } from 'express';
import { StaffService } from '../services/staffService.js';
import { sendResponse } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { BadRequestError } from '../utils/errors.js';

export class StaffController {
  /**
   * List all staff members
   */
  public static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const staff = await StaffService.listStaff();
      sendResponse({
        res,
        statusCode: 200,
        message: 'Staff members retrieved successfully',
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new staff operator
   */
  public static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const operatorId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const newStaff = await StaffService.createStaff(req.body, operatorId, ipAddress, userAgent);

      sendResponse({
        res,
        statusCode: 201,
        message: 'Staff member created successfully',
        data: newStaff,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update staff role (RBAC assignment)
   */
  public static async updateRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffId = parseInt(req.params.id, 10);
      if (isNaN(staffId)) {
        throw new BadRequestError('Invalid staff ID');
      }

      const operatorId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await StaffService.updateStaffRole(staffId, req.body.role, operatorId, ipAddress, userAgent);

      sendResponse({
        res,
        statusCode: 200,
        message: `Staff role updated to ${req.body.role}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update staff account status
   */
  public static async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffId = parseInt(req.params.id, 10);
      if (isNaN(staffId)) {
        throw new BadRequestError('Invalid staff ID');
      }

      const operatorId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await StaffService.updateStaffStatus(
        staffId,
        req.body.status,
        operatorId,
        req.body.reason,
        ipAddress,
        userAgent
      );

      sendResponse({
        res,
        statusCode: 200,
        message: `Staff status updated to ${req.body.status}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete staff member
   */
  public static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffId = parseInt(req.params.id, 10);
      if (isNaN(staffId)) {
        throw new BadRequestError('Invalid staff ID');
      }

      const operatorId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await StaffService.deleteStaff(staffId, operatorId, ipAddress, userAgent);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Staff member account deleted successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
