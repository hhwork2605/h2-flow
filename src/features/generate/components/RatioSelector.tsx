/**
 * RatioSelector — aspect ratio picker with mini-rect icons.
 *
 * Layer: UI
 * Owner: features/generate
 *
 * Theo Claude Design: 5 buttons mỗi cái vẽ mini-rect bằng border, kích thước
 * scale theo tỉ lệ thật (16:9 ngang, 9:16 dọc, 1:1 vuông, 4:3 / 3:4 trung
 * gian). Active → border `primary`, fill `primary/15`.
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { useGenerateStore, RATIOS, type Ratio } from '../store/generate.store';

/** Tỉ lệ thật → kích thước icon (px) trong khung 24×24. */
const RECT_SIZE: Record<Ratio, { w: number; h: number }> = {
  '16:9': { w: 22, h: 12 },
  '1:1': { w: 16, h: 16 },
  '9:16': { w: 12, h: 22 },
  '4:3': { w: 20, h: 15 },
  '3:4': { w: 15, h: 20 },
};

export function RatioSelector() {
  const { t } = useTranslation();
  const ratio = useGenerateStore((s) => s.ratio);
  const setRatio = useGenerateStore((s) => s.setRatio);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-label text-muted-foreground">
        {t('generate.ratioLabel')}
      </label>
      <div className="inline-flex items-center gap-1" role="radiogroup">
        {RATIOS.map((r) => {
          const active = ratio === r;
          const { w, h } = RECT_SIZE[r as Ratio];
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={active}
              title={r}
              aria-label={`${t('generate.ratioLabel')} ${r}`}
              onClick={() => setRatio(r as Ratio)}
              className={cn(
                'group inline-flex h-9 w-10 flex-col items-center justify-center gap-0.5 rounded border transition-colors',
                active
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'block rounded-[2px] border-[1.5px] transition-colors',
                  active ? 'border-primary' : 'border-current',
                )}
                style={{ width: `${w}px`, height: `${h}px` }}
              />
              <span className="font-mono text-[9px] leading-none">{r}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
