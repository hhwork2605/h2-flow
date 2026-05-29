/**
 * api/queryClient.ts — Shared TanStack Query client.
 *
 * Layer: Infra
 * Owner: api
 *
 * One instance per render context (sidebar, workflow editor, settings). SSE
 * event handlers will call `queryClient.invalidateQueries` to refresh affected
 * data — see docs/02-architecture.md "Realtime → cache invalidation".
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry 4xx (except 408/429); back off network errors twice.
        const status = (error as { status?: number } | undefined)?.status;
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});
