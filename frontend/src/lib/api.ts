/**
 * Base URL of the Node API.
 * - NEXT_PUBLIC_API_URL wins when set (production / custom setups).
 * - Otherwise, in the browser, talk to port 5000 on whatever host served the page, so the
 *   app works when opened from another device on the LAN (http://192.168.x.x:3000).
 * - On the server (SSR) fall back to localhost.
 */
function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
}

export const API_BASE = resolveApiBase();


export interface AuthUser {
  id: number;
  name?: string;
  fullName?: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  kycStatus?: string;
}

export interface LoginSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

/** Customer logins are confirmed with a code emailed after a correct password */
export interface LoginOtpChallenge {
  otpRequired: true;
  /** Opaque id of this challenge; sent back with the code */
  challengeId: string;
  /** Masked address the code was sent to, e.g. ra***@gmail.com */
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  /** Only in local development without a mailbox */
  devOtp?: string;
}

export function isOtpChallenge(data: LoginSession | LoginOtpChallenge | undefined): data is LoginOtpChallenge {
  return Boolean(data && (data as LoginOtpChallenge).otpRequired === true);
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  data?: LoginSession | LoginOtpChallenge;
}

// ---------------------------------------------------------------------------
// Investment platform types
// ---------------------------------------------------------------------------
export interface FieldError {
  field?: string;
  message: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount?: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export interface ListParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export type PayoutMethod = 'BANK' | 'UPI';

export interface PayoutDetails {
  preferredMethod: PayoutMethod;
  upiId: string | null;
  accountHolderName: string | null;
  accountNumberMasked: string | null;
  ifscCode: string | null;
  bankName: string | null;
  hasBankDetails: boolean;
  hasUpiDetails: boolean;
  updatedAt: string | null;
}

export interface Profile {
  id: number;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  fullName: string | null;
  referralCode: string | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  payoutDetails: PayoutDetails | null;
  createdAt: string;
}

export type ReferralCommissionStatus = 'PENDING' | 'CREDITED' | 'CANCELLED';

export interface ReferredCustomer {
  id: number;
  referredUserId: number;
  fullName: string;
  email: string;
  phone: string;
  kycStatus: string;
  accountStatus: string;
  joinedAt: string;
  status: string;
  commissionEarned: number;
}

export interface ReferralCommission {
  id: number;
  referredUserId: number;
  referredName: string;
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

export interface ReferralSummary {
  referralCode: string;
  referredBy: string | null;
  commissionPercent: number;
  totalReferrals: number;
  verifiedReferrals: number;
  pendingKycReferrals: number;
  totalCommissionEarned: number;
  pendingCommission: number;
  pendingCommissionCount: number;
  referrals: ReferredCustomer[];
  commissions: ReferralCommission[];
}

export interface UpdateProfileInput {
  fullName?: string;
  dateOfBirth?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

export interface UpdatePayoutDetailsInput {
  preferredMethod: PayoutMethod;
  upiId?: string | null;
  accountHolderName?: string | null;
  /** Omit to keep the stored account number. */
  accountNumber?: string;
  ifscCode?: string | null;
  bankName?: string | null;
}

export interface WalletConfig {
  minTopup: number;
  maxTopup: number;
  upiId: string;
  upiPayeeName: string;
  /** API path of an admin-uploaded QR image (append to API_BASE); null = generate the QR from the UPI ID */
  upiQrImageUrl: string | null;
  depositInstructions: string;
  /** Bank transfer destination; offered only when the admin has configured all fields */
  bankTransferEnabled: boolean;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  bankTransferInstructions: string;
  requireKycForInvestment: boolean;
  requireKycForWithdrawal: boolean;
  /** Smallest profit-wallet withdrawal a customer may request */
  minWithdrawal: number;
  referralCommissionPercent: number;
  /** Deducted only when an investment is closed before it ends; matured capital, the capital wallet and profit are paid in full */
  capitalWithdrawalFeePercent: number;
  /** Human readable payout schedule for daily-profit plans and referral commission */
  payoutSchedule: string;
}

/**
 * CAPITAL: deposits and returned principal; invested from here and the only money that earns.
 * PROFIT: daily profit and referral commission; withdrawable any time, never earns by itself.
 */
export type WalletBucket = 'CAPITAL' | 'PROFIT';

export interface WalletSummary {
  /** capitalBalance + profitBalance */
  balance: number;
  /** Deposited money not yet invested + capital returned at maturity */
  capitalBalance: number;
  /** Daily profit and referral commission, withdrawable any time */
  profitBalance: number;
  /** Capital locked in running investments and earning daily profit */
  investedCapital: number;
  pendingDepositAmount: number;
  pendingDepositCount: number;
  totalDeposited: number;
  investedAmount: number;
  expectedProfit: number;
  totalProfitEarned: number;
  /** Daily profit credited so far by the 6:00 AM payout job */
  dailyProfitCredited: number;
  profitCreditedToday: number;
  profitCreditedThisMonth: number;
  lastProfitCreditDay: string | null;
  referralEarnings: number;
  referralEarningsPending: number;
  /** Net amount paid out to the customer so far */
  totalWithdrawn: number;
  totalFeesPaid: number;
  activeInvestments: number;
  maturedInvestments: number;
  pendingWithdrawals: number;
  /** Wallet money reserved by withdrawal requests still being processed */
  pendingWithdrawalAmount: number;
  pendingCapitalWithdrawalAmount: number;
  pendingProfitWithdrawalAmount: number;
  config: WalletConfig;
}

export type TransactionType =
  | 'DEPOSIT'
  | 'INVESTMENT'
  | 'MATURITY_PRINCIPAL'
  | 'PROFIT'
  | 'REFERRAL_COMMISSION'
  | 'WITHDRAWAL'
  | 'REFUND'
  | 'ADJUSTMENT';

export type TransactionDirection = 'CREDIT' | 'DEBIT';

export interface WalletTransaction {
  id: number;
  reference: string;
  type: TransactionType;
  direction: TransactionDirection;
  /** Which wallet moved; balanceBefore/After are that wallet's balances */
  bucket: WalletBucket;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  relatedEntity: string | null;
  relatedId: number | null;
  description: string | null;
  status: string;
  createdAt: string;
}

export interface TransactionListParams extends ListParams {
  type?: TransactionType | '';
  direction?: TransactionDirection | '';
  bucket?: WalletBucket | '';
}

export type DepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type DepositMethod = 'UPI' | 'BANK_TRANSFER';

export interface Deposit {
  id: number;
  reference: string;
  userId: number;
  amount: number;
  /** How the customer paid */
  paymentMethod: DepositMethod;
  /** UPI transaction ID (UTR) or bank transfer reference number */
  upiTransactionId: string;
  hasReceipt: boolean;
  status: DepositStatus;
  rejectionReason: string | null;
  adminRemarks: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface DepositListParams extends ListParams {
  status?: DepositStatus | '';
}

export interface CreateDepositInput {
  amount: number;
  paymentMethod: DepositMethod;
  upiTransactionId: string;
  receipt: File;
}

export type ProfitType = 'PERCENTAGE' | 'FIXED';

/**
 * What profitValue of a DAILY plan means.
 * PER_MONTH: % of the capital per month, paid as 20 working-day credits (4 weeks x 5 days).
 * PER_YEAR: % per year, paid as 240 working-day credits. PER_DAY: legacy, % every working day.
 */
export type RateBasis = 'PER_MONTH' | 'PER_YEAR' | 'PER_DAY';

export interface InvestmentPlan {
  id: number;
  name: string;
  description: string | null;
  minAmount: number;
  maxAmount: number;
  /** 0 = open-ended: runs until the customer withdraws the capital */
  durationDays: number;
  isOpenEnded: boolean;
  /** Legacy: days during which the capital could not be withdrawn (always 0 for new plans) */
  lockInDays: number;
  profitType: ProfitType;
  profitValue: number;
  /** AT_MATURITY: profit paid with the principal at the end. DAILY: profit credited every working day. */
  payoutMode: ProfitPayoutMode;
  rateBasis: RateBasis;
  /** Per-working-day % of the capital: 5% / month -> 0.25 */
  dailyRatePercent: number;
  creditsPerMonth: number;
  creditsPerWeek: number;
  isActive: boolean;
  isFeatured: boolean;
  featuredTagline: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type ProfitPayoutMode = 'AT_MATURITY' | 'DAILY';

export interface InvestmentPreview {
  planId: number;
  planName: string;
  amount: number;
  source: WalletBucket;
  durationDays: number;
  isOpenEnded: boolean;
  lockInDays: number;
  lockInEndsAt: string | null;
  profitType: ProfitType;
  profitValue: number;
  payoutMode: ProfitPayoutMode;
  rateBasis: RateBasis;
  dailyRatePercent: number;
  /** DAILY plans: profit credited per working day / week / month and the number of paying days in the term */
  dailyProfit: number;
  weeklyProfit: number;
  monthlyProfit: number;
  creditsPerCycle: number | null;
  profitDays: number;
  payoutHourIst: number;
  expectedProfit: number;
  maturityAmount: number;
  /** Early withdrawal fee that would apply if the plan were closed before it ends */
  feePercent: number;
  earlyExitFeeApplies: boolean;
  capitalWithdrawalFee: number;
  netCapitalOnWithdrawal: number;
  startDate: string;
  maturityDate: string | null;
}

export type InvestmentStatus =
  | 'ACTIVE'
  | 'MATURED'
  | 'WITHDRAWAL_REQUESTED'
  | 'COMPLETED'
  | 'CANCELLED';

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
  dailyProfit: number;
  weeklyProfit: number;
  monthlyProfit: number;
  profitDays: number;
  profitCredited: number;
  profitRemaining: number;
  /** DAILY plans: number of working days already credited */
  creditedDays: number;
  /** Monthly plans: at most this many credits per 30-day cycle (null for legacy per-day plans) */
  creditsPerCycle: number | null;
  currentCycle: number;
  creditsThisCycle: number;
  /** DAILY plans: ISO instant of the next 6:00 AM IST credit, null once all days are paid */
  nextCreditAt: string | null;
  /** DAILY plans: the next credit day has passed 6:00 AM and is about to be processed */
  nextCreditDue: boolean;
  /** Fee percent snapshotted at invest time; charged only while earlyExitFeeApplies (closing before maturity) */
  feePercent: number;
  /** True while the investment is running and has not matured: closing it now costs the fee */
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
  maturedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface InvestmentWithdrawalSummary {
  id: number;
  reference: string;
  principalAmount: number;
  profitAmount: number;
  totalAmount: number;
  feePercent: number;
  feeAmount: number;
  netAmount: number;
  status: WithdrawalStatus;
  isEarly: boolean;
  rejectionReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ProfitCreditEntry {
  id: number;
  creditDay: string;
  cycleNo: number;
  amount: number;
  creditedAt: string | null;
  walletTransactionId: number | null;
}

export interface InvestmentDetail extends Investment {
  withdrawals: InvestmentWithdrawalSummary[];
  profitCredits: ProfitCreditEntry[];
}

export interface InvestmentListParams extends ListParams {
  status?: InvestmentStatus | '';
  planId?: number;
}

export type WithdrawalSource = 'INVESTMENT' | 'WALLET';

export interface Withdrawal {
  id: number;
  reference: string;
  userId: number;
  source: WithdrawalSource;
  /** CAPITAL withdrawals carry the capital withdrawal fee; PROFIT withdrawals are free */
  bucket: WalletBucket;
  investmentId: number | null;
  investmentReference: string | null;
  planName: string | null;
  principalAmount: number;
  profitAmount: number;
  /** Gross requested; netAmount = totalAmount - feeAmount is what gets paid */
  totalAmount: number;
  feePercent: number;
  feeAmount: number;
  netAmount: number;
  isEarly: boolean;
  payoutMethod: PayoutMethod;
  payoutUpiId: string | null;
  payoutAccountHolder: string | null;
  payoutAccountMasked: string | null;
  payoutIfsc: string | null;
  payoutBankName: string | null;
  status: WithdrawalStatus;
  rejectionReason: string | null;
  paymentReference: string | null;
  hasPaymentProof: boolean;
  reviewedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WithdrawalListParams extends ListParams {
  status?: WithdrawalStatus | '';
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  relatedEntity: string | null;
  relatedId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export type KycReviewAction = 'VERIFY' | 'REJECT' | 'REQUEST_RESUBMISSION' | 'PUT_UNDER_REVIEW' | 'SUSPEND';

export interface KycHistoryEntry {
  id: number;
  action: KycReviewAction;
  remarks: string | null;
  createdAt: string;
}

export interface KycSubmittedDetails {
  maskedPan: string | null;
  maskedAadhaar: string | null;
  maskedAccountNumber: string | null;
  accountHolderName: string | null;
  ifscCode: string | null;
}

export interface KycStatusInfo {
  status: string;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  hasPassbook: boolean;
  hasPan: boolean;
  hasAadhaar: boolean;
  hasAadhaarBack: boolean;
  details: KycSubmittedDetails | null;
  history: KycHistoryEntry[];
  nextStep: string | null;
}

// ---------------------------------------------------------------------------
// Shared request helper
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  status: number;
  errors: FieldError[];

  constructor(message: string, status: number, errors: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

/** Fired on this window whenever the stored session changes (login / logout / expiry). */
export const AUTH_CHANGE_EVENT = 'moontech-auth-change';

const NETWORK_ERROR_MESSAGE = 'Unable to reach the server. Please check your connection and try again.';

type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Bearer token. When provided the call is treated as authenticated. */
  token?: string | null;
  /** Plain object (sent as JSON) or FormData (sent as multipart). */
  body?: object | FormData;
  query?: object;
  /** On 401 only clear the session; do not navigate (used by background polling). */
  noRedirect?: boolean;
}

export interface Envelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: PageMeta;
  errors?: FieldError[];
}

interface ApiResult<T> {
  data: T;
  meta?: PageMeta;
  message: string;
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

/** Only same-site relative paths are accepted as a post-login destination. */
export function safeRedirectPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  // Reject anything that is not a plain path (whitespace, control characters, backslash tricks)
  if (/[\s\u0000-\u001f]/.test(value) || value.includes('\\')) return fallback;
  // Never bounce back into the auth pages themselves (redirect loops)
  if (/^\/(login|register|forgot-password)(\/|\?|#|$)/.test(value)) return fallback;
  return value;
}

export function loginUrl(redirectPath?: string): string {
  if (!redirectPath) return '/login';
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}

function handleUnauthorized(redirect: boolean) {
  if (typeof window === 'undefined') return;
  clearSession();
  if (!redirect) return;
  const { pathname, search } = window.location;
  if (pathname.startsWith('/login')) return;
  window.location.assign(loginUrl(`${pathname}${search}`));
}

function buildUrl(path: string, query?: object): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query) as [string, QueryValue][]) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

function buildInit(options: RequestOptions): RequestInit {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    // Do not set Content-Type: the browser adds the multipart boundary itself.
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  return { method: options.method || 'GET', headers, body, cache: 'no-store' };
}

function errorFromEnvelope(status: number, json: Envelope<unknown> | null): ApiError {
  const errors = Array.isArray(json?.errors) ? json.errors.filter((e) => e && typeof e.message === 'string') : [];
  let message = json?.message || '';
  if (status === 422 && errors.length > 0) message = errors[0].message;
  if (!message && errors.length > 0) message = errors[0].message;
  if (!message) {
    message = status === 401 ? 'Your session has expired. Please sign in again.' : `Request failed (${status})`;
  }
  return new ApiError(message, status, errors);
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), buildInit(options));
  } catch {
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }
  if (res.status === 401 && options.token) {
    handleUnauthorized(!options.noRedirect);
  }
  return res;
}

async function parseJson<T>(res: Response): Promise<Envelope<T> | null> {
  try {
    return (await res.json()) as Envelope<T>;
  } catch {
    return null;
  }
}

/**
 * Performs the fetch, parses the JSON envelope and throws an ApiError carrying
 * the API message (or the first validation message) on failure.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const res = await send(path, options);
  const json = await parseJson<T>(res);
  if (!res.ok || !json || json.success === false) {
    throw errorFromEnvelope(res.status, json);
  }
  return { data: json.data as T, meta: json.meta, message: json.message || '' };
}

async function requestList<T>(path: string, options: RequestOptions = {}): Promise<Paginated<T>> {
  const result = await request<T[]>(path, options);
  const items = Array.isArray(result.data) ? result.data : [];
  const meta: PageMeta = {
    page: Number(result.meta?.page) || 1,
    limit: Number(result.meta?.limit) || items.length || 10,
    total: Number(result.meta?.total ?? items.length) || 0,
    totalPages: Math.max(1, Number(result.meta?.totalPages) || 1),
    unreadCount: result.meta?.unreadCount,
  };
  return { items, meta };
}

/** Fetches a protected file (receipt / payout proof) as a Blob. */
async function requestBlob(path: string, token: string): Promise<Blob> {
  const res = await send(path, { token });
  if (!res.ok) {
    throw errorFromEnvelope(res.status, await parseJson<unknown>(res));
  }
  return await res.blob();
}

export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const api = {
  // Auth: Login. Returns the envelope; throws ApiError only when the server cannot be reached.
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await send('/auth/login', { method: 'POST', body: { email: email.trim(), password } });
    const json = await parseJson<LoginResponse['data']>(res);
    if (!json) throw errorFromEnvelope(res.status, null);
    return { success: res.ok && json.success !== false, message: json.message, data: json.data };
  },

