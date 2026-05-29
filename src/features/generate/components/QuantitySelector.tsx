/**
 * QuantitySelector — -/+ stepper for the number of outputs per prompt.
 *
 * Layer: UI
 * Owner: features/generate
 *
 * Provider config caps the maximum (Flow = 4, ChatGPT/Grok = 1). We hard-cap
 * at 12 client-side so users can't request unreasonable quantities even on
 * future providers.
 */

import { useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useGenerateStore } from '../store/generate.store';
import { useProviderApiConfigs } from '@/core/useProviderConfig';

const HARD_MIN = 1;
const HARD_MAX = 12;

export function QuantitySelector() {
  const quantity = useGenerateStore((s) => s.quantity);
  const setQuantity = useGenerateStore((s) => s.setQuantity);
  const provider = useGenerateStore((s) => s.provider);
  const { data: apiConfigs } = useProviderApiConfigs();
  const providerCfg = apiConfigs?.[provider] as { max_quantity?: number } | undefined;
  const providerMax = providerCfg?.max_quantity ?? HARD_MAX;
  const max = Math.min(providerMax, HARD_MAX);

  // Clamp when switching to a provider with a lower cap.
  useEffect(() => {
    if (quantity > max) setQuantity(max);
  }, [max, quantity, setQuantity]);

  const dec = () => setQuantity(Math.max(HARD_MIN, quantity - 1));
  const inc = () => setQuantity(Math.min(max, quantity + 1));

  return (
    <div className="inline-flex items-center rounded-md border border-border">
      <button
        type="button"
        onClick={dec}
        disabled={quantity <= HARD_MIN}
        className={cn(
          'grid h-7 w-7 place-items-center text-text-2 hover:bg-bg-elevate hover:text-text-1',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
        aria-label="Decrease"
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="number"
        min={HARD_MIN}
        max={max}
        value={quantity}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          setQuantity(Math.max(HARD_MIN, Math.min(max, next)));
        }}
        className="h-7 w-10 border-x border-border bg-transparent text-center text-body text-text-1 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={inc}
        disabled={quantity >= max}
        className={cn(
          'grid h-7 w-7 place-items-center text-text-2 hover:bg-bg-elevate hover:text-text-1',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
        aria-label="Increase"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
