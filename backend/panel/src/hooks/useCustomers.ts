import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi, CreateCustomerPayload } from '../api';
import { UserStatus } from '../types';

export interface UseCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  kycStatus?: string;
  status?: string;
}

export const useCustomers = (params: UseCustomersParams = {}, options: { enabled?: boolean } = {}) => {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: async () => {
      const res = await customerApi.getCustomers(params);
      return {
        customers: res.data || [],
        meta: res.meta,
      };
    },
    enabled: options.enabled ?? true,
  });
};

// Keys are normalised to strings so route params and numeric ids invalidate the same entry
export const useCustomer = (id: number | string) => {
  return useQuery({
    queryKey: ['customer', String(id)],
    queryFn: async () => {
      const res = await customerApi.getCustomerById(id);
      return res.data;
    },
    enabled: !!id,
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCustomerPayload) => {
      return await customerApi.createCustomer(data);
    },
    onSuccess: () => {
      ['customers', 'dashboard-stats', 'finance-dashboard', 'referrals', 'activity-logs'].forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      );
    },
  });
};

export const useUpdateCustomerStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: number | string; status: UserStatus; reason?: string }) => {
      return await customerApi.updateStatus(id, { status, reason });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', String(variables.id)] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
};
