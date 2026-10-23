import { apiClient } from './client';
import {
  ApiResponse,
  User,
  CustomerSummary,
  CustomerDetail,
  KycSubmissionSummary,
  KycDetail,
  KycCounts,
  ReferralRecord,
  ActivityLogRecord,
  DashboardStats,
  StaffMember,
  UserStatus,
  FinanceListResponse,
  FinanceDashboard,
  CustomerFinance,
  PlatformSettings,
  AdminDeposit,
  DepositApprovalResult,
  InvestmentPlan,
  InvestmentPlanPayload,
  AdminInvestment,
  AdminWithdrawal,
  AdminWithdrawalDetail,
  AdminWalletTransaction,
  WalletTransaction,
  WalletAdjustmentPayload,
  Announcement,
  FinanceReport,
  ReportType,
  PayoutJobStatus,
  PayoutRunResult,
  AdminReferralCommission,
} from '../types';

export type KycDocumentType = 'passbook' | 'pan' | 'aadhaar' | 'aadhaar-back';

// The KYC list may carry its counters at the top level or inside meta
export type KycListApiResponse = ApiResponse<KycSubmissionSummary[]> & {
  counts?: KycCounts;
  meta?: ApiResponse['meta'] & { counts?: KycCounts };
};

export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const res = await apiClient.post<ApiResponse<{ user: User; accessToken: string }>>(
      '/auth/login',
      credentials
    );
    return res.data;
  },
  getMe: async () => {
    const res = await apiClient.get<ApiResponse<User>>('/auth/me');
    return res.data;
  },
  logout: async () => {
    const res = await apiClient.post<ApiResponse<null>>('/auth/logout');
    return res.data;
  },
};

export const dashboardApi = {
  getStats: async () => {
    const res = await apiClient.get<ApiResponse<DashboardStats>>('/admin/dashboard/stats');
    return res.data;
  },
};

export interface CreateCustomerPayload {
  name: string;
  email: string;
  phone: string;
  password?: string;
  referralNumber?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export const customerApi = {
  getCustomers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    kycStatus?: string;
    status?: string;
  }) => {
    const res = await apiClient.get<ApiResponse<CustomerSummary[]>>('/admin/customers', { params });
    return res.data;
  },
  getCustomerById: async (id: number | string) => {
    const res = await apiClient.get<ApiResponse<CustomerDetail>>(`/admin/customers/${id}`);
    return res.data;
  },
  createCustomer: async (data: CreateCustomerPayload) => {
    const res = await apiClient.post<ApiResponse<CustomerSummary>>('/admin/customers', data);
    return res.data;
  },
  updateStatus: async (id: number | string, data: { status: UserStatus; reason?: string }) => {
    const res = await apiClient.patch<ApiResponse<{ id: number; status: UserStatus }>>(
      `/admin/customers/${id}/status`,
      data
    );
    return res.data;
  },
};

export const kycApi = {
  getKycList: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const res = await apiClient.get<KycListApiResponse>('/admin/kyc', { params });
    return res.data;
  },
  getKycById: async (id: number | string) => {
    const res = await apiClient.get<ApiResponse<KycDetail>>(`/admin/kyc/${id}`);
    return res.data;
  },
  manualSubmit: async (formData: FormData) => {
    const res = await apiClient.post<ApiResponse<KycDetail>>('/admin/kyc/manual-submit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  verify: async (id: number | string, data?: { remarks?: string }) => {
    const res = await apiClient.post<ApiResponse<KycDetail>>(`/admin/kyc/${id}/verify`, data || {});
    return res.data;
  },
  reject: async (id: number | string, data: { rejectionReason: string; remarks?: string }) => {
    const res = await apiClient.post<ApiResponse<KycDetail>>(`/admin/kyc/${id}/reject`, data);
    return res.data;
  },
  resubmit: async (id: number | string, data: { remarks: string }) => {
    const res = await apiClient.post<ApiResponse<KycDetail>>(`/admin/kyc/${id}/resubmit`, data);
    return res.data;
  },
  // Relative API path - documents are always fetched as a blob with the bearer header, never linked directly
  getDocumentPath: (kycId: number | string, type: KycDocumentType) => `/admin/kyc/${kycId}/document/${type}`,
};

export const staffApi = {
  getStaff: async () => {
    const res = await apiClient.get<ApiResponse<StaffMember[]>>('/admin/staff');
    return res.data;
  },
  createStaff: async (data: { email: string; phone: string; password: string; role: string }) => {
    const res = await apiClient.post<ApiResponse<StaffMember>>('/admin/staff', data);
    return res.data;
  },
  updateRole: async (id: number | string, data: { role: string }) => {
    const res = await apiClient.put<ApiResponse<StaffMember>>(`/admin/staff/${id}/role`, data);
    return res.data;
  },
  updateStatus: async (id: number | string, data: { status: string; reason?: string }) => {
    const res = await apiClient.put<ApiResponse<StaffMember>>(`/admin/staff/${id}/status`, data);
    return res.data;
  },
  deleteStaff: async (id: number | string) => {
    const res = await apiClient.delete<ApiResponse<null>>(`/admin/staff/${id}`);
    return res.data;
  },
};

