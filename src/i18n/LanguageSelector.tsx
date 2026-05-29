/**
 * LanguageSelector — flag-style dropdown for header.
 *
 * Layer: UI
 * Owner: i18n
 */

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { currentLocale, setLocale, SUPPORTED_LOCALES, type SupportedLocale } from './config';

const FLAG: Record<SupportedLocale, string> = {
  vi: '🇻🇳',
  en: '🇬🇧',
};

export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const current = (i18n.language as SupportedLocale) ?? currentLocale();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t('language.label')}
          title={t('language.label')}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-md text-text-2',
            'hover:bg-bg-elevate hover:text-text-1',
          )}
        >
          <Globe className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-dropdown min-w-[180px] rounded-md border border-border bg-bg-overlay p-1 shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        >
          {SUPPORTED_LOCALES.map((loc) => {
            const isActive = loc === current;
            return (
              <DropdownMenu.Item
                key={loc}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-body outline-none',
                  'hover:bg-bg-elevate focus:bg-bg-elevate',
                  isActive ? 'text-text-1 font-medium' : 'text-text-2',
                )}
                onSelect={() => {
                  void setLocale(loc);
                }}
              >
                <span aria-hidden className="text-base leading-none">
                  {FLAG[loc]}
                </span>
                <span className="flex-1">{t(`language.${loc}`)}</span>
                {isActive && <Check className="h-3.5 w-3.5 text-brand-500" />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
