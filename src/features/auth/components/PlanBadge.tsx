/**
 * PlanBadge — current plan pill next to the brand.
 *
 * Layer: UI
 * Owner: features/auth
 *
 * Click → upgrade modal (Phase 5). For now opens nothing.
 */

import { useEntitlements } from '@/core/useEntitlements';
import { cn } from '@/utils/cn';

const PLAN_STYLES: Record<string, string> = {
  free: 'bg-text-3/15 text-text-2',
  trial: 'bg-warning/15 text-warning',
  pro: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white',
  team: 'bg-brand-500 text-white',
};

const PLAN_LABEL: Record<string, string> = {
  free: 'FREE',
  trial: 'TRIAL',
  pro: 'PRO',
  team: 'TEAM',
};

export function PlanBadge() {
  const { data } = useEntitlements();
  const plan = data?.plan ?? 'free';
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-tag font-semibold uppercase tracking-wide',
        PLAN_STYLES[plan] ?? PLAN_STYLES.free,
      )}
    >
      {PLAN_LABEL[plan] ?? plan.toUpperCase()}
    </span>
  );
}
