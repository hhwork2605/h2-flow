/**
 * AdvancedRow — collapsible "Nâng cao" block dưới settings.
 *
 * Layer: UI
 * Owner: features/generate
 *
 * Theo Claude Design (Advanced section): filename template `/_____.png` font-mono
 * + Auto-download segmented toggle + Quality 1K/2K/4K segmented. Card riêng nền
 * `bg-secondary/30` để tách khỏi settings strip.
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { useFeatureGate } from '@/core/useFeatureGate';
import { useGenerateStore } from '../store/generate.store';

const RESOLUTIONS = ['1K', '2K', '4K'] as const;

export function AdvancedRow() {
  const { t } = useTranslation();
  const autoDownload = useGenerateStore((s) => s.autoDownload);
  const setAutoDownload = useGenerateStore((s) => s.setAutoDownload);
  const folder = useGenerateStore((s) => s.downloadFolder);
  const setFolder = useGenerateStore((s) => s.setDownloadFolder);
  const resolution = useGenerateStore((s) => s.downloadResolution);
  const setResolution = useGenerateStore((s) => s.setDownloadResolution);
  const featureGate = useFeatureGate();
  const can4k = featureGate.canUse('auto_download_4k');

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-secondary/30 p-3">
      {/* ─── Filename template ─── */}
      <label className="flex flex-wrap items-center gap-2 text-meta text-muted-foreground">
        <span className="min-w-[88px]">{t('generate.filenameLabel', 'Tên file')}</span>
        <div className="inline-flex flex-1 items-center gap-1 rounded border bg-background px-2 font-mono text-[12px]">
          <span className="text-muted-foreground">/</span>
          <input
            type="text"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder={t('generate.folderPlaceholder')}
            className={cn(
              'h-7 flex-1 border-0 bg-transparent text-foreground outline-none',
              'placeholder:text-muted-foreground/70 focus:ring-0',
            )}
          />
          <span className="text-muted-foreground">.png</span>
        </div>
      </label>

      {/* ─── Auto-download + Quality ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-[88px] text-meta text-muted-foreground">
          {t('generate.autoDownload')}
        </span>
        <SegmentedToggle
          value={autoDownload ? 'on' : 'off'}
          onChange={(v) => setAutoDownload(v === 'on')}
          options={[
            { value: 'off', label: t('common.off', 'Tắt') },
            { value: 'on', label: t('common.on', 'Bật') },
          ]}
        />

        <span className="ml-auto text-meta text-muted-foreground">
          {t('generate.resolutionLabel')}
        </span>
        <SegmentedToggle
          value={resolution}
          onChange={(v) => setResolution(v as '1K' | '2K' | '4K')}
          options={RESOLUTIONS.map((r) => ({
            value: r,
            label: r,
            disabled: r === '4K' && !can4k,
          }))}
        />
      </div>
    </div>
  );
}

interface SegmentedToggleProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
}
function SegmentedToggle({ value, onChange, options }: SegmentedToggleProps) {
  return (
    <div
      role="radiogroup"
      className="inline-flex items-center rounded-md border bg-background p-0.5"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !opt.disabled && onChange(opt.value)}
            disabled={opt.disabled}
            className={cn(
              'inline-flex h-7 items-center rounded px-3 text-meta font-medium transition-colors',
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              opt.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
