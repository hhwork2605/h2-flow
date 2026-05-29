/**
 * useEntitlements — Plan + quotas + feature flags.
 *
 * Layer: Hook
 * Owner: core
 *
 * Spec: docs/08-api-contract.md §3. Cached 30s — SSE events
 * `plan_activated` / `quota_warning` / `quota_exhausted` will invalidate it
 * in Phase 4. Works for both anonymous (no token) and authenticated calls.
 *
 * Reference: reference-ext/src/core/FeatureGate.js.
 */

import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import { useAuthStore } from '@/features/auth/store/auth.store';
import type { Entitlements } from '@/types/system.types';

const THIRTY_SEC = 30_000;

export function useEntitlements() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['entitlements', token ?? 'anonymous'],
    queryFn: async () => {
      const { data } = await request<Entitlements>({
        method: 'GET',
        endpoint: 'entitlements',
        token,
      });
      return data;
    },
    staleTime: THIRTY_SEC,
  });
}

/**
 * Convenience selector — `useFeatureFlag('chatgpt')` → true if user can use ChatGPT.
 * Anonymous user (entitlements not loaded yet, network error, etc.) → returns
 * the optimistic default (true) so the UI doesn't block; the real guard is
 * the server-side ExecutionGate.
 */
export function useFeatureFlag(key: string, fallback = true): boolean {
  const { data } = useEntitlements();
  return data?.features?.[key]?.enabled ?? fallback;
}
