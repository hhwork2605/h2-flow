/**
 * provider.types.ts — Provider metadata + model + DOM selector contracts.
 *
 * Layer: Types
 * Owner: shared
 *
 * Spec: docs/08-api-contract.md §14 (/providers, /provider-models,
 * /providers/api-configs, /providers/dom-selectors). Behaviour ground truth:
 * reference-ext/src/core/ModelRegistry.js + ProviderConfigManager.js.
 */

export type ProviderSlug = 'flow' | 'chatgpt' | 'grok' | 'gemini';
export type MediaType = 'image' | 'video';

export interface Provider {
  key: ProviderSlug;
  name: string;
  url: string;
  enabled: boolean;
  version: number;
}

export interface ProviderModel {
  id: number;
  provider: ProviderSlug;
  media_type: MediaType;
  /** Display name shown in the dropdown. */
  name: string;
  /** Value sent back to the backend / used in node config. */
  value: string;
  is_default: boolean;
  is_premium: boolean;
  required_feature_key?: string | null;
  min_extension_version?: string | null;
  sort_order: number;
  config?: Record<string, unknown> | null;
}

export interface ProviderApiConfig {
  /** Per-provider DOM/API hints (tRPC URL, submit endpoint, etc.). Shape is
   *  provider-specific — see docs/08 §14. */
  [key: string]: unknown;
}

export interface ProviderDomSelectors {
  /** CSS selectors per provider for content-script DOM bridging. */
  [providerKey: string]: Record<string, string>;
}
