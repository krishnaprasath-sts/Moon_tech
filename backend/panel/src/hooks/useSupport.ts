import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportApi, SupportThreadsParams } from '../api';
import { SupportTopic } from '../types';

const SUPPORT_POLL_MS = 20_000;

export const useSupportThreads = (params: SupportThreadsParams = {}) => {
  return useQuery({
    queryKey: ['support-threads', params],
    queryFn: async () => {
      const res = await supportApi.getThreads(params);
      return {
        threads: res.data || [],
        meta: res.meta,
      };
    },
    refetchInterval: SUPPORT_POLL_MS,
  });
};

export const useSupportThread = (userId: number | null, topic?: SupportTopic | '') => {
  return useQuery({
    queryKey: ['support-thread', userId, topic || ''],
    queryFn: async () => {
      const res = await supportApi.getThread(userId as number, topic || undefined);
      return res.data;
    },
    enabled: userId !== null,
    refetchInterval: SUPPORT_POLL_MS,
  });
};

export const useSupportUnreadCount = () => {
  return useQuery({
    queryKey: ['support-unread'],
    queryFn: async () => {
      const res = await supportApi.getUnreadCount();
      return res.data;
    },
    refetchInterval: SUPPORT_POLL_MS,
  });
};

export const useReplyToSupport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, topic, message }: { userId: number; topic: SupportTopic; message: string }) => {
      return await supportApi.reply(userId, { topic, message });
    },
    onSuccess: () => {
      ['support-threads', 'support-thread', 'support-unread', 'activity-logs'].forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      );
    },
  });
};

// ---------------------------------------------------------------------------
// Visitors (not signed in)
// ---------------------------------------------------------------------------
export const useGuestThreads = (params: Omit<SupportThreadsParams, 'topic'> = {}, enabled = true) => {
  return useQuery({
    queryKey: ['support-guest-threads', params],
    queryFn: async () => {
      const res = await supportApi.getGuestThreads(params);
      return { threads: res.data || [], meta: res.meta };
    },
    enabled,
    refetchInterval: SUPPORT_POLL_MS,
  });
};

export const useGuestThread = (guestId: number | null) => {
  return useQuery({
    queryKey: ['support-guest-thread', guestId],
    queryFn: async () => (await supportApi.getGuestThread(guestId as number)).data,
    enabled: guestId !== null,
    refetchInterval: SUPPORT_POLL_MS,
  });
};

export const useReplyToGuest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ guestId, topic, message }: { guestId: number; topic: SupportTopic; message: string }) =>
      await supportApi.replyToGuest(guestId, { topic, message }),
    onSuccess: () => {
      ['support-guest-threads', 'support-guest-thread', 'support-unread', 'activity-logs'].forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      );
    },
  });
};
