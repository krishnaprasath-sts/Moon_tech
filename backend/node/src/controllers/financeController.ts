import fs from 'fs';
import { Response } from 'express';
import { sendResponse } from '../utils/response.js';
import { asyncHandler, getRequestMeta, parseIdParam } from '../utils/http.js';
import { SettingsService } from '../services/settingsService.js';
import { FileService } from '../services/fileService.js';
import { NotFoundError } from '../utils/errors.js';
import { WalletService } from '../services/walletService.js';
import { DepositService } from '../services/depositService.js';
import { InvestmentPlanService } from '../services/investmentPlanService.js';
import { InvestmentService } from '../services/investmentService.js';
import { WithdrawalService } from '../services/withdrawalService.js';
import { NotificationService } from '../services/notificationService.js';
import { ProfileService } from '../services/profileService.js';
import { DailyPayoutService } from '../services/dailyPayoutService.js';

function streamFile(res: Response, file: { fullPath: string; mimeType: string }, name: string) {
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${name}"`);
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  fs.createReadStream(file.fullPath).pipe(res);
}

/**
 * Customer-facing wallet, investment, withdrawal, notification & profile endpoints
 */
export class FinanceController {
  // ------------------------------------------------------------------ Wallet
  public static getWallet = asyncHandler(async (req, res) => {
    const [summary, settings] = await Promise.all([
      WalletService.getSummary(req.user!.id),
      SettingsService.getSettings(),
    ]);

    sendResponse({
      res,
      message: 'Wallet retrieved successfully',
      data: {
        ...summary,
        config: {
          minTopup: settings.walletMinTopup,
          maxTopup: settings.walletMaxTopup,
          upiId: settings.upiId,
          upiPayeeName: settings.upiPayeeName,
          // Admin-uploaded QR image (API path, relative to the API base); null = QR generated from the UPI ID
          upiQrImageUrl: SettingsService.upiQrImagePath(settings),
          depositInstructions: settings.depositInstructions,
          // Bank transfer destination (only when the admin has configured it)
          bankTransferEnabled: SettingsService.bankTransferEnabled(settings),
          bankAccountName: settings.bankAccountName,
          bankAccountNumber: settings.bankAccountNumber,
          bankIfsc: settings.bankIfsc,
          bankName: settings.bankName,
          bankTransferInstructions: settings.bankTransferInstructions,
          requireKycForInvestment: settings.requireKycForInvestment,
          requireKycForWithdrawal: settings.requireKycForWithdrawal,
          minWithdrawal: settings.walletMinWithdrawal,
          referralCommissionPercent: settings.referralCommissionPercent,
          // Deducted from capital withdrawals; profit withdrawals are free
          capitalWithdrawalFeePercent: settings.capitalWithdrawalFeePercent,
          payoutSchedule: DailyPayoutService.scheduleDescription(),
        },
      },
    });
  });

  public static getTransactions = asyncHandler(async (req, res) => {
    const result = await WalletService.listUserTransactions(req.user!.id, req.query as any);
    sendResponse({
      res,
      message: 'Transaction history retrieved successfully',
      data: result.transactions,
      meta: result.meta,
    });
  });

  public static createDeposit = asyncHandler(async (req, res) => {
    const deposit = await DepositService.createDeposit(req.user!.id, req.body, req.file, getRequestMeta(req));
    sendResponse({
      res,
      statusCode: 201,
      message: 'Payment submitted successfully. Your wallet will be credited after verification.',
      data: deposit,
    });
  });

  public static getDeposits = asyncHandler(async (req, res) => {
    const result = await DepositService.listUserDeposits(req.user!.id, req.query as any);
    sendResponse({
      res,
      message: 'Payment submissions retrieved successfully',
      data: result.deposits,
      meta: result.meta,
    });
  });

  public static getDepositReceipt = asyncHandler(async (req, res) => {
    const depositId = parseIdParam(req.params.id, 'payment ID');
    const file = await DepositService.getReceiptFile(depositId, req.user!);
    streamFile(res, file, 'payment_receipt');
  });

  /** Public: the admin-uploaded UPI QR image. The file name doubles as the access key. */
  public static getUpiQrImage = asyncHandler(async (req, res) => {
    const settings = await SettingsService.getSettings();
    const requested = String(req.params.file || '');
    if (!settings.upiQrImage || requested !== settings.upiQrImage) {
      throw new NotFoundError('UPI QR image not found');
    }
    const file = await FileService.getSecureFile(settings.upiQrImage);
    res.setHeader('Content-Type', file.mimeType);
    // The name changes with every upload, so the image can be cached for a long time
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(file.fullPath).pipe(res);
  });

  // ------------------------------------------------------------------ Plans
  public static getPlans = asyncHandler(async (_req, res) => {
    const plans = await InvestmentPlanService.listActivePlans();
    sendResponse({ res, message: 'Investment plans retrieved successfully', data: plans });
  });

  public static getFeaturedPlans = asyncHandler(async (_req, res) => {
    const plans = await InvestmentPlanService.listFeaturedPlans();
    sendResponse({ res, message: 'Featured investment plans retrieved successfully', data: plans });
  });

