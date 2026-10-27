import { Router } from 'express';
import { FinanceController } from '../controllers/financeController.js';
import { AdminFinanceController } from '../controllers/adminFinanceController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimiter.js';
import { uploadReceipt, uploadPaymentProof, uploadUpiQr } from '../middleware/upload.js';
import { UserRole } from '../types/index.js';
import {
  updateSettingsSchema,
  createDepositSchema,
  remarksSchema,
  rejectSchema,
  createInvestmentPlanSchema,
  updateInvestmentPlanSchema,
  planStatusSchema,
  planFeaturedSchema,
  investSchema,
  cancelInvestmentSchema,
  earlyWithdrawalSchema,
  requestWithdrawalSchema,
  walletWithdrawalSchema,
  approveWithdrawalSchema,
  completeWithdrawalSchema,
  walletAdjustmentSchema,
  updateProfileSchema,
  updatePayoutDetailsSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  announcementSchema,
} from '../validators/financeValidators.js';

const staff = authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR);
const managers = authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN);
const customer = authorize(UserRole.CUSTOMER);

// ---------------------------------------------------------------------------
// Password management (mounted under /auth)
// ---------------------------------------------------------------------------
export const passwordRouter = Router();
passwordRouter.post('/change-password', authenticate, validate(changePasswordSchema), FinanceController.changePassword);
passwordRouter.post('/forgot-password', authRateLimiter, passwordResetRateLimiter, validate(forgotPasswordSchema), FinanceController.forgotPassword);
passwordRouter.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), FinanceController.resetPassword);

// ---------------------------------------------------------------------------
// Customer routes
// ---------------------------------------------------------------------------
export const profileRouter = Router();
profileRouter.get('/', authenticate, FinanceController.getProfile);
profileRouter.put('/', authenticate, customer, validate(updateProfileSchema), FinanceController.updateProfile);
profileRouter.put(
  '/payout-details',
  authenticate,
  customer,
  validate(updatePayoutDetailsSchema),
  FinanceController.updatePayoutDetails
);

export const walletRouter = Router();
walletRouter.get('/', authenticate, customer, FinanceController.getWallet);
walletRouter.get('/transactions', authenticate, customer, FinanceController.getTransactions);
walletRouter.get('/deposits', authenticate, customer, FinanceController.getDeposits);
walletRouter.post(
  '/deposits',
  authenticate,
  customer,
  uploadReceipt,
  validate(createDepositSchema),
  FinanceController.createDeposit
);
walletRouter.get('/deposits/:id/receipt', authenticate, customer, FinanceController.getDepositReceipt);
// Withdraw free wallet balance (daily profit, referral commission, refunds) to bank / UPI
walletRouter.post(
  '/withdrawals',
  authenticate,
  customer,
  validate(walletWithdrawalSchema),
  FinanceController.requestWalletWithdrawal
);

export const investmentPlanRouter = Router();
investmentPlanRouter.get('/', FinanceController.getPlans);
investmentPlanRouter.get('/featured', FinanceController.getFeaturedPlans);

export const investmentRouter = Router();
investmentRouter.post('/preview', authenticate, validate(investSchema), FinanceController.previewInvestment);
investmentRouter.post('/', authenticate, customer, validate(investSchema), FinanceController.invest);
investmentRouter.get('/', authenticate, customer, FinanceController.getInvestments);
investmentRouter.get('/:id', authenticate, customer, FinanceController.getInvestment);
investmentRouter.post(
  '/:id/withdraw',
  authenticate,
  customer,
  validate(requestWithdrawalSchema),
  FinanceController.requestWithdrawal
);

export const withdrawalRouter = Router();
withdrawalRouter.get('/', authenticate, customer, FinanceController.getWithdrawals);
withdrawalRouter.get('/:id/proof', authenticate, customer, FinanceController.getWithdrawalProof);

// Files that must load without a login (used in <img> tags on the customer site)
export const publicRouter = Router();
publicRouter.get('/upi-qr/:file', FinanceController.getUpiQrImage);
// Login / registration pages read this before anyone signs in
publicRouter.get('/login-info', FinanceController.getLoginInfo);

export const notificationRouter = Router();
notificationRouter.get('/', authenticate, FinanceController.getNotifications);
notificationRouter.get('/unread-count', authenticate, FinanceController.getUnreadCount);
notificationRouter.post('/read-all', authenticate, FinanceController.markAllNotificationsRead);
notificationRouter.post('/:id/read', authenticate, FinanceController.markNotificationRead);

// ---------------------------------------------------------------------------
// Admin routes
// ---------------------------------------------------------------------------
export const adminFinanceRouter = Router();
adminFinanceRouter.use(authenticate);

