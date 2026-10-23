import { Router } from 'express';
import { ReferralController } from '../controllers/referralController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { UserRole } from '../types/index.js';
import { paginationQuerySchema } from '../validators/queryValidators.js';

const router = Router();

// Customer gets own referrals
router.get('/my', authenticate, ReferralController.myReferrals);

// Admin gets all referrals
export const adminReferralRouter = Router();
adminReferralRouter.get(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR),
  validate(paginationQuerySchema, 'query'),
  ReferralController.adminReferrals
);

// Admin: referral commission ledger (PENDING / CREDITED / CANCELLED)
adminReferralRouter.get(
  '/commissions',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR),
  ReferralController.adminCommissions
);

export default router;
