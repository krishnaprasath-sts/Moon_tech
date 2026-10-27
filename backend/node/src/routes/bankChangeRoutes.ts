import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { BankChangeController } from '../controllers/bankChangeController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { uploadBankProof } from '../middleware/upload.js';
import { UserRole } from '../types/index.js';
import { bankChangeListQuerySchema, bankChangeReviewSchema, createBankChangeSchema } from '../validators/bankChangeValidators.js';

const staff = authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR);
const managers = authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN);
const customer = authorize(UserRole.CUSTOMER);

// Password is checked on every request; slow down guessing through this form
const bankChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many bank change attempts. Please try again in 15 minutes.' },
});

// Customer: mounted under /profile/bank-change-requests
const router = Router();
router.get('/', authenticate, customer, BankChangeController.listMine);
router.post('/', authenticate, customer, bankChangeLimiter, uploadBankProof, validate(createBankChangeSchema), BankChangeController.create);
router.post('/:id/cancel', authenticate, customer, BankChangeController.cancel);

// Admin: mounted under /admin/bank-change-requests
export const adminBankChangeRouter = Router();
adminBankChangeRouter.use(authenticate);
adminBankChangeRouter.get('/', staff, validate(bankChangeListQuerySchema, 'query'), BankChangeController.list);
adminBankChangeRouter.get('/pending-count', staff, BankChangeController.pendingCount);
adminBankChangeRouter.get('/:id', staff, BankChangeController.get);
adminBankChangeRouter.get('/:id/proof', staff, BankChangeController.proof);
adminBankChangeRouter.post('/:id/approve', managers, validate(bankChangeReviewSchema), BankChangeController.approve);
adminBankChangeRouter.post('/:id/reject', managers, validate(bankChangeReviewSchema), BankChangeController.reject);

export default router;
