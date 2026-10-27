import { Router } from 'express';
import { runHealthChecks } from '../utils/healthChecks.js';
import authRoutes from './authRoutes.js';
import kycRoutes, { adminKycRouter } from './kycRoutes.js';
import customerRoutes from './customerRoutes.js';
import referralRoutes, { adminReferralRouter } from './referralRoutes.js';
import activityLogRoutes from './activityLogRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import staffRoutes from './staffRoutes.js';
import supportRoutes, { adminSupportRouter } from './supportRoutes.js';
import bankChangeRoutes, { adminBankChangeRouter } from './bankChangeRoutes.js';
import {
  passwordRouter,
  profileRouter,
  walletRouter,
  investmentPlanRouter,
  investmentRouter,
  withdrawalRouter,
  notificationRouter,
  publicRouter,
  adminFinanceRouter,
} from './financeRoutes.js';

const apiRouter = Router();

// Health check: 200 when every dependency works, 503 with the failing check named otherwise
apiRouter.get('/health', async (_req, res) => {
  const report = await runHealthChecks();
  res.status(report.ok ? 200 : 503).json({
    status: report.ok ? 'online' : 'degraded',
    system: 'Clyvus Ventures Stock Market Investment Platform API',
    timestamp: new Date().toISOString(),
    checks: report.checks,
  });
});

// Authentication routes
apiRouter.use('/auth', authRoutes);

// Customer KYC routes
apiRouter.use('/kyc', kycRoutes);

// Customer Referral routes
apiRouter.use('/referrals', referralRoutes);

// Admin Routes
apiRouter.use('/admin/kyc', adminKycRouter);
apiRouter.use('/admin/customers', customerRoutes);
apiRouter.use('/admin/referrals', adminReferralRouter);
apiRouter.use('/admin/activity-logs', activityLogRoutes);
apiRouter.use('/admin/dashboard', dashboardRoutes);
apiRouter.use('/admin/staff', staffRoutes);
apiRouter.use('/admin/support', adminSupportRouter);
apiRouter.use('/admin/bank-change-requests', adminBankChangeRouter);

// Investment platform: customer routes
apiRouter.use('/auth', passwordRouter);
apiRouter.use('/profile/bank-change-requests', bankChangeRoutes);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/wallet', walletRouter);
apiRouter.use('/investment-plans', investmentPlanRouter);
apiRouter.use('/investments', investmentRouter);
apiRouter.use('/withdrawals', withdrawalRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/support', supportRoutes);
apiRouter.use('/public', publicRouter);

// Investment platform: admin routes (mounted last so existing /admin routers match first)
apiRouter.use('/admin', adminFinanceRouter);

export default apiRouter;

