/**
 * ModeToggle — Tuần tự / Song song segmented control.
 *
 * Inline trong settings strip (Claude Design). Tách khỏi RunControls để
 * khớp layout mới — chế độ là 1 cài đặt, không phải action.
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { useGenerateStore } from '../store/generate.store';

export function ModeToggle() {
  const { t } = useTranslation();
  const runMode = useGenerateStore((s) => s.runMode);
  const setRunMode = useGenerateStore((s) => s.setRunMode);
  const running = useGenerateStore((s) => s.status === 'running');

  return (
    <div className="flex flex-col gap-1">
      <label className="text-label text-muted-foreground">
        {t('generate.runMode')}
      </label>
      <div
        role="radiogroup"
        className="inline-flex items-center rounded-md border bg-background p-0.5"
      >
        {(['sequential', 'parallel'] as const).map((mode) => {
          const active = runMode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setRunMode(mode)}
              disabled={running}
              className={cn(
                'inline-flex h-7 items-center rounded px-3 text-meta transition-colors',
                active
                  ? 'bg-foreground text-background font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                running && 'cursor-not-allowed opacity-50',
              )}
            >
              {t(`generate.mode.${mode}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