export const referralApi = {
  getReferrals: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get<ApiResponse<ReferralRecord[]>>('/admin/referrals', { params });
    return res.data;
  },
  getCommissions: async (params?: { page?: number; limit?: number; status?: string }) => {
    const res = await apiClient.get<ApiResponse<AdminReferralCommission[]>>('/admin/referrals/commissions', { params });
    return res.data;
  },
};

// Daily profit / referral commission payout job (06:00 AM IST, working days)
export const payoutApi = {
  getStatus: async () => {
    const res = await apiClient.get<ApiResponse<PayoutJobStatus>>('/admin/payouts/status');
    return res.data;
  },
  run: async () => {
    const res = await apiClient.post<ApiResponse<PayoutRunResult>>('/admin/payouts/run');
    return res.data;
  },
};

export const activityLogApi = {
  getLogs: async (params?: { page?: number; limit?: number; search?: string; entity?: string }) => {
    const res = await apiClient.get<ApiResponse<ActivityLogRecord[]>>('/admin/activity-logs', {
      params,
    });
    return res.data;
  },
};

export interface FinanceListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  userId?: number;
  startDate?: string;
  endDate?: string;
}

export interface InvestmentListParams extends FinanceListParams {
  planId?: number;
  maturingInDays?: number;
}

export interface WalletLedgerParams extends Omit<FinanceListParams, 'status'> {
  type?: string;
  direction?: string;
  bucket?: string;
}

export interface ReportParams {
  startDate?: string;
  endDate?: string;
}

