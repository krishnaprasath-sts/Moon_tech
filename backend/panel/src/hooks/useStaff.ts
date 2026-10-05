import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '../api';

export const useStaffList = () => {
  return useQuery({
    queryKey: ['staff-list'],
    queryFn: async () => {
      const res = await staffApi.getStaff();
      return res.data || [];
    },
  });
};

export const useCreateStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; phone: string; password: string; role: string }) => {
      return await staffApi.createStaff(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
};

export const useUpdateStaffRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, role }: { id: number | string; role: string }) => {
      return await staffApi.updateRole(id, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
};

export const useUpdateStaffStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: number | string; status: string; reason?: string }) => {
      return await staffApi.updateStatus(id, { status, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
};

export const useDeleteStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number | string) => {
      return await staffApi.deleteStaff(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });
};
