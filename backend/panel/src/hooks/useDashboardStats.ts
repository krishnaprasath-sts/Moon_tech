import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api';

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await dashboardApi.getStats();
      return res.data;
    },
    refetchInterval: 30000, // Background refresh every 30s
  });
};
