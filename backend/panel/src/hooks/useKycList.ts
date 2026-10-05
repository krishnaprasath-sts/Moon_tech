import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { kycApi } from '../api';
import { KycCounts, KycSubmissionSummary, PaginationMeta } from '../types';

export interface UseKycListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface KycListResponse {
  kycSubmissions: KycSubmissionSummary[];
  counts: KycCounts;
  meta?: PaginationMeta;
}

const EMPTY_COUNTS: KycCounts = { all: 0, pending: 0, verified: 0, rejected: 0, resubmission: 0 };

// A KYC decision changes the queue, the dossier, the customer's profile, the dashboard and the audit log
const invalidateKyc = (queryClient: QueryClient, id?: number | string) => {
  ['kyc-list', 'dashboard-stats', 'customers', 'customer', 'activity-logs'].forEach((key) =>
    queryClient.invalidateQueries({ queryKey: [key] })
  );
  if (id !== undefined) {
    queryClient.invalidateQueries({ queryKey: ['kyc-detail', String(id)] });
  }
};

export const useKycList = (params: UseKycListParams = {}) => {
  return useQuery<KycListResponse>({
    queryKey: ['kyc-list', params],
    queryFn: async () => {
      const res = await kycApi.getKycList(params);
      return {
        kycSubmissions: res.data || [],
        counts: res.counts || res.meta?.counts || EMPTY_COUNTS,
        meta: res.meta,
      };
    },
  });
};

// Keys are normalised to strings so route params and numeric ids invalidate the same entry
export const useKyc = (id: number | string) => {
  return useQuery({
    queryKey: ['kyc-detail', String(id)],
    queryFn: async () => {
      const res = await kycApi.getKycById(id);
      return res.data;
    },
    enabled: !!id,
  });
};

export const useManualSubmitKyc = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      return await kycApi.manualSubmit(formData);
    },
    onSuccess: () => invalidateKyc(queryClient),
  });
};

export const useVerifyKyc = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, remarks }: { id: number | string; remarks?: string }) => {
      return await kycApi.verify(id, { remarks });
    },
    onSuccess: (_, variables) => invalidateKyc(queryClient, variables.id),
  });
};

export const useRejectKyc = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      rejectionReason,
      remarks,
    }: {
      id: number | string;
      rejectionReason: string;
      remarks?: string;
    }) => {
      return await kycApi.reject(id, { rejectionReason, remarks });
    },
    onSuccess: (_, variables) => invalidateKyc(queryClient, variables.id),
  });
};

export const useResubmitKyc = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, remarks }: { id: number | string; remarks: string }) => {
      return await kycApi.resubmit(id, { remarks });
    },
    onSuccess: (_, variables) => invalidateKyc(queryClient, variables.id),
  });
};
