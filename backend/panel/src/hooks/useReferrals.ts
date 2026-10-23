import { useQuery } from '@tanstack/react-query';
import { referralApi } from '../api';

export const useReferralCommissions = (params: { page?: number; limit?: number; status?: string } = {}) => {
  return useQuery({
    queryKey: ['referral-commissions', params],
    queryFn: async () => {
      const res = await referralApi.getCommissions(params);
      return {
        commissions: res.data || [],
        meta: res.meta,
      };
    },
  });
};

export const useReferrals = (params: { page?: number; limit?: number; search?: string } = {}) => {
  return useQuery({
    queryKey: ['referrals', params],
    queryFn: async () => {
      const res = await referralApi.getReferrals(params);
      return {
        referrals: res.data || [],
        meta: res.meta,
      };
    },
  });
};
