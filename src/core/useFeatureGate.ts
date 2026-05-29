/**
 * useFeatureGate — Plan-aware feature + quota checks.
 *
 * Layer: Hook
 * Owner: core
 *
 * Spec: docs/08 §3. Reference: reference-ext/src/core/FeatureGate.js
 * (convention `{module}_enabled` / `{module}_run_max`).
 *
 * Real quota enforcement lives server-side in ExecutionGate.request.
 * This hook just renders pre-flight UI hints (disabled buttons, upgrade
 * banners) so the user knows before clicking.
 */

import { useMemo } from 'react';
import { useEntitlements } from './useEntitlements';

export interface FeatureGateApi {
  ready: boolean;
  canUse: (feature: string) => boolean;
  quotaRemaining: (action: string) => number | null;
  quotaLimit: (action: string) => number | null;
  reasonFor: (feature: string) => string | undefined;
  isPaid: boolean;
}

export function useFeatureGate(): FeatureGateApi {
  const { data, isSuccess } = useEntitlements();

  return useMemo<FeatureGateApi>(
    () => ({
      ready: isSuccess,
      canUse: (feature) => data?.features?.[feature]?.enabled ?? true,
      quotaRemaining: (action) => data?.quotas?.[action]?.remaining ?? null,
      quotaLimit: (action) => data?.quotas?.[action]?.limit ?? null,
      reasonFor: (feature) => data?.features?.[feature]?.reason,
      isPaid: data ? data.plan !== 'free' : false,
    }),
    [data, isSuccess],
  );
}
