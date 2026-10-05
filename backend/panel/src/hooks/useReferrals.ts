import { useQuery } from '@tanstack/react-query';
import { referralApi } from '../api';

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
