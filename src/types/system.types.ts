/**
 * system.types.ts — Public system / default settings + entitlements.
 *
 * Layer: Types
 * Owner: shared
 *
 * Spec: docs/08-api-contract.md §1 (/system-settings/public, /default-settings)
 * + §3 (/entitlements). Shapes mirror mock data in
 * src/background/mock/data.ts so swapping mock → real is a no-op.
 */

import type { Locale, PlanKey } from './user.types';

export interface SystemSettings {
  version: number;
  feature_flags: Record<string, boolean>;
  limits: {
    max_workflow_nodes: number;
    max_ref_images: number;
    max_prompt_length: number;
  };
  timeouts: {
    submit_ms: number;
    tile_watch_ms: number;
  };
}

export interface DefaultSettings {
  default_locale: Locale;
  supported_locales: readonly Locale[];
}

export interface FeatureFlag {
  enabled: boolean;
  reason?: 'plan' | 'admin_override' | 'feature_disabled';
}

export interface QuotaInfo {
  action: string;
  limit: number;
  used: number;
  remaining: number;
  resets_at: string;
  global?: {
    limit: number;
    used: number;
    remaining: number;
  };
}

export interface Entitlements {
  user_id: string;
  plan: PlanKey;
  plan_expires_at: string | null;
  features: Record<string, FeatureFlag>;
  quotas: Record<string, QuotaInfo>;
}
