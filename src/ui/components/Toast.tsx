/**
 * Toast — lightweight notification stack.
 *
 * Layer: UI
 * Owner: ui/components
 *
 * API:
 *   import { showToast, ToastViewport } from '@/ui/components/Toast';
 *   showToast({ title: 'Done', message: '...', variant: 'success' });
 *   // Mount <ToastViewport /> once (sidebar root hoặc workflow editor root).
 *
 * KHÔNG dùng Radix Toast — overkill cho 1 use case Phase 3. Khi cần ARIA live
 * region + queueing tốt hơn, swap sang `@radix-ui/react-toast` (đã có trong
 * package nhờ shadcn family).
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { nanoid } from '@/utils/nanoid';

export type ToastVariant = 'success' | 'error' | 'warn' | 'info';

export interface ToastOptions {
  title: string;
  message?: string;
  variant?: ToastVariant;
  /** Override default duration. 0 = sticky (manual dismiss). */
  durationMs?: number;
}

interface Toast extends ToastOptions {
  id: string;
  createdAt: number;
}

const DEFAULT_DURATION = 3500;
const EVENT = 'h2flow:toast';

interface ToastEventDetail {
  type: 'add' | 'remove';
  toast?: Toast;
  id?: string;
}

export function showToast(opts: ToastOptions): string {
  const toast: Toast = {
    id: nanoid('t'),
    createdAt: Date.now(),
    variant: 'info',
    ...opts,
  };
  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>(EVENT, {
      detail: { type: 'add', toast },
    }),
  );
  return toast.id;
}

export function dismissToast(id: string): void {
  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>(EVENT, {
      detail: { type: 'remove', id },
    }),
  );
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function onEvent(evt: Event) {
      const ce = evt as CustomEvent<ToastEventDetail>;
      const detail = ce.detail;
      if (detail.type === 'add' && detail.toast) {
        const t = detail.toast;
        setToasts((prev) => [...prev, t]);
        const dur = t.durationMs ?? DEFAULT_DURATION;
        if (dur > 0) {
          setTimeout(() => {
            setToasts((prev) => prev.filter((x) => x.id !== t.id));
          }, dur);
        }
      } else if (detail.type === 'remove' && detail.id) {
        setToasts((prev) => prev.filter((x) => x.id !== detail.id));
      }
    }
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[10000] flex w-[320px] flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          toast={t}
          onDismiss={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
        />
      ))}
    </div>
  );
}

interface ToastCardProps {
  toast: Toast;
  onDismiss: () => void;
}
function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const variant: ToastVariant = toast.variant ?? 'info';
  const { Icon, accent } = VARIANT_STYLES[variant];
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-[#15151c] px-3 py-2.5 shadow-card-dark',
        'animate-[slideIn_0.18s_ease-out]',
      )}
      style={{ borderColor: accent + '60' }}
      role="status"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
      <div className="min-w-0 flex-1">
        <p className="text-meta font-medium text-foreground">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{toast.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Đóng"
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

const VARIANT_STYLES: Record<ToastVariant, { Icon: typeof Info; accent: string }> = {
  success: { Icon: CheckCircle2, accent: '#22c55e' },
  error: { Icon: XCircle, accent: '#ef4444' },
  warn: { Icon: AlertTriangle, accent: '#f59e0b' },
  info: { Icon: Info, accent: '#9177e1' },
};
