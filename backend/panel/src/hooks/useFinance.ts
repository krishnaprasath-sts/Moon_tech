import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import {
  financeApi,
  FinanceListParams,
  InvestmentListParams,
  WalletLedgerParams,
  ReportParams,
} from '../api';
import {
  InvestmentPlanPayload,
  PlatformSettings,
  ReportType,
  WalletAdjustmentPayload,
} from '../types';

const invalidateKeys = (queryClient: QueryClient, keys: string[]) => {
  keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
};

// Every money movement changes the dashboard, the ledger, the customer's finance view,
// the customer list (investment counts) and the activity log
const invalidateFinance = (queryClient: QueryClient, keys: string[]) => {
  invalidateKeys(queryClient, [
    ...keys,
    'finance-dashboard',
    'customer-finance',
    'wallet-ledger',
    'customers',
    'activity-logs',
  ]);
};

// ---------------------------------------------------------------------------
// Dashboard & customer finance
// ---------------------------------------------------------------------------
export const useFinanceDashboard = () => {
  return useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: async () => {
      const res = await financeApi.getDashboard();
      return res.data;
    },
  });
};

export const useCustomerFinance = (customerId: number | string) => {
  return useQuery({
    queryKey: ['customer-finance', String(customerId)],
    queryFn: async () => {
      const res = await financeApi.getCustomerFinance(customerId);
      return res.data;
    },
    enabled: !!customerId,
  });
};

export const useAdjustWallet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: number | string; data: WalletAdjustmentPayload }) => {
      return await financeApi.adjustWallet(userId, data);
    },
    onSuccess: () => {
      invalidateFinance(queryClient, []);
    },
  });
};

// ---------------------------------------------------------------------------
// Platform settings
// ---------------------------------------------------------------------------
export const usePlatformSettings = () => {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const res = await financeApi.getSettings();
      return res.data;
    },
  });
};

export const useUpdatePlatformSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<PlatformSettings>) => {
      return await financeApi.updateSettings(data);
    },
    onSuccess: () => {
      invalidateKeys(queryClient, ['platform-settings', 'activity-logs']);
    },
  });
};

// ---------------------------------------------------------------------------
// Payments (UPI deposits)
// ---------------------------------------------------------------------------
export const useAdminDeposits = (params: FinanceListParams = {}) => {
  return useQuery({
    queryKey: ['admin-deposits', params],
    queryFn: async () => {
      const res = await financeApi.getDeposits(params);
      return {
        deposits: res.data || [],
        meta: res.meta,
        counts: res.meta?.counts || {},
      };
    },
  });
};

export const useApproveDeposit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, remarks }: { id: number | string; remarks?: string }) => {
      return await financeApi.approveDeposit(id, { remarks });
    },
    onSuccess: () => {
      invalidateFinance(queryClient, ['admin-deposits']);
    },
  });
};

export const useRejectDeposit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason, remarks }: { id: number | string; reason: string; remarks?: string }) => {
      return await financeApi.rejectDeposit(id, { reason, remarks });
    },
    onSuccess: () => {
      invalidateFinance(queryClient, ['admin-deposits']);
    },
  });
};

// ---------------------------------------------------------------------------
// Investment plans
// ---------------------------------------------------------------------------
const PLAN_KEYS = ['admin-investment-plans', 'activity-logs'];

export const useInvestmentPlans = () => {
  return useQuery({
    queryKey: ['admin-investment-plans'],
    queryFn: async () => {
      const res = await financeApi.getPlans();
      return res.data || [];
    },
  });
};

export const useCreateInvestmentPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InvestmentPlanPayload) => {
      return await financeApi.createPlan(data);
    },
    onSuccess: () => invalidateKeys(queryClient, PLAN_KEYS),
  });
};

export const useUpdateInvestmentPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number | string; data: Partial<InvestmentPlanPayload> }) => {
      return await financeApi.updatePlan(id, data);
    },
    onSuccess: () => invalidateKeys(queryClient, PLAN_KEYS),
  });
};

export const useToggleInvestmentPlanStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number | string; isActive: boolean }) => {
      return await financeApi.togglePlanStatus(id, isActive);
    },
    onSuccess: () => invalidateKeys(queryClient, PLAN_KEYS),
  });
};

export const useSetInvestmentPlanFeatured = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isFeatured }: { id: number | string; isFeatured: boolean }) => {
      return await financeApi.setPlanFeatured(id, isFeatured);
    },
    onSuccess: () => invalidateKeys(queryClient, PLAN_KEYS),
  });
};

