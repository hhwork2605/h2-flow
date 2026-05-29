/**
 * NotificationBell — header bell with unread badge.
 *
 * Layer: UI
 * Owner: features/notifications
 *
 * Phase 2.7 ships placeholder UI only — real notifications fetch
 * `/notifications` + SSE push lands in Phase 4. Dropdown shows the empty
 * state for now so the affordance is in place.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell, BellOff } from 'lucide-react';
import { cn } from '@/utils/cn';

export function NotificationBell() {
  const { t } = useTranslation();
  // Phase 4 hook will replace this constant with real unread count.
  const [unread] = useState(0);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t('notifications.label')}
          title={t('notifications.label')}
          className="relative grid h-8 w-8 place-items-center rounded-md text-text-2 hover:bg-bg-elevate hover:text-text-1"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid h-3 min-w-[12px] place-items-center rounded-full bg-error px-1 text-[9px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-dropdown w-72 rounded-md border border-border bg-bg-overlay p-3 shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:fade-out-0',
          )}
        >
          <header className="mb-2 flex items-center justify-between">
            <h3 className="text-section text-text-1">{t('notifications.label')}</h3>
          </header>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <BellOff className="h-8 w-8 text-text-3" />
            <p className="text-body text-text-2">{t('notifications.empty')}</p>
            <p className="text-caption text-text-3">{t('notifications.phaseHint')}</p>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