  // Auth: customer login step 2. Throws ApiError on a wrong / expired code.
  async verifyLoginOtp(challengeId: string, otp: string): Promise<LoginSession> {
    const result = await request<LoginSession>('/auth/login/verify-otp', {
      method: 'POST',
      body: { challengeId, otp: otp.trim() },
    });
    return result.data;
  },

  // Auth: email a fresh login code for the same sign-in attempt
  async resendLoginOtp(challengeId: string): Promise<LoginOtpChallenge & { message: string }> {
    const result = await request<LoginOtpChallenge>('/auth/login/resend-otp', { method: 'POST', body: { challengeId } });
    return { ...result.data, message: result.message };
  },

  // Auth: Register (matches backend registerSchema)
  async register(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    referralNumber: string;
    acceptedTerms: boolean;
  }) {
    // Throws ApiError with the server's message (or the first validation error) on failure.
    const result = await request<unknown>('/auth/register', {
      method: 'POST',
      body: {
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        password: data.password,
        confirmPassword: data.confirmPassword,
        referralNumber: data.referralNumber.trim().toUpperCase(),
        acceptedTerms: data.acceptedTerms,
      },
    });
    return { success: true as const, message: result.message };
  },

  // 5. Customer: Get KYC status (background check: never redirects on 401)
  async getKycStatus(token: string): Promise<Envelope<Record<string, unknown>>> {
    try {
      const res = await send('/kyc/status', { token, noRedirect: true });
      return (await parseJson<Record<string, unknown>>(res)) || { success: false };
    } catch {
      return { success: false };
    }
  },

