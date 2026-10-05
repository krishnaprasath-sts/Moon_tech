import { Response, NextFunction } from 'express';
import { KycService } from '../services/kycService.js';
import { sendResponse } from '../utils/response.js';
import { AuthenticatedRequest, UserRole } from '../types/index.js';
import { BadRequestError } from '../utils/errors.js';
import fs from 'fs';

export class KycController {
  /**
   * Customer submits KYC documents and details
   */
  public static async submit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await KycService.submitKyc(userId, req.body, files, ipAddress, userAgent);

      sendResponse({
        res,
        statusCode: 200,
        message: 'KYC details submitted successfully and is now pending review',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Customer views own KYC status
   */
  public static async myStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const kyc = await KycService.getMyKyc(userId);

      sendResponse({
        res,
        statusCode: 200,
        message: 'KYC status retrieved successfully',
        data: kyc,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin lists KYC submissions with pagination and status filters
   */
  public static async listSubmissions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await KycService.listKycSubmissions(req.query);

      res.status(200).json({
        success: true,
        message: 'KYC submissions retrieved successfully',
        data: result.kycSubmissions,
        counts: result.counts,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin manually creates/submits or verifies KYC for a customer
   */
  public static async manualSubmit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await KycService.manualSubmitKyc(adminId, req.body, files, ipAddress, userAgent);

      sendResponse({
        res,
        statusCode: 200,
        message: `KYC for customer #${req.body.customerId} submitted successfully (${result.status})`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin retrieves single KYC record by ID
   */
  public static async getDetail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kycId = parseInt(req.params.id, 10);
      if (isNaN(kycId)) {
        throw new BadRequestError('Invalid KYC ID');
      }

      const result = await KycService.getKycById(kycId);

      sendResponse({
        res,
        statusCode: 200,
        message: 'KYC details retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin verifies KYC
   */
  public static async verify(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kycId = parseInt(req.params.id, 10);
      const adminId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (isNaN(kycId)) {
        throw new BadRequestError('Invalid KYC ID');
      }

      const result = await KycService.verifyKyc(kycId, adminId, req.body, ipAddress, userAgent);

      sendResponse({
        res,
        statusCode: 200,
        message: 'KYC verified successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin rejects KYC
   */
  public static async reject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kycId = parseInt(req.params.id, 10);
      const adminId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (isNaN(kycId)) {
        throw new BadRequestError('Invalid KYC ID');
      }

      const result = await KycService.rejectKyc(kycId, adminId, req.body, ipAddress, userAgent);

      sendResponse({
        res,
        statusCode: 200,
        message: 'KYC rejected successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin requests KYC resubmission
   */
  public static async resubmit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kycId = parseInt(req.params.id, 10);
      const adminId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (isNaN(kycId)) {
        throw new BadRequestError('Invalid KYC ID');
      }

      const result = await KycService.requestResubmission(kycId, adminId, req.body, ipAddress, userAgent);

      sendResponse({
        res,
        statusCode: 200,
        message: 'KYC resubmission requested successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Securely streams uploaded document file with authentication & role checks
   */
  public static async getDocument(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kycId = parseInt(req.params.id, 10);
      const documentType = req.params.type as 'passbook' | 'pan' | 'aadhaar';
      const requestingUser = req.user!;

      if (isNaN(kycId)) {
        throw new BadRequestError('Invalid KYC ID');
      }

      if (!['passbook', 'pan', 'aadhaar'].includes(documentType)) {
        throw new BadRequestError('Invalid document type requested');
      }

      const { fullPath, mimeType } = await KycService.getSecureDocument(kycId, documentType, requestingUser);

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${documentType}_doc"`);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }
}
