import { QueryClient } from '@tanstack/react-query';

/**
 * FROZEN. Shared TanStack Query client. Generated hooks (src/hooks/use*.ts) use it
 * via the provider in App.tsx.
 *
 * refetchOnWindowFocus is off: the web preview runs in an iframe whose focus events
 * are noisy and would cause constant refetching.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
