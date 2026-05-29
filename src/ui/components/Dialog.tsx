/**
 * Dialog — accessible modal wrapper around Radix Dialog.
 *
 * Layer: UI
 * Owner: ui/components
 *
 * Spec: docs/05-ui-spec.md §9 Modal patterns (rounded-lg, shadow-xl,
 * 200ms fade+scale, click outside closes).
 */

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Set false to hide the X close button (e.g. for blocking dialogs). */
  showClose?: boolean;
  /** Set false to disable click-outside-to-close. */
  dismissable?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  showClose = true,
  dismissable = true,
  children,
  footer,
  className,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={cn(
            'fixed inset-0 z-modal bg-black/50',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        />
        <RadixDialog.Content
          onPointerDownOutside={(e) => {
            if (!dismissable) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (!dismissable) e.preventDefault();
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-modal w-[calc(100vw-2rem)] max-w-md',
            '-translate-x-1/2 -translate-y-1/2',
            'rounded-lg border border-border bg-bg-overlay text-text-1 shadow-xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
            'duration-200',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <RadixDialog.Title className="text-section text-text-1">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-caption text-text-2">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            {showClose && (
              <RadixDialog.Close
                aria-label="Close"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-2 hover:bg-bg-elevate hover:text-text-1"
              >
                <X className="h-4 w-4" />
              </RadixDialog.Close>
            )}
          </div>
          <div className="px-4 py-4">{children}</div>
          {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
