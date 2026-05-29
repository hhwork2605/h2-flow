/**
 * ProviderTabLock — Track which Chrome tab is "owned" by each provider.
 *
 * Layer: Infra
 * Owner: providers
 *
 * Multiple sidebar instances must agree on a single Flow tab (and only one
 * generation runs through it at a time) so we don't double-submit prompts.
 *
 * Reference: reference-ext/src/core/ProviderTabLock.js.
 */

import type { ProviderSlug } from '@/types/provider.types';

const tabIds = new Map<ProviderSlug, number>();

export const ProviderTabLock = {
  set(provider: ProviderSlug, tabId: number): void {
    tabIds.set(provider, tabId);
  },
  get(provider: ProviderSlug): number | undefined {
    return tabIds.get(provider);
  },
  clear(provider: ProviderSlug): void {
    tabIds.delete(provider);
  },
  clearAll(): void {
    tabIds.clear();
  },
};
