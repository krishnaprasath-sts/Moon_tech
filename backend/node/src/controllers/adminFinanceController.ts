import { sendResponse } from '../utils/response.js';
import { asyncHandler, getRequestMeta, parseIdParam } from '../utils/http.js';
import { SettingsService } from '../services/settingsService.js';
import { WalletService } from '../services/walletService.js';
import { DepositService } from '../services/depositService.js';
import { InvestmentPlanService } from '../services/investmentPlanService.js';
import { InvestmentService } from '../services/investmentService.js';
import { WithdrawalService } from '../services/withdrawalService.js';
import { NotificationService } from '../services/notificationService.js';
import { FinanceDashboardService } from '../services/financeDashboardService.js';
import { ReportService } from '../services/reportService.js';
import { streamFile } from './financeController.js';

/**
 * Admin-facing investment platform endpoints
 */
export class AdminFinanceController {
  // -------------------------------------------------------------- Dashboard
  public static getDashboard = asyncHandler(async (_req, res) => {
    const stats = await FinanceDashboardService.getStats();
    sendResponse({ res, message: 'Investment dashboard retrieved successfully', data: stats });
  });

  public static getCustomerFinance = asyncHandler(async (req, res) => {
    const customerId = parseIdParam(req.params.id, 'customer ID');
    const finance = await FinanceDashboardService.getCustomerFinance(customerId);
    sendResponse({ res, message: 'Customer finance details retrieved successfully', data: finance });
  });

  // --------------------------------------------------------------- Settings
  public static getSettings = asyncHandler(async (_req, res) => {
    const settings = await SettingsService.getSettings();
    sendResponse({ res, message: 'Settings retrieved successfully', data: settings });
  });

  public static updateSettings = asyncHandler(async (req, res) => {
    const settings = await SettingsService.updateSettings(req.body, req.user!.id, getRequestMeta(req));
    sendResponse({ res, message: 'Settings updated successfully', data: settings });
  });

  // --------------------------------------------------------------- Payments
  public static listDeposits = asyncHandler(async (req, res) => {
    const result = await DepositService.adminListDeposits(req.query as any);
    sendResponse({
      res,
      message: 'Payment submissions retrieved successfully',
      data: result.deposits,
      meta: result.meta,
    });
  });

  public static getDeposit = asyncHandler(async (req, res) => {
    const deposit = await DepositService.adminGetDeposit(parseIdParam(req.params.id, 'payment ID'));
    sendResponse({ res, message: 'Payment submission retrieved successfully', data: deposit });
  });

  public static getDepositReceipt = asyncHandler(async (req, res) => {
    const file = await DepositService.getReceiptFile(parseIdParam(req.params.id, 'payment ID'), req.user!);
    streamFile(res, file, 'payment_receipt');
  });

  public static approveDeposit = asyncHandler(async (req, res) => {
    const deposit = await DepositService.approveDeposit(
      parseIdParam(req.params.id, 'payment ID'),
      req.user!.id,
      req.body.remarks,
      getRequestMeta(req)
    );
    sendResponse({ res, message: 'Payment approved and wallet credited successfully', data: deposit });
  });

  public static rejectDeposit = asyncHandler(async (req, res) => {
    const deposit = await DepositService.rejectDeposit(
      parseIdParam(req.params.id, 'payment ID'),
      req.user!.id,
      req.body.reason,
      req.body.remarks,
      getRequestMeta(req)
    );
    sendResponse({ res, message: 'Payment rejected successfully', data: deposit });
  });

  // ------------------------------------------------------------------ Plans
  public static listPlans = asyncHandler(async (_req, res) => {
    const plans = await InvestmentPlanService.adminListPlans();
    sendResponse({ res, message: 'Investment plans retrieved successfully', data: plans });
  });

  public static createPlan = asyncHandler(async (req, res) => {
    const plan = await InvestmentPlanService.createPlan(req.body, req.user!.id, getRequestMeta(req));
    sendResponse({ res, statusCode: 201, message: 'Investment plan created successfully', data: plan });
  });

  public static updatePlan = asyncHandler(async (req, res) => {
    const plan = await InvestmentPlanService.updatePlan(
      parseIdParam(req.params.id, 'plan ID'),
      req.body,
      req.user!.id,
      getRequestMeta(req)
    );
    sendResponse({ res, message: 'Investment plan updated successfully', data: plan });
  });

