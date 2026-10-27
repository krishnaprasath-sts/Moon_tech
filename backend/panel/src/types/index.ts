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
  /** Public customer number, e.g. MT100042 */
  customerId?: string | null;
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
    customerId?: string | null;
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
    panNumber?: string | null;
    aadhaarMasked: string;
    aadhaarNumber?: string | null;
    bankAccountMasked: string;
    /** Full account number from KYC; only returned to SUPER_ADMIN / ADMIN */
    bankAccountNumber?: string | null;
    accountHolderName?: string;
    ifscCode?: string;
    bankBranch?: string | null;
    bankName?: string | null;
    submittedAt?: string;
    reviewedAt?: string;
    rejectionReason?: string;
    hasPassbookDoc: boolean;
    hasPanDoc: boolean;
    hasAadhaarDoc: boolean;
    hasAadhaarBackDoc?: boolean;
    documents?: {
      passbook: { available: boolean; viewUrl: string | null };
      pan: { available: boolean; viewUrl: string | null };
      aadhaar: { available: boolean; viewUrl: string | null };
      aadhaarBack?: { available: boolean; viewUrl: string | null };
    };
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
  customerId?: string | null;
  panMasked: string;
  aadhaarMasked: string;
  bankAccountMasked: string;
  accountHolderName?: string;
  ifscCode?: string;
  bankBranch?: string | null;
  bankName?: string | null;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: { id: number; email: string; role: string } | null;
  rejectionReason?: string;
  hasPassbookDoc: boolean;
  hasPanDoc: boolean;
  hasAadhaarDoc: boolean;
  hasAadhaarBackDoc?: boolean;
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
    customerId?: string | null;
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
    /** Full account number; only returned to SUPER_ADMIN / ADMIN */
    accountNumber?: string | null;
    last4?: string;
    accountHolderName?: string;
    ifscCode?: string;
    bankBranch?: string | null;
    bankName?: string | null;
  };
  identityDetails: {
    maskedPan: string;
    panNumber?: string | null;
    panLast4?: string;
    maskedAadhaar: string;
    aadhaarNumber?: string | null;
    aadhaarLast4?: string;
  };
  documents: {
    passbook: { available: boolean; viewUrl: string | null };
    pan: { available: boolean; viewUrl: string | null };
    aadhaar: { available: boolean; viewUrl: string | null };
    aadhaarBack?: { available: boolean; viewUrl: string | null };
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
  /** Commission the referrer earned from this referred customer's investments */
  commissionEarned: number;
  commissionPending: number;
  commissionCount: number;
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

/**
 * CAPITAL: deposits and returned principal; invested from here and the only money that earns.
 * PROFIT: daily profit and referral commission; withdrawable any time without fee.
 */
export type WalletBucket = 'CAPITAL' | 'PROFIT';

/** PER_MONTH: % per month paid as 20 working-day credits. PER_YEAR: % per year / 240. PER_DAY: legacy, % every working day. */
export type RateBasis = 'PER_MONTH' | 'PER_YEAR' | 'PER_DAY';

export interface WalletTransaction {
  id: number;
  reference: string;
  type: WalletTxnType;
  direction: WalletTxnDirection;
  /** Which wallet moved; balanceBefore/After are that wallet's balances */
  bucket: WalletBucket;
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

export type DepositMethod = 'UPI' | 'BANK_TRANSFER';

export interface AdminDeposit {
  id: number;
  reference: string;
  userId: number;
  amount: number;
  /** How the customer paid */
  paymentMethod: DepositMethod;
  /** UPI transaction ID (UTR) or bank transfer reference */
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
  /** Manual verification aids returned by the detail endpoint */
  verification?: DepositVerification;
}

export interface DepositUtrMatch {
  id: number;
  reference: string;
  status: DepositStatus;
  amount: number;
  customerName: string;
  customerEmail: string;
  sameCustomer: boolean;
  createdAt: string;
}

export interface DepositVerification {
  utrAlreadyCredited: boolean;
  utrMatches: DepositUtrMatch[];
  customerKycStatus: KycStatus | null;
  kycAccountHolderName: string | null;
  previousDeposits: { approved: number; rejected: number; pending: number };
  isFirstDeposit: boolean;
}

export interface DepositApprovalResult extends AdminDeposit {
  walletBalance: number;
  transactionReference: string;
}

/** AT_MATURITY: profit paid with the principal at the end. DAILY: profitValue% credited every working day. MONTHLY: profitValue% credited monthly on anniversary date. */
export type ProfitPayoutMode = 'AT_MATURITY' | 'DAILY' | 'MONTHLY';

export interface InvestmentPlan {
  id: number;
  name: string;
  description?: string | null;
  minAmount: number;
  maxAmount: number;
  /** 0 = open-ended: runs until the customer withdraws the capital */
  durationDays: number;
  isOpenEnded: boolean;
  /** Days during which the capital cannot be withdrawn (0 = none) */
  lockInDays: number;
  profitType: ProfitType;
  profitValue: number;
  payoutMode: ProfitPayoutMode;
  rateBasis: RateBasis;
  /** Per-working-day % of the capital: 5% / month -> 0.25 */
  dailyRatePercent: number;
  creditsPerMonth: number;
  creditsPerWeek: number;
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
  lockInDays?: number;
  profitType: ProfitType;
  profitValue: number;
  payoutMode?: ProfitPayoutMode;
  rateBasis?: RateBasis;
  isActive?: boolean;
  isFeatured?: boolean;
  featuredTagline?: string | null;
  sortOrder?: number;
}

export interface InvestmentWithdrawalSummary {
  id: number;
  reference: string;
  principalAmount?: number;
  profitAmount?: number;
  totalAmount: number;
  feePercent?: number;
  feeAmount?: number;
  netAmount?: number;
  status: WithdrawalStatus;
  isEarly?: boolean;
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
  payoutMode: ProfitPayoutMode;
  rateBasis: RateBasis;
  dailyRatePercent: number;
  durationDays: number;
  isOpenEnded: boolean;
  lockInDays: number;
  lockInEndsAt: string | null;
  /** Capital cannot be withdrawn yet (lock-in running and no admin exception) */
  isLocked: boolean;
  amount: number;
  expectedProfit: number;
  /** DAILY plans: profit per working day / week / month, paying days in the term, and what has been credited so far */
  dailyProfit: number;
  weeklyProfit: number;
  monthlyProfit: number;
  profitDays: number;
  profitCredited: number;
  profitRemaining: number;
  /** DAILY plans: working days already credited, and when the next 6:00 AM credit lands */
  creditedDays: number;
  /** Monthly plans: at most this many credits per 30-day cycle (null for legacy per-day plans) */
  creditsPerCycle: number | null;
  currentCycle: number;
  creditsThisCycle: number;
  nextCreditAt: string | null;
  nextCreditDue: boolean;
  /** Fee charged when the capital is withdrawn; the customer receives netCapitalOnWithdrawal */
  feePercent: number;
  /** True while the investment runs and has not matured: closing it now costs the fee */
  earlyExitFeeApplies: boolean;
  capitalWithdrawalFee: number;
  netCapitalOnWithdrawal: number;
  maturityAmount: number;
  startDate: string;
  maturityDate: string | null;
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

export interface ProfitCreditEntry {
  id: number;
  creditDay: string;
  cycleNo: number;
  amount: number;
  creditedAt: string | null;
  walletTransactionId: number | null;
}

export interface AdminInvestment extends Investment {
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  withdrawals?: InvestmentWithdrawalSummary[];
  profitCredits?: ProfitCreditEntry[];
}

export type WithdrawalSource = 'INVESTMENT' | 'WALLET';

export interface AdminWithdrawal {
  id: number;
  reference: string;
  userId: number;
  /** INVESTMENT: capital of a closed investment. WALLET: payout of a wallet balance (already debited). */
  source: WithdrawalSource;
  /** CAPITAL withdrawals carry the capital withdrawal fee; PROFIT withdrawals are free */
  bucket: WalletBucket;
  investmentId: number | null;
  investmentReference: string | null;
  planName: string | null;
  principalAmount: number;
  profitAmount: number;
  /** Gross requested; netAmount = totalAmount - feeAmount is what the admin pays */
  totalAmount: number;
  feePercent: number;
  feeAmount: number;
  netAmount: number;
  isEarly: boolean;
  payoutMethod: PayoutMethod;
  payoutUpiId?: string | null;
  payoutAccountHolder?: string | null;
  payoutAccountMasked?: string | null;
  payoutIfsc?: string | null;
  payoutBankName?: string | null;
  payoutBankBranch?: string | null;
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
  /** Quick bank-account risk flag for the list view */
  bankFlag?: WithdrawalBankFlag | null;
}

export type WithdrawalBankFlag = 'OK' | 'CHANGED' | 'WARNING';

/** Server-side comparison of the payout account against KYC and approved bank changes */
export interface WithdrawalBankCheck {
  level: WithdrawalBankFlag;
  title: string;
  notes: string[];
  matchesKyc: boolean | null;
  source: 'KYC' | 'CHANGE_REQUEST' | 'CUSTOMER' | null;
  kycAccountMasked?: string | null;
  kycIfsc?: string | null;
  kycBankName?: string | null;
  approvedChange: {
    id: number;
    approvedAt: string | null;
    approvedBy: string | null;
    previousAccountMasked: string | null;
    previousIfsc: string | null;
    previousBankName: string | null;
  } | null;
  pendingChangeRequestId: number | null;
}

export interface AdminWithdrawalDetail extends AdminWithdrawal {
  payoutAccountNumber?: string | null;
  bankCheck?: WithdrawalBankCheck | null;
  investment?: {
    id: number;
    reference: string;
    planName: string;
    amount: number;
    expectedProfit: number;
    maturityAmount: number;
    durationDays: number;
    startDate: string;
    maturityDate: string | null;
    status: InvestmentStatus;
  } | null;
}

export interface PayoutDetails {
  preferredMethod: PayoutMethod;
  upiId?: string | null;
  accountHolderName?: string | null;
  accountNumberMasked?: string | null;
  /** Full account number; only returned to SUPER_ADMIN / ADMIN */
  accountNumber?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
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
  /** Net paid to customers, and capital withdrawal fees retained */
  totalWithdrawn: number;
  totalWithdrawalFees: number;
  totalWalletBalance: number;
  totalCapitalBalance: number;
  totalProfitBalance: number;
  walletTransactions: number;
  totalDailyProfitCredited: number;
  dailyProfitCredits: number;
  totalReferralCommissionPaid: number;
  pendingReferralCommissionAmount: number;
  pendingReferralCommissions: number;
  lastPayoutRunAt: string | null;
  payoutSchedule: string;
  walletWithdrawalsPending: number;
  investmentStatusDistribution: Array<{ name: string; value: number; color: string }>;
  recentTransactions: AdminWalletTransaction[];
  upcomingMaturities: UpcomingMaturity[];
}

export interface CustomerFinance {
  customerId: number;
  walletBalance: number;
  capitalBalance: number;
  profitBalance: number;
  summary: {
    investedAmount: number;
    expectedProfit: number;
    totalDeposited: number;
    totalProfitPaid: number;
    dailyProfitCredited: number;
    referralCommissionEarned: number;
    referralCommissionPending: number;
    totalWithdrawn: number;
    totalWithdrawalFees: number;
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
    source: WithdrawalSource;
    bucket: WalletBucket;
    totalAmount: number;
    profitAmount: number;
    feeAmount: number;
    netAmount: number;
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
  /** File name of the admin-uploaded UPI QR image; empty = QR generated from the UPI ID */
  upiQrImage: string;
  depositInstructions: string;
  /** Bank transfer destination; all four must be set (or all empty) */
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  /** Branch of the company account (optional, shown with the transfer details) */
  bankBranch: string;
  bankTransferInstructions: string;
  requireKycForInvestment: boolean;
  requireKycForWithdrawal: boolean;
  walletMinWithdrawal: number;
  /** One-time referral commission, % of the referred customer's investment amount */
  referralCommissionPercent: number;
  /** Daily recurring referral commission, % of active referred investments credited each working day (0.025% = 0.5% / month) */
  dailyReferralCommissionPercent?: number;
  /** Deducted from capital withdrawals (closing an investment or withdrawing the capital wallet); profit withdrawals are free */
  capitalWithdrawalFeePercent: number;
  /** Customers cannot sign in or register while on; staff still can and payouts keep running */
  maintenanceMode: boolean;
  /** Shown on the customer login / registration pages while maintenance mode is on */
  maintenanceMessage: string;
  /** Announcement shown as a popup on the customer login page; empty = none */
  loginAnnouncement: string;
  /** Heading of that popup (title of the last pushed announcement) */
  loginAnnouncementTitle: string;
  /** Company referral code that works for registration before any customer exists; pays no commission */
  companyReferralCode: string;
}

export interface PayoutJobStatus {
  schedule: string;
  lastRunAt: string | null;
}

export interface PayoutRunResult {
  payableDay: string;
  profitCredits: number;
  profitAmount: number;
  commissions: number;
  commissionAmount: number;
}

export type ReferralCommissionStatus = 'PENDING' | 'CREDITED' | 'CANCELLED';

export interface AdminReferralCommission {
  id: number;
  referrerUserId: number;
  referrerName: string;
  referrerEmail: string;
  referredUserId: number;
  referredName: string;
  referredEmail: string;
  investmentId: number;
  investmentReference: string | null;
  planName: string | null;
  investmentAmount: number;
  commissionPercent: number;
  amount: number;
  status: ReferralCommissionStatus;
  eligibleAt: string | null;
  creditedAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
}

export interface WalletAdjustmentPayload {
  direction: WalletTxnDirection;
  /** Which wallet to adjust; defaults to PROFIT on the server */
  bucket: WalletBucket;
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

// ---------------------------------------------------------------------------
// Support chat
// ---------------------------------------------------------------------------
export type SupportTopic = 'KYC' | 'DEPOSIT' | 'WITHDRAWAL' | 'PLANS';
export type SupportSender = 'CUSTOMER' | 'ADMIN';

export interface SupportMessage {
  id: number;
  userId: number;
  topic: SupportTopic;
  sender: SupportSender;
  adminUserId: number | null;
  adminEmail: string | null;
  message: string;
  readByCustomer: boolean;
  readByAdmin: boolean;
  createdAt: string;
}

/** One row per customer in the admin inbox */
export interface SupportThread {
  userId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  topics: SupportTopic[];
  lastMessage: string;
  lastTopic: SupportTopic;
  lastSender: SupportSender;
  lastMessageAt: string | null;
  unreadCount: number;
  messageCount: number;
}

export interface SupportThreadDetail {
  customer: { userId: number; name: string; email: string; phone: string };
  messages: SupportMessage[];
}

/** Visitor (not signed in) conversation in the admin inbox */
export interface GuestThread {
  guestId: number;
  name: string;
  email: string;
  phone: string;
  topics: SupportTopic[];
  lastMessage: string;
  lastTopic: SupportTopic;
  lastSender: SupportSender;
  lastMessageAt: string | null;
  unreadCount: number;
  messageCount: number;
}

export interface GuestThreadDetail {
  guest: { guestId: number; name: string; email: string; phone: string };
  messages: (Omit<SupportMessage, 'userId' | 'readByCustomer'> & { guestId: number; readByGuest: boolean })[];
}

export interface SupportUnread {
  unreadCount: number;
  openThreads: number;
  customers?: { unreadCount: number; openThreads: number };
  visitors?: { unreadCount: number; openThreads: number };
}

// ---------------------------------------------------------------------------
// Payout bank account change requests
// ---------------------------------------------------------------------------
export type BankChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface BankAccountSnapshot {
  accountHolderName: string | null;
  accountNumberMasked: string | null;
  ifscCode: string | null;
  bankName: string | null;
  bankBranch: string | null;
}

export interface BankChangeRequest {
  id: number;
  status: BankChangeStatus;
  customer: { userId: number; name: string; customerId: string | null; email: string; phone: string };
  requested: BankAccountSnapshot & {
    /** Full new account number; only returned to SUPER_ADMIN / ADMIN */
    accountNumber: string | null;
  };
  previous: BankAccountSnapshot | null;
  /** The new account holder differs from the current one - a strong fraud signal */
  holderNameChanged: boolean;
  reason: string | null;
  adminRemarks: string | null;
  /** Reviewer email */
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  ipAddress: string | null;
}

export interface BankChangeRequestDetail extends BankChangeRequest {
  kyc: (BankAccountSnapshot & {
    status: KycStatus;
    requestedMatchesKyc: boolean;
    holderMatchesKyc: boolean;
  }) | null;
  /** Pending / approved withdrawals that will still be paid to the old account */
  openWithdrawals: number;
  previousRequests: number;
}

export interface BankChangeListMeta extends PaginationMeta {
  pendingCount: number;
}
