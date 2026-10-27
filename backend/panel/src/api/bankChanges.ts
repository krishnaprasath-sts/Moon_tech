import { apiClient } from './client';
import { ApiResponse, BankChangeListMeta, BankChangeRequest, BankChangeRequestDetail, BankChangeStatus } from '../types';

export interface BankChangeListParams {
  status?: BankChangeStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export type BankChangeListResponse = Omit<ApiResponse<BankChangeRequest[]>, 'meta'> & { meta?: BankChangeListMeta };

const BASE = '/admin/bank-change-requests';

export const bankChangeApi = {
  getList: async (params: BankChangeListParams = {}) => {
    const res = await apiClient.get<BankChangeListResponse>(BASE, { params });
    return res.data;
  },
  getPendingCount: async () => {
    const res = await apiClient.get<ApiResponse<{ pendingCount: number }>>(`${BASE}/pending-count`);
    return res.data;
  },
  getById: async (id: number | string) => {
    const res = await apiClient.get<ApiResponse<BankChangeRequestDetail>>(`${BASE}/${id}`);
    return res.data;
  },
  approve: async (id: number | string, data: { remarks?: string } = {}) => {
    const res = await apiClient.post<ApiResponse<BankChangeRequest>>(`${BASE}/${id}/approve`, data);
    return res.data;
  },
  reject: async (id: number | string, data: { remarks: string }) => {
    const res = await apiClient.post<ApiResponse<BankChangeRequest>>(`${BASE}/${id}/reject`, data);
    return res.data;
  },
  // Relative API path - the proof is fetched as a blob with the bearer header, never linked directly
  getProofPath: (id: number | string) => `${BASE}/${id}/proof`,
};
