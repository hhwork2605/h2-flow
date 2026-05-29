/**
 * StatusDot — green/red/gray dot indicating SSE connection state.
 *
 * Layer: UI
 * Owner: features/auth
 *
 * Phase 2.7 ships placeholder logic: green when authenticated, gray when
 * anonymous, red when the OfflineOverlay flag would fire. Real SSE-state
 * binding lands in Phase 4.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { cn } from '@/utils/cn';

export function StatusDot() {
  const { isAuthenticated } = useAuth();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const tone = !online ? 'bg-error' : isAuthenticated ? 'bg-success' : 'bg-text-3';
  const title = !online ? 'Offline' : isAuthenticated ? 'Connected' : 'Anonymous';

  return (
    <span
      title={title}
      aria-label={title}
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full ring-2 ring-bg-base', tone)}
    />
  );
}