// Dashboard & customer finance
adminFinanceRouter.get('/finance/dashboard', staff, AdminFinanceController.getDashboard);
adminFinanceRouter.get('/customers/:id/finance', staff, AdminFinanceController.getCustomerFinance);

// Settings (wallet limits, UPI details)
adminFinanceRouter.get('/settings', staff, AdminFinanceController.getSettings);
adminFinanceRouter.put('/settings', managers, validate(updateSettingsSchema), AdminFinanceController.updateSettings);
adminFinanceRouter.post('/settings/upi-qr', managers, uploadUpiQr, AdminFinanceController.uploadUpiQr);
adminFinanceRouter.delete('/settings/upi-qr', managers, AdminFinanceController.removeUpiQr);

// Payment management
adminFinanceRouter.get('/deposits', staff, AdminFinanceController.listDeposits);
adminFinanceRouter.get('/deposits/:id', staff, AdminFinanceController.getDeposit);
adminFinanceRouter.get('/deposits/:id/receipt', staff, AdminFinanceController.getDepositReceipt);
adminFinanceRouter.post(
  '/deposits/:id/approve',
  managers,
  validate(remarksSchema),
  AdminFinanceController.approveDeposit
);
adminFinanceRouter.post('/deposits/:id/reject', managers, validate(rejectSchema), AdminFinanceController.rejectDeposit);

// Investment plan management
adminFinanceRouter.get('/investment-plans', staff, AdminFinanceController.listPlans);
adminFinanceRouter.post(
  '/investment-plans',
  managers,
  validate(createInvestmentPlanSchema),
  AdminFinanceController.createPlan
);
adminFinanceRouter.put(
  '/investment-plans/:id',
  managers,
  validate(updateInvestmentPlanSchema),
  AdminFinanceController.updatePlan
);
adminFinanceRouter.patch(
  '/investment-plans/:id/status',
  managers,
  validate(planStatusSchema),
  AdminFinanceController.setPlanStatus
);
adminFinanceRouter.patch(
  '/investment-plans/:id/featured',
  managers,
  validate(planFeaturedSchema),
  AdminFinanceController.setPlanFeatured
);
adminFinanceRouter.delete('/investment-plans/:id', managers, AdminFinanceController.deletePlan);

// Investment management
adminFinanceRouter.get('/investments', staff, AdminFinanceController.listInvestments);
adminFinanceRouter.get('/investments/:id', staff, AdminFinanceController.getInvestment);
adminFinanceRouter.post(
  '/investments/:id/cancel',
  managers,
  validate(cancelInvestmentSchema),
  AdminFinanceController.cancelInvestment
);
adminFinanceRouter.patch(
  '/investments/:id/early-withdrawal',
  managers,
  validate(earlyWithdrawalSchema),
  AdminFinanceController.setEarlyWithdrawal
);

// Withdrawal management
adminFinanceRouter.get('/withdrawals', staff, AdminFinanceController.listWithdrawals);
adminFinanceRouter.get('/withdrawals/:id', staff, AdminFinanceController.getWithdrawal);
adminFinanceRouter.get('/withdrawals/:id/proof', staff, AdminFinanceController.getWithdrawalProof);
adminFinanceRouter.post(
  '/withdrawals/:id/approve',
  managers,
  validate(approveWithdrawalSchema),
  AdminFinanceController.approveWithdrawal
);
adminFinanceRouter.post(
  '/withdrawals/:id/reject',
  managers,
  validate(rejectSchema),
  AdminFinanceController.rejectWithdrawal
);
adminFinanceRouter.post(
  '/withdrawals/:id/complete',
  managers,
  uploadPaymentProof,
  validate(completeWithdrawalSchema),
  AdminFinanceController.completeWithdrawal
);

// Wallet ledger & adjustments
adminFinanceRouter.get('/wallets/transactions', staff, AdminFinanceController.listTransactions);
adminFinanceRouter.post(
  '/wallets/:userId/adjust',
  managers,
  validate(walletAdjustmentSchema),
  AdminFinanceController.adjustWallet
);

// Announcements
adminFinanceRouter.get('/announcements', staff, AdminFinanceController.listAnnouncements);
adminFinanceRouter.post(
  '/announcements',
  managers,
  validate(announcementSchema),
  AdminFinanceController.createAnnouncement
);

// Daily profit / referral commission payout job
adminFinanceRouter.get('/payouts/status', staff, AdminFinanceController.getPayoutStatus);
adminFinanceRouter.post('/payouts/run', managers, AdminFinanceController.runPayouts);

// Reports
adminFinanceRouter.get('/reports/:type', staff, AdminFinanceController.getReport);
