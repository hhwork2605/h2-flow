/**
 * useModelRegistry — Server-driven AI model catalog.
 *
 * Layer: Hook
 * Owner: core
 *
 * Spec: docs/08-api-contract.md §14 (/provider-models). Behaviour ground
 * truth: reference-ext/src/core/ModelRegistry.js (Server-Only — throw when
 * cache empty, no client-side fallback). We soften that to "return []" so
 * the UI can show an empty dropdown instead of crashing during cold boot.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import type { MediaType, ProviderModel, ProviderSlug } from '@/types/provider.types';

const FOUR_HOURS = 4 * 60 * 60_000;

export function useAllModels() {
  return useQuery({
    queryKey: ['providerModels'],
    queryFn: async () => {
      const { data } = await request<ProviderModel[]>({
        method: 'GET',
        endpoint: 'provider-models',
        token: null,
      });
      return data;
    },
    staleTime: FOUR_HOURS,
    gcTime: 2 * FOUR_HOURS,
  });
}

export function useModels(provider: ProviderSlug, mediaType: MediaType): ProviderModel[] {
  const { data } = useAllModels();
  return useMemo(
    () => (data ?? []).filter((m) => m.provider === provider && m.media_type === mediaType),
    [data, provider, mediaType],
  );
}

export function useDefaultModel(provider: ProviderSlug, mediaType: MediaType): ProviderModel | null {
  const models = useModels(provider, mediaType);
  return useMemo(() => models.find((m) => m.is_default) ?? models[0] ?? null, [models]);
}
