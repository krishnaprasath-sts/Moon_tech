import { Router } from 'express';
import authRoutes from './authRoutes.js';
import kycRoutes, { adminKycRouter } from './kycRoutes.js';
import customerRoutes from './customerRoutes.js';
import referralRoutes, { adminReferralRouter } from './referralRoutes.js';
import activityLogRoutes from './activityLogRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import staffRoutes from './staffRoutes.js';
import {
  passwordRouter,
  profileRouter,
  walletRouter,
  investmentPlanRouter,
  investmentRouter,
  withdrawalRouter,
  notificationRouter,
  adminFinanceRouter,
} from './financeRoutes.js';

const apiRouter = Router();

// Health check
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'online',
    system: 'Moon Tech Solutions Stock Market Investment Platform API',
    timestamp: new Date().toISOString(),
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

// Investment platform: customer routes
apiRouter.use('/auth', passwordRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/wallet', walletRouter);
apiRouter.use('/investment-plans', investmentPlanRouter);
apiRouter.use('/investments', investmentRouter);
apiRouter.use('/withdrawals', withdrawalRouter);
apiRouter.use('/notifications', notificationRouter);

// Investment platform: admin routes (mounted last so existing /admin routers match first)
apiRouter.use('/admin', adminFinanceRouter);

export default apiRouter;

