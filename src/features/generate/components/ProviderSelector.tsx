/**
 * ProviderSelector — segmented control với color dot + Crown cho premium.
 *
 * Layer: UI
 * Owner: features/generate
 *
 * Theo Claude Design: provider list inline, mỗi pill có dot màu hãng
 * (Flow xanh, ChatGPT lục, Grok đen/trắng, Gemini violet) + 👑 cho
 * ChatGPT/Grok (premium). Disabled (FeatureGate fail) → opacity giảm + Lock.
 */

import { Crown, Lock } from 'lucide-react';
import { useFeatureGate } from '@/core/useFeatureGate';
import { useProviders } from '@/core/useProviderConfig';
import { cn } from '@/utils/cn';
import { useGenerateStore } from '../store/generate.store';
import type { ProviderSlug } from '@/types/provider.types';

const FEATURE_KEY: Record<ProviderSlug, string> = {
  flow: 'flow_enabled',
  chatgpt: 'chatgpt_enabled',
  grok: 'grok_enabled',
  gemini: 'gemini_enabled',
};

const PROVIDER_DOT: Record<ProviderSlug, string> = {
  flow: '#4285f4',
  chatgpt: '#10a37f',
  grok: '#222',
  gemini: '#a259ff',
};

const PREMIUM: Record<ProviderSlug, boolean> = {
  flow: false,
  chatgpt: true,
  grok: true,
  gemini: false,
};

export function ProviderSelector() {
  const provider = useGenerateStore((s) => s.provider);
  const setProvider = useGenerateStore((s) => s.setProvider);
  const { data: providers } = useProviders();
  const featureGate = useFeatureGate();

  return (
    <div
      role="radiogroup"
      aria-label="Provider"
      className="inline-flex flex-wrap items-center gap-1 rounded-md border bg-background p-0.5"
    >
      {(providers ?? []).map((p) => {
        const isActive = provider === p.key;
        const isEnabled = p.enabled && featureGate.canUse(FEATURE_KEY[p.key]);
        const dotColor = PROVIDER_DOT[p.key] ?? '#71717a';
        const isPremium = PREMIUM[p.key] ?? false;

        return (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => isEnabled && setProvider(p.key)}
            disabled={!isEnabled}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-meta transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              isActive
                ? 'bg-foreground text-background font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {!isEnabled ? (
              <Lock className="h-3 w-3" />
            ) : (
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: dotColor }}
              />
            )}
            <span>{p.name}</span>
            {isPremium && <Crown className="h-3 w-3 text-warning" />}
          </button>
        );
      })}
    </div>
  );
}
