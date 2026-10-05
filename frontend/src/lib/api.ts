export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';


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

export interface LoginResponse {
  success: boolean;
  message?: string;
  data?: {
    user: AuthUser;
    accessToken: string;
    refreshToken?: string;
  };
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
  depositInstructions: string;
  requireKycForInvestment: boolean;
}

export interface WalletSummary {
  balance: number;
  pendingDepositAmount: number;
  pendingDepositCount: number;
  totalDeposited: number;
  investedAmount: number;
  expectedProfit: number;
  totalProfitEarned: number;
  totalWithdrawn: number;
  activeInvestments: number;
  maturedInvestments: number;
  pendingWithdrawals: number;
  config: WalletConfig;
}

export type TransactionType =
  | 'DEPOSIT'
  | 'INVESTMENT'
  | 'MATURITY_PRINCIPAL'
  | 'PROFIT'
  | 'WITHDRAWAL'
  | 'REFUND'
  | 'ADJUSTMENT';

export type TransactionDirection = 'CREDIT' | 'DEBIT';

export interface WalletTransaction {
  id: number;
  reference: string;
  type: TransactionType;
  direction: TransactionDirection;
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
}

export type DepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Deposit {
  id: number;
  reference: string;
  userId: number;
  amount: number;
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
  upiTransactionId: string;
  receipt: File;
}

export type ProfitType = 'PERCENTAGE' | 'FIXED';

export interface InvestmentPlan {
  id: number;
  name: string;
  description: string | null;
  minAmount: number;
  maxAmount: number;
  durationDays: number;
  profitType: ProfitType;
  profitValue: number;
  isActive: boolean;
  isFeatured: boolean;
  featuredTagline: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentPreview {
  planId: number;
  planName: string;
  amount: number;
  durationDays: number;
  profitType: ProfitType;
  profitValue: number;
  expectedProfit: number;
  maturityAmount: number;
  startDate: string;
  maturityDate: string;
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
  totalAmount: number;
  status: WithdrawalStatus;
  rejectionReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface InvestmentDetail extends Investment {
  withdrawals: InvestmentWithdrawalSummary[];
}

export interface InvestmentListParams extends ListParams {
  status?: InvestmentStatus | '';
  planId?: number;
}

export interface Withdrawal {
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

export interface KycStatusInfo {
  status: string;
  rejectionReason: string | null;
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

  // Auth: Register (matches backend registerSchema)
  async register(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    referralNumber?: string | null;
  }) {
    // Throws ApiError with the server's message (or the first validation error) on failure.
    const result = await request<unknown>('/auth/register', {
      method: 'POST',
      body: {
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        password: data.password,
        referralNumber: data.referralNumber ? data.referralNumber.trim() : undefined,
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
    return {
      status: typeof status === 'string' && status ? status : 'DRAFT',
      rejectionReason: typeof reason === 'string' && reason ? reason : null,
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

  async forgotPassword(identifier: string): Promise<{ expiresInMinutes: number; message: string }> {
    const result = await request<{ expiresInMinutes?: number } | null>('/auth/forgot-password', {
      method: 'POST',
      body: { identifier: identifier.trim() },
    });
    return { expiresInMinutes: Number(result.data?.expiresInMinutes) || 10, message: result.message };
  },

  async resetPassword(identifier: string, otp: string, newPassword: string): Promise<string> {
    const result = await request<unknown>('/auth/reset-password', {
      method: 'POST',
      body: { identifier: identifier.trim(), otp: otp.trim(), newPassword },
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

  async previewInvestment(token: string, planId: number, amount: number): Promise<InvestmentPreview> {
    return (await request<InvestmentPreview>('/investments/preview', { method: 'POST', token, body: { planId, amount } })).data;
  },

  async createInvestment(token: string, planId: number, amount: number): Promise<Investment> {
    return (await request<Investment>('/investments', { method: 'POST', token, body: { planId, amount } })).data;
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