  // 6. Customer: Submit KYC documents & details. Throws ApiError on failure.
  async submitKyc(token: string, formData: FormData): Promise<string> {
    const result = await request<unknown>('/kyc/submit', { method: 'POST', token, body: formData });
    return result.message;
  },

  /** Normalised KYC status. Never throws: KYC is optional, so failures fall back to DRAFT. */
  async getKycInfo(token: string): Promise<KycStatusInfo> {
    const res = await api.getKycStatus(token);
    const data = res.success && res.data && typeof res.data === 'object' ? res.data : null;
    const status = data?.kyc_status ?? data?.kycStatus ?? data?.status;
    const reason = data?.rejectionReason ?? data?.rejection_reason;
    const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
    const details = data?.details && typeof data.details === 'object' ? (data.details as KycSubmittedDetails) : null;
    return {
      status: str(status) || 'DRAFT',
      rejectionReason: str(reason),
      submittedAt: str(data?.submittedAt),
      reviewedAt: str(data?.reviewedAt),
      hasPassbook: Boolean(data?.hasPassbook),
      hasPan: Boolean(data?.hasPan),
      hasAadhaar: Boolean(data?.hasAadhaar),
      hasAadhaarBack: Boolean(data?.hasAadhaarBack),
      details,
      history: Array.isArray(data?.history) ? (data.history as KycHistoryEntry[]) : [],
      nextStep: str(data?.nextStep),
    };
  },

