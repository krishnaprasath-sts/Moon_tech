import { QueryClient } from '@tanstack/react-query';

const getStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | undefined)?.response?.status;

// Shared across the app so the auth layer can clear every cached query on logout / session expiry
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 10 * 1000,
      retry: (failureCount, error) => {
        const status = getStatus(error);
        // Auth, permission and not-found errors never succeed on retry
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 1;
      },
    },
  },
});
