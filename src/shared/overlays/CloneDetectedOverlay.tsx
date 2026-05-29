/**
 * CloneDetectedOverlay — blocking overlay when extension fails anti-clone.
 *
 * Layer: UI
 * Owner: shared/overlays
 *
 * Spec: docs/05-ui-spec.md §9 "Clone-detected Overlay" (z-index 100, blocks
 * everything). Auto-hides when background's self-heal probe clears the flag.
 */

import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { useCloneDetected } from '@/core/cloneDetection';

const CHROME_WEB_STORE_URL = 'https://chrome.google.com/webstore';

export function CloneDetectedOverlay() {
  const { t } = useTranslation();
  const cloneDetected = useCloneDetected();

  if (!cloneDetected) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="clone-title"
      className="fixed inset-0 z-clone-overlay flex items-center justify-center bg-black/85 backdrop-blur-sm"
    >
      <div className="mx-4 flex max-w-sm flex-col items-center gap-4 rounded-lg bg-bg-overlay p-6 text-center shadow-xl">
        <ShieldAlert className="h-12 w-12 text-error" />
        <h2 id="clone-title" className="text-title text-text-1">
          {t('cloneDetected.title')}
        </h2>
        <p className="text-body text-text-2">{t('cloneDetected.description')}</p>
        <Button
          onClick={() => {
            chrome.tabs?.create({ url: CHROME_WEB_STORE_URL });
          }}
        >
          {t('cloneDetected.openStore')}
        </Button>
      </div>
    </div>
  );
}