  public static setPlanStatus = asyncHandler(async (req, res) => {
    const plan = await InvestmentPlanService.setPlanStatus(
      parseIdParam(req.params.id, 'plan ID'),
      req.body.isActive,
      req.user!.id,
      getRequestMeta(req)
    );
    sendResponse({
      res,
      message: `Plan "${plan.name}" ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
      data: plan,
    });
  });

  public static setPlanFeatured = asyncHandler(async (req, res) => {
    const plan = await InvestmentPlanService.setPlanFeatured(
      parseIdParam(req.params.id, 'plan ID'),
      req.body.isFeatured,
      req.body.featuredTagline,
      req.user!.id,
      getRequestMeta(req)
    );
    sendResponse({
      res,
      message: `Plan "${plan.name}" ${plan.isFeatured ? 'is now featured on the website' : 'removed from featured plans'}`,
      data: plan,
    });
  });

  public static deletePlan = asyncHandler(async (req, res) => {
    const result = await InvestmentPlanService.deletePlan(
      parseIdParam(req.params.id, 'plan ID'),
      req.user!.id,
      getRequestMeta(req)
    );
    sendResponse({ res, message: result.message, data: result });
  });

  // ------------------------------------------------------------ Investments
  public static listInvestments = asyncHandler(async (req, res) => {
    const result = await InvestmentService.adminListInvestments(req.query as any);
    sendResponse({
      res,
      message: 'Investments retrieved successfully',
      data: result.investments,
      meta: result.meta,
    });
  });

  public static getInvestment = asyncHandler(async (req, res) => {
    const investment = await InvestmentService.adminGetInvestment(parseIdParam(req.params.id, 'investment ID'));
    sendResponse({ res, message: 'Investment retrieved successfully', data: investment });
  });

  public static cancelInvestment = asyncHandler(async (req, res) => {
    const investment = await InvestmentService.cancelInvestment(
      parseIdParam(req.params.id, 'investment ID'),
      req.user!.id,
      req.body.reason,
      getRequestMeta(req)
    );
    sendResponse({ res, message: 'Investment cancelled and principal refunded to wallet', data: investment });
  });

  public static setEarlyWithdrawal = asyncHandler(async (req, res) => {
    const investment = await InvestmentService.setEarlyWithdrawal(
      parseIdParam(req.params.id, 'investment ID'),
      req.body.allowed,
      req.user!.id,
      getRequestMeta(req)
    );
    sendResponse({
      res,
      message: `Early withdrawal ${investment.earlyWithdrawalAllowed ? 'allowed' : 'revoked'} successfully`,
      data: investment,
    });
  });

  // ------------------------------------------------------------ Withdrawals
  public static listWithdrawals = asyncHandler(async (req, res) => {
    const result = await WithdrawalService.adminListWithdrawals(req.query as any);
    sendResponse({
      res,
      message: 'Withdrawal requests retrieved successfully',
      data: result.withdrawals,
      meta: result.meta,
    });
  });

  public static getWithdrawal = asyncHandler(async (req, res) => {
    const withdrawal = await WithdrawalService.adminGetWithdrawal(
      parseIdParam(req.params.id, 'withdrawal ID'),
      req.user!
    );
    sendResponse({ res, message: 'Withdrawal request retrieved successfully', data: withdrawal });
  });

  public static approveWithdrawal = asyncHandler(async (req, res) => {
    const withdrawal = await WithdrawalService.approveWithdrawal(
      parseIdParam(req.params.id, 'withdrawal ID'),
      req.user!.id,
      req.body,
      getRequestMeta(req)
    );
    sendResponse({ res, message: 'Withdrawal request approved successfully', data: withdrawal });
  });

  public static rejectWithdrawal = asyncHandler(async (req, res) => {
    const withdrawal = await WithdrawalService.rejectWithdrawal(
      parseIdParam(req.params.id, 'withdrawal ID'),
      req.user!.id,
      req.body.reason,
      req.body.remarks,
      getRequestMeta(req)
    );
    sendResponse({ res, message: 'Withdrawal request rejected successfully', data: withdrawal });
  });

  public static completeWithdrawal = asyncHandler(async (req, res) => {
    const withdrawal = await WithdrawalService.completeWithdrawal(
      parseIdParam(req.params.id, 'withdrawal ID'),
      req.user!.id,
      req.body,
      req.file,
      getRequestMeta(req)
    );
    sendResponse({ res, message: 'Withdrawal marked as completed successfully', data: withdrawal });
  });

  public static getWithdrawalProof = asyncHandler(async (req, res) => {
    const file = await WithdrawalService.getProofFile(parseIdParam(req.params.id, 'withdrawal ID'), req.user!);
    streamFile(res, file, 'payment_proof');
  });

  // ---------------------------------------------------------------- Wallets
  public static listTransactions = asyncHandler(async (req, res) => {
    const result = await WalletService.adminListTransactions(req.query as any);
    sendResponse({
      res,
      message: 'Wallet transactions retrieved successfully',
      data: result.transactions,
      meta: result.meta,
    });
  });

  public static adjustWallet = asyncHandler(async (req, res) => {
    const transaction = await WalletService.adjustWallet(
      parseIdParam(req.params.userId, 'customer ID'),
      req.body,
      req.user!.id,
      getRequestMeta(req)
    );
    sendResponse({ res, statusCode: 201, message: 'Wallet adjusted successfully', data: transaction });
  });

  // ---------------------------------------------------------- Announcements
  public static createAnnouncement = asyncHandler(async (req, res) => {
    const announcement = await NotificationService.announce(req.body, req.user!.id, getRequestMeta(req));
    sendResponse({
      res,
      statusCode: 201,
      message: `Announcement sent to ${announcement.recipientsCount} customer(s)`,
      data: announcement,
    });
  });

  public static listAnnouncements = asyncHandler(async (req, res) => {
    const result = await NotificationService.listAnnouncements(req.query as any);
    sendResponse({
      res,
      message: 'Announcements retrieved successfully',
      data: result.announcements,
      meta: result.meta,
    });
  });

  // ---------------------------------------------------------------- Reports
  public static getReport = asyncHandler(async (req, res) => {
    const { startDate, endDate, format } = req.query as Record<string, string | undefined>;
    const report = await ReportService.generate(req.params.type, { startDate, endDate });

    if (format === 'csv') {
      const fileName = `${report.type}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(200).send(ReportService.toCsv(report));
      return;
    }

    sendResponse({ res, message: `${report.title} generated successfully`, data: report });
  });
}
