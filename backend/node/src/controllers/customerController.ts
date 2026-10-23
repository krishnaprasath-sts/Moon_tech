import { Response, NextFunction } from 'express';
import { CustomerService } from '../services/customerService.js';
import { sendResponse } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { BadRequestError } from '../utils/errors.js';

export class CustomerController {
  public static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await CustomerService.createCustomer(req.body, adminId, ipAddress, userAgent);

      sendResponse({
        res,
        statusCode: 201,
        message: 'Customer manually created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CustomerService.listCustomers(req.query);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Customers retrieved successfully',
        data: result.customers,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getDetail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = parseInt(req.params.id, 10);
      if (isNaN(customerId)) {
        throw new BadRequestError('Invalid Customer ID');
      }

      const result = await CustomerService.getCustomerById(customerId, req.user);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Customer details retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = parseInt(req.params.id, 10);
      const adminId = req.user!.id;
      const { status, reason } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (isNaN(customerId)) {
        throw new BadRequestError('Invalid Customer ID');
      }

      const result = await CustomerService.updateCustomerStatus(
        customerId,
        status,
        adminId,
        reason,
        ipAddress,
        userAgent
      );

      sendResponse({
        res,
        statusCode: 200,
        message: `Customer account status updated to ${status}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
