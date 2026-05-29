/**
 * ConfirmDialog — promise-based confirm modal thay thế `window.confirm()`.
 *
 * Layer: UI
 * Owner: ui/components
 *
 * API:
 *   import { showConfirm, ConfirmDialogViewport } from '@/ui/components/ConfirmDialog';
 *
 *   const ok = await showConfirm({
 *     title: 'Xoá workflow?',
 *     message: 'Hành động này không thể hoàn tác.',
 *     confirmLabel: 'Xoá',
 *     variant: 'destructive',
 *   });
 *   if (ok) deleteWorkflow(id);
 *
 *   // Mount once trong root (sidebar App, WorkflowEditor, …):
 *   <ConfirmDialogViewport />
 *
 * Dùng cùng global event-bus pattern với Toast — `showConfirm()` gọi được từ
 * bất kỳ đâu (store action, async function, không-React module).
 */

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { nanoid } from '@/utils/nanoid';

export type ConfirmVariant = 'default' | 'destructive';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface PendingConfirm extends ConfirmOptions {
  id: string;
  resolve: (ok: boolean) => void;
}

const EVENT = 'h2flow:confirm';

interface ConfirmEventDetail {
  type: 'show' | 'resolve';
  payload?: PendingConfirm;
  id?: string;
  result?: boolean;
}

/**
 * Show confirm dialog. Returns Promise<boolean> — resolves `true` nếu user
 * click confirm, `false` nếu cancel / đóng / Escape.
 *
 * Nếu `<ConfirmDialogViewport />` chưa mount (vd context không có UI),
 * fallback `window.confirm()` để KHÔNG bị hang Promise mãi.
 */
export function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  // Detect viewport mounted: dispatch event + nếu KHÔNG có listener nào nhận
  // → fallback native. Đo qua flag set bởi viewport useEffect.
  if (typeof window === 'undefined' || !_viewportMounted) {
    return Promise.resolve(window.confirm(`${opts.title}\n${opts.message ?? ''}`));
  }
  return new Promise((resolve) => {
    const payload: PendingConfirm = {
      id: nanoid('cf'),
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel,
      cancelLabel: opts.cancelLabel,
      variant: opts.variant,
      resolve,
    };
    window.dispatchEvent(
      new CustomEvent<ConfirmEventDetail>(EVENT, {
        detail: { type: 'show', payload },
      }),
    );
  });
}

let _viewportMounted = false;

export function ConfirmDialogViewport() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    _viewportMounted = true;
    function onEvent(evt: Event) {
      const ce = evt as CustomEvent<ConfirmEventDetail>;
      if (ce.detail.type === 'show' && ce.detail.payload) {
        setPending(ce.detail.payload);
      }
    }
    window.addEventListener(EVENT, onEvent);
    return () => {
      _viewportMounted = false;
      window.removeEventListener(EVENT, onEvent);
    };
  }, []);

  if (!pending) return null;

  const variant: ConfirmVariant = pending.variant ?? 'default';
  const confirmLabel = pending.confirmLabel ?? 'Đồng ý';
  const cancelLabel = pending.cancelLabel ?? 'Huỷ';

  function done(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  return (
    <Dialog.Root
      open={true}
      onOpenChange={(open) => {
        if (!open) done(false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-[9100] bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-[fadeIn_0.16s_ease-out]',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[9101] -translate-x-1/2 -translate-y-1/2',
            'w-[400px] max-w-[92vw] rounded-xl border border-white/10 bg-[#15151c]',
            'shadow-card-dark',
            'data-[state=open]:animate-[scaleIn_0.16s_ease-out]',
          )}
        >
          <header className="flex items-start gap-3 border-b border-white/5 px-4 py-3.5">
            {variant === 'destructive' && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-[14px] font-semibold text-foreground">
                {pending.title}
              </Dialog.Title>
              {pending.message && (
                <Dialog.Description className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
                  {pending.message}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Đóng"
                className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Dialog.Close>
          </header>

          <footer className="flex items-center justify-end gap-2 bg-black/20 px-4 py-2.5">
            <button
              type="button"
              onClick={() => done(false)}
              className={cn(
                'inline-flex h-8 items-center rounded px-3 text-[12.5px] font-medium',
                'bg-white/5 text-foreground hover:bg-white/10',
              )}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => done(true)}
              autoFocus
              className={cn(
                'inline-flex h-8 items-center rounded px-3 text-[12.5px] font-semibold',
                variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:opacity-90'
                  : 'bg-primary text-primary-foreground hover:opacity-90',
              )}
            >
              {confirmLabel}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