  // -------------------------------------------------------------------------
  // Password
  // -------------------------------------------------------------------------
  async changePassword(token: string, currentPassword: string, newPassword: string): Promise<string> {
    const result = await request<unknown>('/auth/change-password', {
      method: 'POST',
      token,
      body: { currentPassword, newPassword },
    });
    return result.message;
  },

  async forgotPassword(email: string): Promise<{ expiresInMinutes: number; message: string }> {
    const result = await request<{ expiresInMinutes?: number } | null>('/auth/forgot-password', {
      method: 'POST',
      body: { email: email.trim().toLowerCase() },
    });
    return { expiresInMinutes: Number(result.data?.expiresInMinutes) || 10, message: result.message };
  },

  async resetPassword(email: string, otp: string, newPassword: string): Promise<string> {
    const result = await request<unknown>('/auth/reset-password', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), otp: otp.trim(), newPassword },
    });
    return result.message;
  },

  // -------------------------------------------------------------------------
  // Profile
  // -------------------------------------------------------------------------
  async getProfile(token: string): Promise<Profile> {
    return (await request<Profile>('/profile', { token })).data;
  },

  async updateProfile(token: string, input: UpdateProfileInput): Promise<Profile> {
    return (await request<Profile>('/profile', { method: 'PUT', token, body: input })).data;
  },

  async updatePayoutDetails(token: string, input: UpdatePayoutDetailsInput): Promise<PayoutDetails> {
    return (await request<PayoutDetails>('/profile/payout-details', { method: 'PUT', token, body: input })).data;
  },

  // -------------------------------------------------------------------------
  // Wallet
  // -------------------------------------------------------------------------
  async getWallet(token: string): Promise<WalletSummary> {
    return (await request<WalletSummary>('/wallet', { token })).data;
  },

  async getTransactions(token: string, params: TransactionListParams = {}): Promise<Paginated<WalletTransaction>> {
    return requestList<WalletTransaction>('/wallet/transactions', { token, query: params });
  },

  async getDeposits(token: string, params: DepositListParams = {}): Promise<Paginated<Deposit>> {
    return requestList<Deposit>('/wallet/deposits', { token, query: params });
  },

  async createDeposit(token: string, input: CreateDepositInput): Promise<Deposit> {
    const formData = new FormData();
    formData.append('amount', String(input.amount));
    formData.append('paymentMethod', input.paymentMethod);
    formData.append('upiTransactionId', input.upiTransactionId.trim());
    formData.append('receipt', input.receipt);
    return (await request<Deposit>('/wallet/deposits', { method: 'POST', token, body: formData })).data;
  },

  async getDepositReceipt(token: string, depositId: number): Promise<Blob> {
    return requestBlob(`/wallet/deposits/${depositId}/receipt`, token);
  },

  // -------------------------------------------------------------------------
  // Investment plans & investments
  // -------------------------------------------------------------------------
  async getInvestmentPlans(): Promise<InvestmentPlan[]> {
    const result = await request<InvestmentPlan[]>('/investment-plans');
    return Array.isArray(result.data) ? result.data : [];
  },

  /** Plans the admin marked as featured, in display order. */
  async getFeaturedPlans(): Promise<InvestmentPlan[]> {
    const result = await request<InvestmentPlan[]>('/investment-plans/featured');
    return Array.isArray(result.data) ? result.data : [];
  },

  async previewInvestment(
    token: string,
    planId: number,
    amount: number,
    source: WalletBucket = 'CAPITAL'
  ): Promise<InvestmentPreview> {
    return (
      await request<InvestmentPreview>('/investments/preview', { method: 'POST', token, body: { planId, amount, source } })
    ).data;
  },

  /** `source` is the wallet that pays: CAPITAL by default, or PROFIT to re-invest earned profit */
  async createInvestment(token: string, planId: number, amount: number, source: WalletBucket = 'CAPITAL'): Promise<Investment> {
    return (await request<Investment>('/investments', { method: 'POST', token, body: { planId, amount, source } })).data;
  },

  async getInvestments(token: string, params: InvestmentListParams = {}): Promise<Paginated<Investment>> {
    return requestList<Investment>('/investments', { token, query: params });
  },

  async getInvestment(token: string, investmentId: number): Promise<InvestmentDetail> {
    return (await request<InvestmentDetail>(`/investments/${investmentId}`, { token })).data;
  },

  async requestWithdrawal(token: string, investmentId: number, payoutMethod?: PayoutMethod): Promise<Withdrawal> {
    return (
      await request<Withdrawal>(`/investments/${investmentId}/withdraw`, {
        method: 'POST',
        token,
        body: payoutMethod ? { payoutMethod } : {},
      })
    ).data;
  },

  // -------------------------------------------------------------------------
  // Withdrawals
  // -------------------------------------------------------------------------
  async getWithdrawals(token: string, params: WithdrawalListParams = {}): Promise<Paginated<Withdrawal>> {
    return requestList<Withdrawal>('/withdrawals', { token, query: params });
  },

  /**
   * Withdraw from the wallet to bank / UPI.
   * PROFIT: any amount of daily profit / referral commission, no fee.
   * CAPITAL: the whole available capital balance, less the capital withdrawal fee (amount is ignored).
   */
  async requestWalletWithdrawal(
    token: string,
    input: { bucket: WalletBucket; amount?: number; payoutMethod?: PayoutMethod }
  ): Promise<Withdrawal> {
    const body: Record<string, unknown> = { bucket: input.bucket };
    if (input.bucket === 'PROFIT') body.amount = input.amount;
    if (input.payoutMethod) body.payoutMethod = input.payoutMethod;
    return (await request<Withdrawal>('/wallet/withdrawals', { method: 'POST', token, body })).data;
  },

  async getMyReferrals(token: string): Promise<ReferralSummary> {
    return (await request<ReferralSummary>('/referrals/my', { token })).data;
  },

  async getWithdrawalProof(token: string, withdrawalId: number): Promise<Blob> {
    return requestBlob(`/withdrawals/${withdrawalId}/proof`, token);
  },

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------
  async getNotifications(token: string, params: NotificationListParams = {}): Promise<Paginated<AppNotification>> {
    return requestList<AppNotification>('/notifications', {
      token,
      query: { page: params.page, limit: params.limit, unreadOnly: params.unreadOnly ? 'true' : undefined },
    });
  },

  async getUnreadCount(token: string): Promise<number> {
    const result = await request<{ unreadCount?: number }>('/notifications/unread-count', { token, noRedirect: true });
    return Number(result.data?.unreadCount) || 0;
  },

  async markNotificationRead(token: string, notificationId: number): Promise<void> {
    await request<unknown>(`/notifications/${notificationId}/read`, { method: 'POST', token });
  },

  async markAllNotificationsRead(token: string): Promise<number> {
    const result = await request<{ updated?: number }>('/notifications/read-all', { method: 'POST', token });
    return Number(result.data?.updated) || 0;
  },
};