export const financeApi = {
  // Dashboard & customer finance
  getDashboard: async () => {
    const res = await apiClient.get<ApiResponse<FinanceDashboard>>('/admin/finance/dashboard');
    return res.data;
  },
  getCustomerFinance: async (customerId: number | string) => {
    const res = await apiClient.get<ApiResponse<CustomerFinance>>(`/admin/customers/${customerId}/finance`);
    return res.data;
  },

  // Platform settings
  getSettings: async () => {
    const res = await apiClient.get<ApiResponse<PlatformSettings>>('/admin/settings');
    return res.data;
  },
  updateSettings: async (data: Partial<PlatformSettings>) => {
    const res = await apiClient.put<ApiResponse<PlatformSettings>>('/admin/settings', data);
    return res.data;
  },
  /** Upload a custom UPI QR image (JPEG / PNG / WEBP, up to 2 MB) shown to customers instead of the generated QR */
  uploadUpiQr: async (file: File) => {
    const form = new FormData();
    form.append('qrImage', file);
    const res = await apiClient.post<ApiResponse<PlatformSettings>>('/admin/settings/upi-qr', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  /** Remove the custom UPI QR image; the QR is generated from the UPI ID again */
  removeUpiQr: async () => {
    const res = await apiClient.delete<ApiResponse<PlatformSettings>>('/admin/settings/upi-qr');
    return res.data;
  },

  // Payments (bank transfer deposits)
  getDeposits: async (params?: FinanceListParams) => {
    const res = await apiClient.get<FinanceListResponse<AdminDeposit[]>>('/admin/deposits', { params });
    return res.data;
  },
  getDepositById: async (id: number | string) => {
    const res = await apiClient.get<ApiResponse<AdminDeposit>>(`/admin/deposits/${id}`);
    return res.data;
  },
  approveDeposit: async (id: number | string, data?: { remarks?: string }) => {
    const res = await apiClient.post<ApiResponse<DepositApprovalResult>>(
      `/admin/deposits/${id}/approve`,
      data || {}
    );
    return res.data;
  },
  rejectDeposit: async (id: number | string, data: { reason: string; remarks?: string }) => {
    const res = await apiClient.post<ApiResponse<AdminDeposit>>(`/admin/deposits/${id}/reject`, data);
    return res.data;
  },
  getDepositReceiptPath: (id: number | string) => `/admin/deposits/${id}/receipt`,

  // Investment plans
  getPlans: async () => {
    const res = await apiClient.get<ApiResponse<InvestmentPlan[]>>('/admin/investment-plans');
    return res.data;
  },
  createPlan: async (data: InvestmentPlanPayload) => {
    const res = await apiClient.post<ApiResponse<InvestmentPlan>>('/admin/investment-plans', data);
    return res.data;
  },
  updatePlan: async (id: number | string, data: Partial<InvestmentPlanPayload>) => {
    const res = await apiClient.put<ApiResponse<InvestmentPlan>>(`/admin/investment-plans/${id}`, data);
    return res.data;
  },
  togglePlanStatus: async (id: number | string, isActive: boolean) => {
    const res = await apiClient.patch<ApiResponse<InvestmentPlan>>(`/admin/investment-plans/${id}/status`, {
      isActive,
    });
    return res.data;
  },
  setPlanFeatured: async (id: number | string, isFeatured: boolean, featuredTagline?: string | null) => {
    const res = await apiClient.patch<ApiResponse<InvestmentPlan>>(`/admin/investment-plans/${id}/featured`, {
      isFeatured,
      ...(featuredTagline !== undefined ? { featuredTagline } : {}),
    });
    return res.data;
  },
  deletePlan: async (id: number | string) => {
    const res = await apiClient.delete<ApiResponse<null>>(`/admin/investment-plans/${id}`);
    return res.data;
  },

  // Investments
  getInvestments: async (params?: InvestmentListParams) => {
    const res = await apiClient.get<FinanceListResponse<AdminInvestment[]>>('/admin/investments', { params });
    return res.data;
  },
  getInvestmentById: async (id: number | string) => {
    const res = await apiClient.get<ApiResponse<AdminInvestment>>(`/admin/investments/${id}`);
    return res.data;
  },
  cancelInvestment: async (id: number | string, data: { reason: string }) => {
    const res = await apiClient.post<ApiResponse<AdminInvestment>>(`/admin/investments/${id}/cancel`, data);
    return res.data;
  },
  setEarlyWithdrawal: async (id: number | string, allowed: boolean) => {
    const res = await apiClient.patch<ApiResponse<AdminInvestment>>(
      `/admin/investments/${id}/early-withdrawal`,
      { allowed }
    );
    return res.data;
  },

  // Withdrawals
  getWithdrawals: async (params?: FinanceListParams) => {
    const res = await apiClient.get<FinanceListResponse<AdminWithdrawal[]>>('/admin/withdrawals', { params });
    return res.data;
  },
  getWithdrawalById: async (id: number | string) => {
    const res = await apiClient.get<ApiResponse<AdminWithdrawalDetail>>(`/admin/withdrawals/${id}`);
    return res.data;
  },
  approveWithdrawal: async (id: number | string, data?: { remarks?: string; profitAmount?: number }) => {
    const res = await apiClient.post<ApiResponse<AdminWithdrawal>>(
      `/admin/withdrawals/${id}/approve`,
      data || {}
    );
    return res.data;
  },
  rejectWithdrawal: async (id: number | string, data: { reason: string; remarks?: string }) => {
    const res = await apiClient.post<ApiResponse<AdminWithdrawal>>(`/admin/withdrawals/${id}/reject`, data);
    return res.data;
  },
  completeWithdrawal: async (id: number | string, formData: FormData) => {
    const res = await apiClient.post<ApiResponse<AdminWithdrawal>>(
      `/admin/withdrawals/${id}/complete`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data;
  },
  getWithdrawalProofPath: (id: number | string) => `/admin/withdrawals/${id}/proof`,

  // Wallet ledger
  getWalletTransactions: async (params?: WalletLedgerParams) => {
    const res = await apiClient.get<FinanceListResponse<AdminWalletTransaction[]>>(
      '/admin/wallets/transactions',
      { params }
    );
    return res.data;
  },
  adjustWallet: async (userId: number | string, data: WalletAdjustmentPayload) => {
    const res = await apiClient.post<ApiResponse<WalletTransaction>>(`/admin/wallets/${userId}/adjust`, data);
    return res.data;
  },

  // Announcements
  getAnnouncements: async (params?: { page?: number; limit?: number }) => {
    const res = await apiClient.get<ApiResponse<Announcement[]>>('/admin/announcements', { params });
    return res.data;
  },
  createAnnouncement: async (data: { title: string; message: string }) => {
    const res = await apiClient.post<ApiResponse<Announcement>>('/admin/announcements', data);
    return res.data;
  },

  // Reports
  getReport: async (type: ReportType, params?: ReportParams) => {
    const res = await apiClient.get<ApiResponse<FinanceReport>>(`/admin/reports/${type}`, {
      params: { ...params, format: 'json' },
    });
    return res.data;
  },
  // Fetched as a blob with the bearer header so the token never appears in a URL
  downloadReportCsv: async (type: ReportType, params?: ReportParams) => {
    const res = await apiClient.get<Blob>(`/admin/reports/${type}`, {
      params: { ...params, format: 'csv' },
      responseType: 'blob',
    });
    return res.data;
  },
};
