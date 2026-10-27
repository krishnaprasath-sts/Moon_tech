import { Request } from 'express';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  CUSTOMER = 'CUSTOMER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum KycStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  RESUBMISSION_REQUIRED = 'RESUBMISSION_REQUIRED',
  SUSPENDED = 'SUSPENDED',
}

export enum KycReviewAction {
  VERIFY = 'VERIFY',
  REJECT = 'REJECT',
  REQUEST_RESUBMISSION = 'REQUEST_RESUBMISSION',
  PUT_UNDER_REVIEW = 'PUT_UNDER_REVIEW',
  SUSPEND = 'SUSPEND',
}

export enum ReferralStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export interface JwtUserPayload {
  id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface KycFilterParams extends PaginationParams {
  status?: KycStatus | string;
  startDate?: string;
  endDate?: string;
}

export interface CustomerFilterParams extends PaginationParams {
  kycStatus?: KycStatus | string;
  status?: UserStatus | string;
}

export interface DashboardStats {
  totalCustomers: number;
  pendingKyc: number;
  verifiedKyc: number;
  rejectedKyc: number;
  newCustomersToday: number;
  recentRegistrations: any[];
  recentKycSubmissions: any[];
  recentAdminActivity: any[];
  kycStatusDistribution: { name: string; value: number; color: string }[];
  registrationTrend: { date: string; count: number }[];
}

export enum DepositMethod {
  UPI = 'UPI',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum DepositStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum WalletTxnType {
  DEPOSIT = 'DEPOSIT',
  INVESTMENT = 'INVESTMENT',
  MATURITY_PRINCIPAL = 'MATURITY_PRINCIPAL',
  PROFIT = 'PROFIT',
  REFERRAL_COMMISSION = 'REFERRAL_COMMISSION',
  WITHDRAWAL = 'WITHDRAWAL',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum WalletTxnDirection {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

/**
 * The wallet is split in two.
 * CAPITAL: deposited money and principal returned at maturity. It is what gets invested
 *          and the only money that earns profit. Withdrawn in full only, less the capital
 *          withdrawal fee.
 * PROFIT:  daily profit and referral commission. Withdrawable any time without fee, and it
 *          never earns profit itself (no compounding) unless the customer re-invests it.
 */
export enum WalletBucket {
  CAPITAL = 'CAPITAL',
  PROFIT = 'PROFIT',
}

/**
 * What `profit_value` of a DAILY plan means.
 * PER_MONTH: % of the capital per month, paid as 20 equal working-day credits (4 weeks x 5 days).
 * PER_YEAR:  % of the capital per year, paid as 240 equal working-day credits.
 * PER_DAY:   legacy; % of the capital on every working day, no monthly cap.
 */
export enum RateBasis {
  PER_MONTH = 'PER_MONTH',
  PER_YEAR = 'PER_YEAR',
  PER_DAY = 'PER_DAY',
}

export enum ProfitType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

/**
 * When the profit of a plan reaches the customer's wallet.
 * AT_MATURITY: the whole profit is paid with the principal at the end of the term.
 * DAILY: profit_value is a daily percentage of the principal, credited to the wallet
 *        every working day (Monday-Friday, IST) at the payout hour; principal is returned at maturity.
 */
export enum ProfitPayoutMode {
  AT_MATURITY = 'AT_MATURITY',
  DAILY = 'DAILY',
  MONTHLY = 'MONTHLY',
}

/** Where the money of a withdrawal request comes from */
export enum WithdrawalSource {
  INVESTMENT = 'INVESTMENT',
  WALLET = 'WALLET',
}

export enum ReferralCommissionStatus {
  PENDING = 'PENDING',
  CREDITED = 'CREDITED',
  CANCELLED = 'CANCELLED',
}

export enum InvestmentStatus {
  ACTIVE = 'ACTIVE',
  MATURED = 'MATURED',
  WITHDRAWAL_REQUESTED = 'WITHDRAWAL_REQUESTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export enum PayoutMethod {
  BANK = 'BANK',
  UPI = 'UPI',
}

export enum NotificationType {
  PAYMENT_SUBMITTED = 'PAYMENT_SUBMITTED',
  PAYMENT_VERIFIED = 'PAYMENT_VERIFIED',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  INVESTMENT_CONFIRMED = 'INVESTMENT_CONFIRMED',
  INVESTMENT_MATURED = 'INVESTMENT_MATURED',
  INVESTMENT_CANCELLED = 'INVESTMENT_CANCELLED',
  WITHDRAWAL_REQUESTED = 'WITHDRAWAL_REQUESTED',
  WITHDRAWAL_APPROVED = 'WITHDRAWAL_APPROVED',
  WITHDRAWAL_REJECTED = 'WITHDRAWAL_REJECTED',
  WITHDRAWAL_COMPLETED = 'WITHDRAWAL_COMPLETED',
  WALLET_ADJUSTMENT = 'WALLET_ADJUSTMENT',
  PROFIT_CREDITED = 'PROFIT_CREDITED',
  REFERRAL_COMMISSION = 'REFERRAL_COMMISSION',
  KYC_VERIFIED = 'KYC_VERIFIED',
  KYC_REJECTED = 'KYC_REJECTED',
  KYC_RESUBMISSION_REQUIRED = 'KYC_RESUBMISSION_REQUIRED',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  SUPPORT_REPLY = 'SUPPORT_REPLY',
  BANK_CHANGE_APPROVED = 'BANK_CHANGE_APPROVED',
  BANK_CHANGE_REJECTED = 'BANK_CHANGE_REJECTED',
}

/** Customer request to replace the bank account used for withdrawals */
export enum BankChangeStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/** Where the bank account that withdrawals are paid to came from */
export enum BankSource {
  /** Copied from the KYC submission (verified when the KYC is verified) */
  KYC = 'KYC',
  /** Set by an admin-approved bank change request */
  CHANGE_REQUEST = 'CHANGE_REQUEST',
  /** Typed in by the customer before KYC; not verified by anyone */
  CUSTOMER = 'CUSTOMER',
}

/** Subject a customer picks before writing to support */
export enum SupportTopic {
  KYC = 'KYC',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  PLANS = 'PLANS',
}

export enum SupportSender {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
}

