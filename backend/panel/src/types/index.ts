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

export interface User {
  id: number;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  fullName?: string;
  referralCode?: string;
  kycStatus?: KycStatus;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
  errors?: ApiFieldError[];
}

// Router state handed to /login so the user returns to the deep link after signing in
export interface LoginLocationState {
  from?: { pathname: string; search?: string };
}

// Tab counters returned by the KYC list endpoint
export interface KycCounts {
  all: number;
  pending: number;
  verified: number;
  rejected: number;
  resubmission: number;
}

export interface CustomerSummary {
  id: number;
  email: string;
  phone: string;
  fullName: string;
  referralCode: string;
  referredBy?: string | null;
  city?: string | null;
  state?: string | null;
  accountStatus: UserStatus;
  kycId?: number | null;
  kycStatus: KycStatus;
  kycSubmittedAt?: string | null;
  investmentsCount?: number;
  activeInvestmentsCount?: number;
  activeInvestedAmount?: number;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface CustomerDetail {
  id: number;
  email: string;
  phone: string;
  status: UserStatus;
  role: UserRole;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  profile: {
    fullName: string;
    referralCode: string;
    referredBy?: string | null;
    dateOfBirth?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  } | null;
  kyc: {
    id: number;
    status: KycStatus;
    panMasked: string;
    aadhaarMasked: string;
    bankAccountMasked: string;
    accountHolderName?: string;
    ifscCode?: string;
    submittedAt?: string;
    reviewedAt?: string;
    rejectionReason?: string;
    hasPassbookDoc: boolean;
    hasPanDoc: boolean;
    hasAadhaarDoc: boolean;
  } | null;
  referrals: {
    totalReferrals: number;
    items: Array<{
      id: number;
      referredUserId: number;
      name: string;
      email: string;
      phone: string;
      status: string;
      createdAt: string;
    }>;
  };
  recentLogs: Array<{
    id: number;
    action: string;
    description: string;
    ipAddress?: string;
    createdAt: string;
  }>;
}

export interface KycSubmissionSummary {
  id: number;
  userId: number;
  status: KycStatus;
  customerName: string;
  email: string;
  phone: string;
  referralCode: string;
  panMasked: string;
  aadhaarMasked: string;
  bankAccountMasked: string;
  accountHolderName?: string;
  ifscCode?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: { id: number; email: string; role: string } | null;
  rejectionReason?: string;
  hasPassbookDoc: boolean;
  hasPanDoc: boolean;
  hasAadhaarDoc: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KycDetail {
  id: number;
  userId: number;
  status: KycStatus;
  customer: {
    id: number;
    name: string;
    email: string;
    phone: string;
    referralCode: string;
    referredBy?: string;
    dateOfBirth?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    accountStatus: UserStatus;
    memberSince: string;
    lastLoginAt?: string;
  };
  bankDetails: {
    maskedAccountNumber: string;
    last4?: string;
    accountHolderName?: string;
    ifscCode?: string;
  };
  identityDetails: {
    maskedPan: string;
    panLast4?: string;
    maskedAadhaar: string;
    aadhaarLast4?: string;
  };
  documents: {
    passbook: { available: boolean; viewUrl: string | null };
    pan: { available: boolean; viewUrl: string | null };
    aadhaar: { available: boolean; viewUrl: string | null };
  };
  reviewInfo: {
    submittedAt?: string;
    reviewedAt?: string;
    reviewedBy?: { id: number; email: string; role: string } | null;
    rejectionReason?: string;
  };
  reviews: Array<{
    id: number;
    action: string;
    remarks?: string;
    createdAt: string;
    admin?: { id: number; email: string; role: string };
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralRecord {
  id: number;
  referralCode: string;
  status: string;
  createdAt: string;
  referrer: {
    id: number;
    name: string;
    email: string;
    phone: string;
    referralCode: string;
  };
  referred: {
    id: number;
    name: string;
    email: string;
    phone: string;
    kycStatus: KycStatus;
    accountStatus: UserStatus;
  };
}

export interface ActivityLogRecord {
  id: number;
  user_id?: number | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  description: string;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

export interface DashboardStats {
  totalCustomers: number;
  pendingKyc: number;
  verifiedKyc: number;
  rejectedKyc: number;
  newCustomersToday: number;
  recentRegistrations: Array<{
    id: number;
    email: string;
    phone: string;
    fullName: string;
    referralCode: string;
    city?: string;
    kycId?: number;
    kycStatus: KycStatus;
    createdAt: string;
  }>;
  recentKycSubmissions: Array<{
    id: number;
    userId: number;
    fullName: string;
    email: string;
    phone: string;
    referralCode: string;
    kycStatus: KycStatus;
    submittedAt: string;
  }>;
  recentAdminActivity: Array<{
    id: number;
    action: string;
    description: string;
    entity: string;
    ipAddress?: string;
    createdAt: string;
    user?: { email: string; role: string };
  }>;
  kycStatusDistribution: Array<{ name: string; value: number; color: string }>;
  registrationTrend: Array<{ date: string; count: number }>;
}

export interface StaffMember {
  id: number;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Investment platform (wallet, payments, plans, investments, withdrawals)
// ---------------------------------------------------------------------------

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface FinanceListMeta extends PaginationMeta {
  counts?: Record<string, number>;
}

export type FinanceListResponse<T> = Omit<ApiResponse<T>, 'meta'> & { meta?: FinanceListMeta };

export type DepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ProfitType = 'PERCENTAGE' | 'FIXED';
export type InvestmentStatus = 'ACTIVE' | 'MATURED' | 'WITHDRAWAL_REQUESTED' | 'COMPLETED' | 'CANCELLED';
export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export type PayoutMethod = 'BANK' | 'UPI';
export type WalletTxnDirection = 'CREDIT' | 'DEBIT';
export type WalletTxnType =
  | 'DEPOSIT'
  | 'INVESTMENT'
  | 'MATURITY_PRINCIPAL'
  | 'PROFIT'
  | 'WITHDRAWAL'
  | 'REFUND'
  | 'ADJUSTMENT';

export interface WalletTransaction {
  id: number;
  reference: string;
  type: WalletTxnType;
  direction: WalletTxnDirection;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  relatedEntity?: string | null;
  relatedId?: number | null;
  description?: string | null;
  status: string;
  createdAt: string;
}

export interface AdminWalletTransaction extends WalletTransaction {
  userId: number;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
}

export interface AdminDeposit {
  id: number;
  reference: string;
  userId: number;
  amount: number;
  upiTransactionId: string;
  hasReceipt: boolean;
  status: DepositStatus;
  rejectionReason?: string | null;
  adminRemarks?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  createdAt: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerStatus?: UserStatus | null;
  walletBalance?: number;
}

export interface DepositApprovalResult extends AdminDeposit {
  walletBalance: number;
  transactionReference: string;
}

export interface InvestmentPlan {
  id: number;
  name: string;
  description?: string | null;
  minAmount: number;
  maxAmount: number;
  durationDays: number;
  profitType: ProfitType;
  profitValue: number;
  isActive: boolean;
  isFeatured: boolean;
  featuredTagline?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
  totalInvestments?: number;
  activeInvestments?: number;
  totalInvested?: number;
}

export interface InvestmentPlanPayload {
  name: string;
  description?: string | null;
  minAmount: number;
  maxAmount: number;
  durationDays: number;
  profitType: ProfitType;
  profitValue: number;
  isActive?: boolean;
  isFeatured?: boolean;
  featuredTagline?: string | null;
  sortOrder?: number;
}

export interface InvestmentWithdrawalSummary {
  id: number;
  reference: string;
  totalAmount: number;
  status: WithdrawalStatus;
  rejectionReason?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface Investment {
  id: number;
  reference: string;
  userId: number;
  planId: number;
  planName: string;
  profitType: ProfitType;
  profitValue: number;
  durationDays: number;
  amount: number;
  expectedProfit: number;
  maturityAmount: number;
  startDate: string;
  maturityDate: string;
  status: InvestmentStatus;
  earlyWithdrawalAllowed: boolean;
  canRequestWithdrawal: boolean;
  daysRemaining: number;
  progressPercent: number;
  maturedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
}

export interface AdminInvestment extends Investment {
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  withdrawals?: InvestmentWithdrawalSummary[];
}

export interface AdminWithdrawal {
  id: number;
  reference: string;
  userId: number;
  investmentId: number;
  investmentReference: string;
  planName: string;
  principalAmount: number;
  profitAmount: number;
  totalAmount: number;
  isEarly: boolean;
  payoutMethod: PayoutMethod;
  payoutUpiId?: string | null;
  payoutAccountHolder?: string | null;
  payoutAccountMasked?: string | null;
  payoutIfsc?: string | null;
  payoutBankName?: string | null;
  status: WithdrawalStatus;
  rejectionReason?: string | null;
  paymentReference?: string | null;
  hasPaymentProof: boolean;
  reviewedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  adminRemarks?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
}

export interface AdminWithdrawalDetail extends AdminWithdrawal {
  payoutAccountNumber?: string | null;
  investment?: {
    id: number;
    reference: string;
    planName: string;
    amount: number;
    expectedProfit: number;
    maturityAmount: number;
    durationDays: number;
    startDate: string;
    maturityDate: string;
    status: InvestmentStatus;
  } | null;
}

export interface PayoutDetails {
  preferredMethod: PayoutMethod;
  upiId?: string | null;
  accountHolderName?: string | null;
  accountNumberMasked?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
  hasBankDetails: boolean;
  hasUpiDetails: boolean;
  updatedAt?: string | null;
}

export interface UpcomingMaturity {
  id: number;
  reference: string;
  planName: string;
  amount: number;
  maturityAmount: number;
  maturityDate: string;
  customerName?: string | null;
  customerEmail?: string | null;
}

export interface FinanceDashboard {
  totalUsers: number;
  activeUsers: number;
  activeInvestments: number;
  activeInvestmentAmount: number;
  totalInvestments: number;
  totalInvestmentAmount: number;
  totalMaturedInvestments: number;
  maturedAwaitingWithdrawal: number;
  maturedAwaitingAmount: number;
  pendingPaymentVerifications: number;
  pendingPaymentAmount: number;
  totalDeposited: number;
  pendingWithdrawalRequests: number;
  pendingWithdrawalAmount: number;
  totalProfitPaid: number;
  totalWithdrawn: number;
  totalWalletBalance: number;
  walletTransactions: number;
  investmentStatusDistribution: Array<{ name: string; value: number; color: string }>;
  recentTransactions: AdminWalletTransaction[];
  upcomingMaturities: UpcomingMaturity[];
}

export interface CustomerFinance {
  customerId: number;
  walletBalance: number;
  summary: {
    investedAmount: number;
    expectedProfit: number;
    totalDeposited: number;
    totalProfitPaid: number;
    totalWithdrawn: number;
    investmentsCount: number;
    recentCreditsCount: number;
  };
  payoutDetails: PayoutDetails | null;
  investments: Investment[];
  transactions: WalletTransaction[];
  deposits: Array<{
    id: number;
    reference: string;
    amount: number;
    upiTransactionId: string;
    status: DepositStatus;
    createdAt: string;
  }>;
  withdrawals: Array<{
    id: number;
    reference: string;
    totalAmount: number;
    profitAmount: number;
    status: WithdrawalStatus;
    createdAt: string;
    completedAt?: string | null;
  }>;
}

export interface PlatformSettings {
  walletMinTopup: number;
  walletMaxTopup: number;
  upiId: string;
  upiPayeeName: string;
  depositInstructions: string;
  requireKycForInvestment: boolean;
}

export interface WalletAdjustmentPayload {
  direction: WalletTxnDirection;
  amount: number;
  reason: string;
}

export interface Announcement {
  id: number;
  title: string;
  message: string;
  recipientsCount: number;
  createdBy?: string | null;
  createdAt: string;
}

export type ReportType =
  | 'users'
  | 'wallet'
  | 'investments'
  | 'profit'
  | 'maturity'
  | 'withdrawals'
  | 'payments'
  | 'transactions';

export type ReportCellType = 'money' | 'date' | 'number' | 'text';
export type ReportCellValue = string | number | boolean | null | undefined;

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportCellType;
}

export interface ReportSummaryItem {
  label: string;
  value: string | number | null;
  type: 'money' | 'number' | 'text';
}

export interface FinanceReport {
  type: ReportType;
  title: string;
  generatedAt: string;
  startDate?: string | null;
  endDate?: string | null;
  columns: ReportColumn[];
  rows: Array<Record<string, ReportCellValue>>;
  summary: ReportSummaryItem[];
  truncated: boolean;
}


