/**
 * GenTab — top-level Generate sidebar tab.
 *
 * Layer: UI
 * Owner: features/generate
 *
 * Layout theo Claude Design (xem `docs/05-ui-spec.md §2`, `docs/features/00-design-system.md`):
 *   Hero "Hãy tạo một thứ gì đó đẹp"
 *   ↓
 *   Kind toggle + Provider segmented (cùng hàng, wrap khi hẹp)
 *   ↓
 *   PromptCard (header + textarea + chips + Nâng cao + Tạo) ← merged
 *   ↓
 *   Settings strip: Model · Tỉ lệ · Số lượng · Mode
 *   ↓
 *   Style row riêng: Phong cách · quota chip
 *   ↓
 *   RefImagePicker (luôn hiện)
 *   ↓
 *   AdvancedRow (collapsible "Nâng cao": filename + auto-DL + quality)
 *   ↓
 *   ResultTilesGrid ("Gần đây")
 *
 * RunControls chỉ render Stop button khi `status === 'running'`.
 */

import { useState } from 'react';
import { useGeneration } from '../hooks/useGeneration';
import { AdvancedRow } from './AdvancedRow';
import { MediaTypeToggle } from './MediaTypeToggle';
import { ModeToggle } from './ModeToggle';
import { ModelSelector } from './ModelSelector';
import { ProviderSelector } from './ProviderSelector';
import { PromptCard } from './PromptCard';
import { QuantitySelector } from './QuantitySelector';
import { RatioSelector } from './RatioSelector';
import { RefImagePicker } from './RefImagePicker';
import { ResultTilesGrid } from './ResultTilesGrid';
import { RunControls } from './RunControls';
import { StyleSelector } from './StyleSelector';

export function GenTab() {
  const { start, stop } = useGeneration();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-1 justify-center overflow-y-auto">
        <div className="flex w-full max-w-[860px] flex-col gap-5.5 px-3 py-4 sm:px-4 md:px-7 md:py-8">
          {/* ─── Hero ─── */}
          <header className="text-center">
            <p className="text-eyebrow uppercase text-muted-foreground">
              Studio · Generate
            </p>
            <h1 className="mt-2 font-display text-[26px] italic leading-[1.05] tracking-[-0.02em] text-foreground sm:text-[34px] md:text-hero">
              Hãy tạo một thứ gì đó{' '}
              <span className="font-sans not-italic text-[68%] font-semibold text-primary">
                đẹp
              </span>
              .
            </h1>
          </header>

          {/* ─── Kind + Provider ─── */}
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <MediaTypeToggle />
            <span className="hidden h-4 w-px bg-border md:inline-block" />
            <ProviderSelector />
          </div>

          {/* ─── Prompt card (header + textarea + chips + Tạo) ─── */}
          <PromptCard
            onStart={start}
            advancedOpen={advancedOpen}
            onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
          />

          {/* ─── Settings strip ─── */}
          <section className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px] flex-1">
              <ModelSelector />
            </div>
            <RatioSelector />
            <QuantitySelector />
            <ModeToggle />
          </section>

          {/* ─── Style row + quota chip ─── */}
          <StyleSelector />

          {/* ─── Reference images (always visible) ─── */}
          <RefImagePicker />

          {/* ─── Advanced collapsible (filename + auto-DL + quality) ─── */}
          {advancedOpen && <AdvancedRow />}

          {/* ─── Recent / results ─── */}
          <ResultTilesGrid />
        </div>
      </div>

      {/* Stop control khi running (Tạo lives trong PromptCard) */}
      <RunControls onStop={stop} />
    </div>
  );
}
