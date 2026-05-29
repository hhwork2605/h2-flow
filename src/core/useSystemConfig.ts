/**
 * useSystemConfig — Public system settings + default settings.
 *
 * Layer: Hook
 * Owner: core
 *
 * Spec: docs/08-api-contract.md §1. Cached 1 hour (rarely changes). SSE
 * `config_updated` event in Phase 4 will invalidate this query.
 *
 * Reference: reference-ext/src/core/SystemConfig.js.
 */

import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import type { DefaultSettings, SystemSettings } from '@/types/system.types';

const ONE_HOUR = 60 * 60_000;

export function useSystemConfig() {
  return useQuery({
    queryKey: ['system', 'settings'],
    queryFn: async () => {
      const { data } = await request<SystemSettings>({
        method: 'GET',
        endpoint: 'system-settings/public',
      });
      return data;
    },
    staleTime: ONE_HOUR,
    gcTime: 2 * ONE_HOUR,
  });
}

export function useDefaultSettings() {
  return useQuery({
    queryKey: ['system', 'defaults'],
    queryFn: async () => {
      const { data } = await request<DefaultSettings>({
        method: 'GET',
        endpoint: 'default-settings',
      });
      return data;
    },
    staleTime: ONE_HOUR,
    gcTime: 2 * ONE_HOUR,
  });
}
