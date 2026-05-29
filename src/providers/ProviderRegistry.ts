/**
 * ProviderRegistry — Single source of truth for adapter instances.
 *
 * Layer: Infra
 * Owner: providers
 *
 * Reference: reference-ext/src/core/providers/ProviderRegistry.js.
 */

import type { ProviderSlug } from '@/types/provider.types';
import { AIProviderAdapter } from './AIProviderAdapter';
import { FlowAdapter } from './FlowAdapter';

const adapters = new Map<ProviderSlug, AIProviderAdapter>();
adapters.set('flow', new FlowAdapter());
// chatgpt / grok / gemini adapters land in Phase 4.

export const ProviderRegistry = {
  get(provider: ProviderSlug): AIProviderAdapter | undefined {
    return adapters.get(provider);
  },
  has(provider: ProviderSlug): boolean {
    return adapters.has(provider);
  },
  available(): ProviderSlug[] {
    return [...adapters.keys()];
  },
};
