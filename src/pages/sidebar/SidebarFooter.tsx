/**
 * SidebarFooter — slim status bar pinned to the bottom across all tabs.
 *
 * Layer: UI
 * Owner: pages/sidebar
 *
 * Theo Claude Design (2026-05-29):
 *   ✓ Tự tải   ✓ Tự thử lại                 Hàng đợi 0/20 · Đã tạo 0 · Đã tải 0
 *
 * Checkbox xanh (success) khi bật, mono counters bên phải với icon Zap/Image/Download.
 * Nâng cấp button chỉ hiện khi user chưa paid.
 */

import { useTranslation } from 'react-i18next';
import { Check, Crown, Download, Image as ImageIcon, Zap } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useEntitlements } from '@/core/useEntitlements';
import { useFeatureGate } from '@/core/useFeatureGate';
import { useGenerateStore } from '@/features/generate/store/generate.store';

export function SidebarFooter() {
  const { t } = useTranslation();
  const { data: entitlements } = useEntitlements();
  const featureGate = useFeatureGate();

  const autoDownload = useGenerateStore((s) => s.autoDownload);
  const setAutoDownload = useGenerateStore((s) => s.setAutoDownload);
  const runs = useGenerateStore((s) => s.runs);

  const retryEnabled = featureGate.canUse('retry_on_fail');

  const generateQuota = entitlements?.quotas.generate;
  const queueLimit = generateQuota?.limit ?? 20;
  const queueUsed = runs.filter((r) => r.status === 'pending' || r.status === 'running').length;
  const created = runs.filter((r) => r.status === 'completed').length;
  const downloaded = runs.reduce(
    (acc, r) => acc + (r.tiles.length > 0 && r.status === 'completed' && autoDownload ? r.tiles.length : 0),
    0,
  );

  const isPaid = featureGate.isPaid;

  return (
    <footer
      className={cn(
        'z-sticky flex h-9 shrink-0 items-center justify-between gap-3 border-t bg-background px-3',
        'text-meta text-muted-foreground',
      )}
    >
      {/* ─── Left: checkboxes ─── */}
      <div className="inline-flex items-center gap-3">
        <CheckPill
          label={t('footer.autoDownload', 'Tự tải')}
          on={autoDownload}
          onToggle={() => setAutoDownload(!autoDownload)}
        />
        <CheckPill
          label={t('footer.autoRetry', 'Tự thử lại')}
          on={retryEnabled}
        />
      </div>

      {/* ─── Right: counters ─── */}
      <div className="inline-flex items-center gap-3 font-mono text-[11px]">
        {!isPaid && (
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-tag font-semibold text-white',
              'bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110',
            )}
            title={t('header.upgrade')}
          >
            <Crown className="h-3 w-3" />
            {t('header.upgrade')}
          </button>
        )}
        <Counter icon={Zap} label={t('footer.queue', 'Hàng đợi')}>
          <span className={cn(queueUsed === 0 && 'text-muted-foreground')}>
            {queueUsed}/{queueLimit}
          </span>
        </Counter>
        <span className="text-muted-foreground/40">·</span>
        <Counter icon={ImageIcon} label={t('footer.created', 'Đã tạo')}>
          <span>{created}</span>
        </Counter>
        <span className="text-muted-foreground/40">·</span>
        <Counter icon={Download} label={t('footer.downloaded', 'Đã tải')}>
          <span>{downloaded}</span>
        </Counter>
      </div>
    </footer>
  );
}

interface CheckPillProps {
  label: string;
  on: boolean;
  onToggle?: () => void;
}
function CheckPill({ label, on, onToggle }: CheckPillProps) {
  const Comp = onToggle ? 'button' : 'span';
  return (
    <Comp
      type={onToggle ? 'button' : undefined}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 transition-colors',
        on ? 'text-success' : 'text-muted-foreground',
        onToggle && 'cursor-pointer hover:opacity-80',
      )}
    >
      <span
        className={cn(
          'grid h-3.5 w-3.5 place-items-center rounded-sm border',
          on
            ? 'border-success bg-success text-success-foreground'
            : 'border-border bg-transparent',
        )}
      >
        {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
      <span>{label}</span>
    </Comp>
  );
}

interface CounterProps {
  icon: typeof Zap;
  label: string;
  children: React.ReactNode;
}
function Counter({ icon: Icon, label, children }: CounterProps) {
  return (
    <span
      className="inline-flex items-center gap-1"
      title={label}
    >
      <Icon className="h-3 w-3 opacity-70" />
      <span className="hidden sm:inline">{label}</span>
      {children}
    </span>
  );
}
