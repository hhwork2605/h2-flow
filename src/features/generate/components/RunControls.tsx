/**
 * RunControls — Stop button when running.
 *
 * Layer: UI
 * Owner: features/generate
 *
 * Theo Claude Design (2026-05-29) nút **Tạo** đã chuyển vào `PromptCard` và
 * `runMode` đã chuyển vào settings strip (`ModeToggle`). Component này còn
 * lại để render nút **Stop** sticky bottom khi đang chạy, + quota hint
 * inline. Khi idle: render null để khỏi chiếm khoảng trắng.
 */

import { useTranslation } from 'react-i18next';
import { Square } from 'lucide-react';
import { useGenerateStore } from '../store/generate.store';
import { useFeatureGate } from '@/core/useFeatureGate';

interface Props {
  onStart?: () => void;
  onStop: () => void;
}

export function RunControls({ onStop }: Props) {
  const { t } = useTranslation();
  const status = useGenerateStore((s) => s.status);
  const featureGate = useFeatureGate();
  const remaining = featureGate.quotaRemaining('generate');
  const running = status === 'running';

  if (!running) return null;

  return (
    <div className="sticky bottom-0 z-sticky flex flex-col gap-2 border-t bg-background px-3 py-3">
      {remaining != null && (
        <div className="text-meta text-muted-foreground">
          {t('generate.quotaRemaining', { remaining, action: 'generate' })}
        </div>
      )}
      <button
        type="button"
        onClick={onStop}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-destructive text-destructive-foreground text-[14px] font-semibold hover:opacity-95"
      >
        <Square className="h-4 w-4" />
        {t('generate.stop')}
      </button>
    </div>
  );
}
