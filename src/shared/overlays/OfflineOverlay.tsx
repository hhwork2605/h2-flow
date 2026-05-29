/**
 * OfflineOverlay — full-screen blocking overlay when the network is down.
 *
 * Layer: UI
 * Owner: shared/overlays
 *
 * Spec: docs/05-ui-spec.md §9 "Offline Overlay". Detection rules:
 *   - `navigator.onLine === false` → immediately show
 *   - `online` / `offline` window events flip the state
 *   - Retry button re-checks `navigator.onLine`; the broader self-heal pings
 *     /health (added in Phase 1 follow-up) when we need a true server probe.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';
import { Button } from '@/ui/components/Button';

export function OfflineOverlay() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(() => navigator.onLine === false);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-title"
      className="fixed inset-0 z-toast-persistent flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="mx-4 flex max-w-sm flex-col items-center gap-4 rounded-lg bg-bg-overlay p-6 text-center shadow-xl">
        <WifiOff className="h-12 w-12 text-warning" />
        <h2 id="offline-title" className="text-title text-text-1">
          {t('offline.title')}
        </h2>
        <p className="text-body text-text-2">{t('offline.description')}</p>
        <Button
          onClick={() => {
            // navigator.onLine isn't always reliable — force re-check by
            // listening for the online event already registered above.
            setOffline(!navigator.onLine);
          }}
        >
          {t('offline.retry')}
        </Button>
      </div>
    </div>
  );
}
