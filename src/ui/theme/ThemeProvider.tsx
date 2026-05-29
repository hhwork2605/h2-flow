/**
 * ThemeProvider — light / dark / auto theme with chrome.storage persistence.
 *
 * Layer: UI
 * Owner: ui/theme
 *
 * Spec: docs/11-features-spec.md §19 + docs/05-ui-spec.md §0 (dark mode).
 * - 3 modes: 'light' | 'dark' | 'auto'
 * - Persisted to chrome.storage.local under key `af_theme`
 * - 'auto' follows window.matchMedia('(prefers-color-scheme: dark)')
 * - Toggles the `dark` class on <html> (Tailwind darkMode: 'class')
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getStorage, onStorageChange, setStorage } from '@/storage/chrome-storage';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'af_theme';
/**
 * Default = 'dark' theo Claude Design (2026-05-29). Hero violet `#9177e1` là
 * brand chính dark mode. Khi user đã toggle, storage giữ choice → không bị
 * override. Light mode (coral) vẫn dùng được qua nút toggle ở header.
 */
const DEFAULT_MODE: ThemeMode = 'dark';

export interface ThemeContextValue {
  theme: ThemeMode;
  effectiveTheme: EffectiveTheme;
  setTheme: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveEffective(mode: ThemeMode): EffectiveTheme {
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function applyEffective(theme: EffectiveTheme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE);
  const [effective, setEffective] = useState<EffectiveTheme>(() => resolveEffective(DEFAULT_MODE));

  // Initial load from storage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getStorage<ThemeMode>(STORAGE_KEY);
      if (cancelled) return;
      const next = stored ?? DEFAULT_MODE;
      setMode(next);
      const eff = resolveEffective(next);
      setEffective(eff);
      applyEffective(eff);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply whenever mode changes.
  useEffect(() => {
    const eff = resolveEffective(mode);
    setEffective(eff);
    applyEffective(eff);
  }, [mode]);

  // Track prefers-color-scheme while in 'auto' mode.
  useEffect(() => {
    if (mode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const eff: EffectiveTheme = mq.matches ? 'dark' : 'light';
      setEffective(eff);
      applyEffective(eff);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  // Cross-context sync: other extension contexts (popup, settings page) may
  // change the theme — pick it up so all UIs stay aligned.
  useEffect(() => {
    return onStorageChange<ThemeMode>(STORAGE_KEY, (newValue) => {
      if (newValue && newValue !== mode) setMode(newValue);
    });
  }, [mode]);

  const setTheme = useCallback((next: ThemeMode) => {
    setMode(next);
    void setStorage(STORAGE_KEY, next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: mode, effectiveTheme: effective, setTheme }),
    [mode, effective, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