export const useDeleteInvestmentPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number | string) => {
      return await financeApi.deletePlan(id);
    },
    onSuccess: () => invalidateKeys(queryClient, PLAN_KEYS),
  });
};

// ---------------------------------------------------------------------------
// Investments
// ---------------------------------------------------------------------------
export const useAdminInvestments = (params: InvestmentListParams = {}) => {
  return useQuery({
    queryKey: ['admin-investments', params],
    queryFn: async () => {
      const res = await financeApi.getInvestments(params);
      return {
        investments: res.data || [],
        meta: res.meta,
        counts: res.meta?.counts || {},
      };
    },
  });
};

export const useAdminInvestment = (id: number | string | null) => {
  return useQuery({
    queryKey: ['admin-investment', String(id)],
    queryFn: async () => {
      const res = await financeApi.getInvestmentById(id as number | string);
      return res.data;
    },
    enabled: !!id,
  });
};

export const useCancelInvestment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: number | string; reason: string }) => {
      return await financeApi.cancelInvestment(id, { reason });
    },
    onSuccess: () => {
      invalidateFinance(queryClient, ['admin-investments', 'admin-investment', 'admin-investment-plans']);
    },
  });
};

export const useSetEarlyWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, allowed }: { id: number | string; allowed: boolean }) => {
      return await financeApi.setEarlyWithdrawal(id, allowed);
    },
    onSuccess: () => {
      invalidateFinance(queryClient, ['admin-investments', 'admin-investment']);
    },
  });
};

// ---------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------
const WITHDRAWAL_KEYS = ['admin-withdrawals', 'admin-withdrawal', 'admin-investments', 'admin-investment'];

export const useAdminWithdrawals = (params: FinanceListParams = {}) => {
  return useQuery({
    queryKey: ['admin-withdrawals', params],
    queryFn: async () => {
      const res = await financeApi.getWithdrawals(params);
      return {
        withdrawals: res.data || [],
        meta: res.meta,
        counts: res.meta?.counts || {},
      };
    },
  });
};

export const useAdminWithdrawal = (id: number | string | null) => {
  return useQuery({
    queryKey: ['admin-withdrawal', String(id)],
    queryFn: async () => {
      const res = await financeApi.getWithdrawalById(id as number | string);
      return res.data;
    },
    enabled: !!id,
  });
};

export const useApproveWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      remarks,
      profitAmount,
    }: {
      id: number | string;
      remarks?: string;
      profitAmount?: number;
    }) => {
      return await financeApi.approveWithdrawal(id, { remarks, profitAmount });
    },
    onSuccess: () => {
      invalidateFinance(queryClient, WITHDRAWAL_KEYS);
    },
  });
};

export const useRejectWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason, remarks }: { id: number | string; reason: string; remarks?: string }) => {
      return await financeApi.rejectWithdrawal(id, { reason, remarks });
    },
    onSuccess: () => {
      invalidateFinance(queryClient, WITHDRAWAL_KEYS);
    },
  });
};

export const useCompleteWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: number | string; formData: FormData }) => {
      return await financeApi.completeWithdrawal(id, formData);
    },
    onSuccess: () => {
      invalidateFinance(queryClient, WITHDRAWAL_KEYS);
    },
  });
};

// ---------------------------------------------------------------------------
// Wallet ledger
// ---------------------------------------------------------------------------
export const useWalletLedger = (params: WalletLedgerParams = {}) => {
  return useQuery({
    queryKey: ['wallet-ledger', params],
    queryFn: async () => {
      const res = await financeApi.getWalletTransactions(params);
      return {
        transactions: res.data || [],
        meta: res.meta,
      };
    },
  });
};

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
export const useAnnouncements = (params: { page?: number; limit?: number } = {}) => {
  return useQuery({
    queryKey: ['announcements', params],
    queryFn: async () => {
      const res = await financeApi.getAnnouncements(params);
      return {
        announcements: res.data || [],
        meta: res.meta,
      };
    },
  });
};

export const useCreateAnnouncement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; message: string }) => {
      return await financeApi.createAnnouncement(data);
    },
    onSuccess: () => invalidateKeys(queryClient, ['announcements', 'activity-logs']),
  });
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export interface UseFinanceReportParams extends ReportParams {
  type: ReportType;
  // Bumped on every "Generate" click so the same filters can be re-run
  requestId: number;
}

export const useFinanceReport = (params: UseFinanceReportParams | null) => {
  return useQuery({
    queryKey: ['finance-report', params],
    queryFn: async () => {
      const { type, startDate, endDate } = params as UseFinanceReportParams;
      const res = await financeApi.getReport(type, { startDate, endDate });
      return res.data;
    },
    enabled: !!params,
    retry: false,
  });
};
