/**
 * StyleSelector — "Phong cách" row riêng với quota chip bên phải.
 *
 * Layer: UI
 * Owner: features/generate
 *
 * Theo Claude Design: row độc lập dưới settings strip. Left = "Phong cách" +
 * Select Cinematic; Right = quota chip "còn N lượt" lấy từ FeatureGate.
 */

import { useTranslation } from 'react-i18next';
import { Palette } from 'lucide-react';
import { Select, type SelectOption } from '@/ui/components/Select';
import { useFeatureGate } from '@/core/useFeatureGate';
import { useGenerateStore } from '../store/generate.store';

const PRESETS: { key: string; label: string }[] = [
  { key: 'none', label: 'Tắt' },
  { key: 'natural', label: 'Tự nhiên' },
  { key: 'cinematic', label: 'Cinematic' },
  { key: 'anime', label: 'Anime' },
  { key: 'realistic', label: 'Realistic' },
  { key: 'stylized', label: 'Stylized' },
];

export function StyleSelector() {
  const { t } = useTranslation();
  const stylePreset = useGenerateStore((s) => s.stylePreset);
  const setStylePreset = useGenerateStore((s) => s.setStylePreset);
  const featureGate = useFeatureGate();
  const remaining = featureGate.quotaRemaining('generate');

  const options: SelectOption[] = PRESETS.map((p) => ({
    value: p.key,
    label: p.label,
  }));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
          <Palette className="h-3.5 w-3.5" />
          {t('generate.styleLabel')}
        </span>
        <Select
          ariaLabel={t('generate.styleLabel')}
          value={stylePreset ?? 'none'}
          onValueChange={(v) => setStylePreset(v === 'none' ? null : v)}
          options={options}
          size="sm"
          className="min-w-[140px]"
        />
      </div>

      {remaining != null && (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          còn {remaining} lượt
        </span>
      )}
    </div>
  );
}
