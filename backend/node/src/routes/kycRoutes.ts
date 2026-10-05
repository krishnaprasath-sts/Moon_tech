import { Router } from 'express';
import { KycController } from '../controllers/kycController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { uploadKycDocuments } from '../middleware/upload.js';
import { UserRole } from '../types/index.js';
import {
  kycSubmitSchema,
  manualKycSubmitSchema,
  kycVerifySchema,
  kycRejectSchema,
  kycResubmitSchema,
} from '../validators/kycValidators.js';
import { kycFilterQuerySchema } from '../validators/queryValidators.js';

const router = Router();

// ==========================================
// CUSTOMER KYC ROUTES (/api/kyc)
// ==========================================
router.post(
  '/submit',
  authenticate,
  uploadKycDocuments,
  validate(kycSubmitSchema),
  KycController.submit
);

router.get('/status', authenticate, KycController.myStatus);

// ==========================================
// ADMIN KYC ROUTES (/api/admin/kyc)
// ==========================================
export const adminKycRouter = Router();

// List all KYC applications
adminKycRouter.get(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR),
  validate(kycFilterQuerySchema, 'query'),
  KycController.listSubmissions
);

// Manual submit KYC for a customer
adminKycRouter.post(
  '/manual-submit',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  uploadKycDocuments,
  validate(manualKycSubmitSchema),
  KycController.manualSubmit
);

// Get single KYC detail
adminKycRouter.get(
  '/:id',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR),
  KycController.getDetail
);

// Verify KYC (SUPER_ADMIN and ADMIN ONLY - EDITOR is forbidden)
adminKycRouter.post(
  '/:id/verify',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate(kycVerifySchema),
  KycController.verify
);

// Reject KYC (SUPER_ADMIN and ADMIN ONLY - EDITOR is forbidden)
adminKycRouter.post(
  '/:id/reject',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate(kycRejectSchema),
  KycController.reject
);

// Request KYC Resubmission (SUPER_ADMIN and ADMIN ONLY - EDITOR is forbidden)
adminKycRouter.post(
  '/:id/resubmit',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validate(kycResubmitSchema),
  KycController.resubmit
);

// View secure document file
adminKycRouter.get(
  '/:id/document/:type',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.CUSTOMER),
  KycController.getDocument
);

export default router;