  // ------------------------------------------------------------ Investments
  public static previewInvestment = asyncHandler(async (req, res) => {
    const preview = await InvestmentService.preview(req.body);
    sendResponse({ res, message: 'Investment preview calculated successfully', data: preview });
  });

  public static invest = asyncHandler(async (req, res) => {
    const investment = await InvestmentService.invest(req.user!.id, req.body, getRequestMeta(req));
    sendResponse({
      res,
      statusCode: 201,
      message: `Investment ${investment.reference} confirmed successfully`,
      data: investment,
    });
  });

  public static getInvestments = asyncHandler(async (req, res) => {
    const result = await InvestmentService.listUserInvestments(req.user!.id, req.query as any);
    sendResponse({
      res,
      message: 'Investments retrieved successfully',
      data: result.investments,
      meta: result.meta,
    });
  });

  public static getInvestment = asyncHandler(async (req, res) => {
    const investmentId = parseIdParam(req.params.id, 'investment ID');
    const investment = await InvestmentService.getUserInvestment(req.user!.id, investmentId);
    sendResponse({ res, message: 'Investment retrieved successfully', data: investment });
  });

  // ------------------------------------------------------------ Withdrawals
  public static requestWalletWithdrawal = asyncHandler(async (req, res) => {
    const withdrawal = await WithdrawalService.requestWalletWithdrawal(req.user!.id, req.body, getRequestMeta(req));
    sendResponse({
      res,
      statusCode: 201,
      message: `${withdrawal.bucket === 'CAPITAL' ? 'Capital' : 'Profit'} withdrawal request ${
        withdrawal.reference
      } submitted successfully. The amount is reserved until it is paid.`,
      data: withdrawal,
    });
  });

  public static requestWithdrawal = asyncHandler(async (req, res) => {
    const investmentId = parseIdParam(req.params.id, 'investment ID');
    const withdrawal = await WithdrawalService.requestWithdrawal(
      req.user!.id,
      investmentId,
      req.body,
      getRequestMeta(req)
    );
    sendResponse({
      res,
      statusCode: 201,
      message: `Withdrawal request ${withdrawal.reference} submitted successfully`,
      data: withdrawal,
    });
  });

  public static getWithdrawals = asyncHandler(async (req, res) => {
    const result = await WithdrawalService.listUserWithdrawals(req.user!.id, req.query as any);
    sendResponse({
      res,
      message: 'Withdrawal requests retrieved successfully',
      data: result.withdrawals,
      meta: result.meta,
    });
  });

  public static getWithdrawalProof = asyncHandler(async (req, res) => {
    const withdrawalId = parseIdParam(req.params.id, 'withdrawal ID');
    const file = await WithdrawalService.getProofFile(withdrawalId, req.user!);
    streamFile(res, file, 'payment_proof');
  });

  // ---------------------------------------------------------- Notifications
  public static getNotifications = asyncHandler(async (req, res) => {
    const result = await NotificationService.listForUser(req.user!.id, req.query as any);
    sendResponse({
      res,
      message: 'Notifications retrieved successfully',
      data: result.notifications,
      meta: result.meta,
    });
  });

  public static getUnreadCount = asyncHandler(async (req, res) => {
    const result = await NotificationService.getUnreadCount(req.user!.id);
    sendResponse({ res, message: 'Unread count retrieved successfully', data: result });
  });

  public static markNotificationRead = asyncHandler(async (req, res) => {
    const notificationId = parseIdParam(req.params.id, 'notification ID');
    const notification = await NotificationService.markRead(req.user!.id, notificationId);
    sendResponse({ res, message: 'Notification marked as read', data: notification });
  });

  public static markAllNotificationsRead = asyncHandler(async (req, res) => {
    const result = await NotificationService.markAllRead(req.user!.id);
    sendResponse({ res, message: 'All notifications marked as read', data: result });
  });

  // ---------------------------------------------------------------- Profile
  public static getProfile = asyncHandler(async (req, res) => {
    const profile = await ProfileService.getProfile(req.user!.id);
    sendResponse({ res, message: 'Profile retrieved successfully', data: profile });
  });

  public static updateProfile = asyncHandler(async (req, res) => {
    const profile = await ProfileService.updateProfile(req.user!.id, req.body, getRequestMeta(req));
    sendResponse({ res, message: 'Profile updated successfully', data: profile });
  });

  public static updatePayoutDetails = asyncHandler(async (req, res) => {
    const details = await ProfileService.updatePayoutDetails(req.user!.id, req.body, getRequestMeta(req));
    sendResponse({ res, message: 'Payout details saved successfully', data: details });
  });

  // --------------------------------------------------------------- Password
  public static changePassword = asyncHandler(async (req, res) => {
    const result = await ProfileService.changePassword(req.user!.id, req.body, getRequestMeta(req));
    sendResponse({ res, message: result.message });
  });

  public static forgotPassword = asyncHandler(async (req, res) => {
    const result = await ProfileService.forgotPassword(req.body, getRequestMeta(req));
    sendResponse({ res, message: result.message, data: { expiresInMinutes: result.expiresInMinutes } });
  });

  public static resetPassword = asyncHandler(async (req, res) => {
    const result = await ProfileService.resetPassword(req.body, getRequestMeta(req));
    sendResponse({ res, message: result.message });
  });
}

export { streamFile };
