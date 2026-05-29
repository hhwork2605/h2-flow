/**
 * ThemeToggle — Phase 0 minimal theme switcher (light / dark / auto).
 *
 * Layer: UI
 * Owner: ui/theme
 *
 * Replaced in Phase 1 by the full settings dropdown — kept here so dark mode
 * is testable in the Phase 0 scaffold.
 */

import { Moon, Sun, SunMoon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useTheme } from './useTheme';
import type { ThemeMode } from './ThemeProvider';

const ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  auto: SunMoon,
};

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'auto',
  auto: 'light',
};

const LABELS: Record<ThemeMode, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  auto: 'Auto theme',
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = ICONS[theme];
  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT_MODE[theme])}
      aria-label={`Switch theme (current: ${LABELS[theme]})`}
      title={LABELS[theme]}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-md text-text-2',
        'hover:bg-bg-elevate hover:text-text-1',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
