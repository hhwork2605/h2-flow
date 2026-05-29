/**
 * useProviderConfig — Provider metadata, API configs, DOM selectors.
 *
 * Layer: Hook
 * Owner: core
 *
 * Spec: docs/08 §14 — three separate endpoints, but a single hook tree
 * keeps the cache invalidation easier (one SSE `config_updated` event
 * invalidates all three). 12 req/hour rate limit per docs.
 */

import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import type {
  Provider,
  ProviderApiConfig,
  ProviderDomSelectors,
} from '@/types/provider.types';

const FOUR_HOURS = 4 * 60 * 60_000;

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      const { data } = await request<{ providers: Provider[] } | Provider[]>({
        method: 'GET',
        endpoint: 'providers',
        token: null,
      });
      return Array.isArray(data) ? data : data.providers;
    },
    staleTime: FOUR_HOURS,
  });
}

export function useProviderApiConfigs() {
  return useQuery({
    queryKey: ['providers', 'apiConfigs'],
    queryFn: async () => {
      const { data } = await request<{ configs: Record<string, ProviderApiConfig> }>({
        method: 'GET',
        endpoint: 'providers/api-configs',
        token: null,
      });
      return data.configs;
    },
    staleTime: FOUR_HOURS,
  });
}

export function useProviderDomSelectors() {
  return useQuery({
    queryKey: ['providers', 'domSelectors'],
    queryFn: async () => {
      const { data } = await request<{ selectors: ProviderDomSelectors }>({
        method: 'GET',
        endpoint: 'providers/dom-selectors',
        token: null,
      });
      return data.selectors;
    },
    staleTime: FOUR_HOURS,
  });
}
