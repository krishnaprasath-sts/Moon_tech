import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bankChangeApi, BankChangeListParams } from '../api/bankChanges';

const PENDING_POLL_MS = 30_000;

export const useBankChangeRequests = (params: BankChangeListParams = {}) => {
  return useQuery({
    queryKey: ['bank-change-requests', params],
    queryFn: async () => {
      const res = await bankChangeApi.getList(params);
      return { requests: res.data || [], meta: res.meta };
    },
  });
};

export const useBankChangeRequest = (id: number | null) => {
  return useQuery({
    queryKey: ['bank-change-request', id],
    queryFn: async () => (await bankChangeApi.getById(id as number)).data,
    enabled: id !== null,
  });
};

export const useBankChangePendingCount = () => {
  return useQuery({
    queryKey: ['bank-change-pending-count'],
    queryFn: async () => (await bankChangeApi.getPendingCount()).data,
    refetchInterval: PENDING_POLL_MS,
  });
};

const useInvalidateBankChanges = () => {
  const queryClient = useQueryClient();
  return () =>
    [
      'bank-change-requests',
      'bank-change-request',
      'bank-change-pending-count',
      'admin-withdrawals',
      'admin-withdrawal',
      'customer',
      'customer-finance',
      'activity-logs',
    ].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
};

export const useApproveBankChange = () => {
  const invalidate = useInvalidateBankChanges();
  return useMutation({
    mutationFn: async ({ id, remarks }: { id: number; remarks?: string }) => bankChangeApi.approve(id, { remarks }),
    onSuccess: invalidate,
  });
};

export const useRejectBankChange = () => {
  const invalidate = useInvalidateBankChanges();
  return useMutation({
    mutationFn: async ({ id, remarks }: { id: number; remarks: string }) => bankChangeApi.reject(id, { remarks }),
    onSuccess: invalidate,
  });
};
