/**
 * useBootstrapPublicConfig — Warm the cache on App mount.
 *
 * Layer: Hook
 * Owner: core
 *
 * Phase 1 bootstrap pipeline (per docs/12 §Phase 1):
 *   1. GET /default-settings    — for default locale (mock or real)
 *   2. GET /system-settings/public — feature flags + limits
 *   3. GET /entitlements        — anonymous or authed
 *
 * Failures are surfaced to React Query but don't block the UI — placeholder
 * defaults keep the sidebar usable while offline.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/client';
import { useAuthStore } from '@/features/auth/store/auth.store';
import type {
  DefaultSettings,
  Entitlements,
  SystemSettings,
} from '@/types/system.types';

export function useBootstrapPublicConfig(): void {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ['system', 'defaults'],
      queryFn: async () => {
        const { data } = await request<DefaultSettings>({
          method: 'GET',
          endpoint: 'default-settings',
        });
        return data;
      },
    });
    void queryClient.prefetchQuery({
      queryKey: ['system', 'settings'],
      queryFn: async () => {
        const { data } = await request<SystemSettings>({
          method: 'GET',
          endpoint: 'system-settings/public',
        });
        return data;
      },
    });
    void queryClient.prefetchQuery({
      queryKey: ['entitlements', token ?? 'anonymous'],
      queryFn: async () => {
        const { data } = await request<Entitlements>({
          method: 'GET',
          endpoint: 'entitlements',
          token,
        });
        return data;
      },
    });
  }, [queryClient, token]);
}
