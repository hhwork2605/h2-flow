/**
 * PromptsPanelButton — header shortcut that jumps to the Prompts tab.
 *
 * Layer: UI
 * Owner: features/auth (header furniture)
 *
 * TobyFlow's original has this open a side panel; we route to the Prompts
 * tab instead so the Prompts surface is reachable until the panel UX lands
 * in Phase 6.
 */

import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/app.store';

export function PromptsPanelButton() {
  const { t } = useTranslation();
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  return (
    <button
      type="button"
      onClick={() => setActiveTab('prompts')}
      aria-label={t('header.openPrompts')}
      title={t('header.openPrompts')}
      className="grid h-8 w-8 place-items-center rounded-md text-text-2 hover:bg-bg-elevate hover:text-text-1"
    >
      <FileText className="h-4 w-4" />
    </button>
  );
}
