/**
 * ResultTilesGrid — "Gần đây" recent results + live run cards.
 *
 * Layer: UI
 * Owner: features/generate
 *
 * Theo Claude Design: header "Gần đây" + "Xem tất cả →". Khi không có runs:
 * render 4 placeholder cards gradient violet/coral để gợi ý không gian. Khi
 * có runs: render lưới run cards với progress tiles.
 */

import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  useGenerateStore,
  type PromptRun,
  type PromptStatus,
} from '../store/generate.store';

const STATUS_ICON: Record<PromptStatus, typeof Clock> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: AlertCircle,
  cancelled: XCircle,
};

const STATUS_COLOR: Record<PromptStatus, string> = {
  pending: 'text-status-pending',
  running: 'text-status-running',
  completed: 'text-status-completed',
  failed: 'text-status-failed',
  cancelled: 'text-muted-foreground',
};

/**
 * Placeholder gradient cho 4 card "Gần đây" khi runs trống. Dùng palette
 * `violet-*` + đuôi pink để khớp Claude Design dark mode (target screenshot).
 * Fixed hue — không đổi theo theme vì đây là decorative branding.
 */
const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(135deg, #553795 0%, #1a1530 100%)',
  'linear-gradient(135deg, #6843b8 0%, #2a1f44 100%)',
  'linear-gradient(135deg, #883873 0%, #3a1f3a 100%)',
  'linear-gradient(135deg, #a8366b 0%, #44203a 100%)',
];

export function ResultTilesGrid() {
  const { t } = useTranslation();
  const runs = useGenerateStore((s) => s.runs);
  const status = useGenerateStore((s) => s.status);

  // Placeholder mode — chưa có run nào, hiển thị 4 card gradient (Claude Design)
  if (runs.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <header className="flex items-center justify-between">
          <h3 className="font-display text-section italic text-foreground">
            Gần đây
          </h3>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-meta text-muted-foreground transition-colors hover:text-foreground"
          >
            Xem tất cả
            <ArrowRight className="h-3 w-3" />
          </button>
        </header>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {PLACEHOLDER_GRADIENTS.map((bg, i) => (
            <div
              key={i}
              className="group relative aspect-[16/10] overflow-hidden rounded-lg border"
              style={{ background: bg }}
            >
              <div className="absolute inset-x-2 bottom-2 font-mono text-[10px] text-white/80">
                h2flow-{String(i).padStart(2, '0')}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="font-display text-section italic text-foreground">
          {t('generate.resultsSection')}
        </h3>
        <span className="font-mono text-meta text-muted-foreground">
          {status === 'running'
            ? t('generate.running', {
                done: runs.filter((r) => r.status === 'completed').length,
                total: runs.length,
              })
            : status === 'completed'
              ? t('generate.allDone')
              : ''}
        </span>
      </header>
      <ul className="flex flex-col gap-3">
        {runs.map((run) => (
          <RunCard key={run.index} run={run} />
        ))}
      </ul>
    </section>
  );
}

function RunCard({ run }: { run: PromptRun }) {
  const Icon = STATUS_ICON[run.status];
  return (
    <li className="rounded-lg border bg-card p-2.5 shadow-card">
      <div className="flex items-start gap-2">
        <Icon
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            STATUS_COLOR[run.status],
            run.status === 'running' && 'animate-spin',
          )}
        />
        <p className="line-clamp-2 flex-1 text-body text-foreground">
          {run.text}
        </p>
      </div>
      {run.errorMessage && (
        <p className="mt-1 text-meta text-destructive">{run.errorMessage}</p>
      )}
      {run.tiles.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {run.tiles.map((tile) => (
            <a
              key={tile.fileId}
              href={tile.thumbnailUrl}
              target="_blank"
              rel="noreferrer"
              className="block aspect-square overflow-hidden rounded border bg-background"
            >
              <img
                src={tile.thumbnailUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}
    </li>
  );
}
