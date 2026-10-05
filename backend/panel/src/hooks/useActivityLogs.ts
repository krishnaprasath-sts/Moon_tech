import { useQuery } from '@tanstack/react-query';
import { activityLogApi } from '../api';

export const useActivityLogs = (params: { page?: number; limit?: number; search?: string; entity?: string } = {}) => {
  return useQuery({
    queryKey: ['activity-logs', params],
    queryFn: async () => {
      const res = await activityLogApi.getLogs(params);
      return {
        logs: res.data || [],
        meta: res.meta,
      };
    },
  });
};
