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
  WITHDRAWAL = 'WITHDRAWAL',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum WalletTxnDirection {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum ProfitType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
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
  ANNOUNCEMENT = 'ANNOUNCEMENT',
}

