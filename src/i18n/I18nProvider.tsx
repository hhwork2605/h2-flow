/**
 * I18nProvider — async init wrapper so every page can await i18next ready.
 *
 * Layer: UI
 * Owner: i18n
 *
 * Mount once at the top of each page (sidebar, workflow-editor, …). Children
 * render only after `initI18n()` resolves so `useTranslation` never returns
 * raw keys during the cold render.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { initI18n } from './config';

interface Props {
  children: ReactNode;
  /** Optional UI to render while waiting for i18next.init (rarely visible). */
  fallback?: ReactNode;
}

export function I18nProvider({ children, fallback = null }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void initI18n().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <>{fallback}</>;
  return <>{children}</>;
}
