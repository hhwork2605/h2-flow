/**
 * TabRouter — Sidebar shell + 8-tab navigation.
 *
 * Layer: UI
 * Owner: pages/sidebar
 *
 * Spec: docs/05-ui-spec.md §1 (Sidebar layout). Tab order matches TobyFlow
 * reference: Gen → Workflow → Prompts → Tasks → Photos → Snippets →
 * History → Logs. Each tab has icon + label (horizontal scroll if narrow).
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cloud,
  History as HistoryIcon,
  Image as ImageIcon,
  ListChecks,
  MessageSquare,
  Sparkles,
  Terminal,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore, SIDEBAR_TABS, type SidebarTab } from '@/store/app.store';
import { cn } from '@/utils/cn';
import { ThemeToggle } from '@/ui/theme/ThemeToggle';
import { LanguageSelector } from '@/i18n/LanguageSelector';
import { AuthHeaderControl } from '@/features/auth/components/AuthHeaderControl';
import { PlanBadge } from '@/features/auth/components/PlanBadge';
import { PromptsPanelButton } from '@/features/auth/components/PromptsPanelButton';
import { StatusDot } from '@/features/auth/components/StatusDot';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { ProjectIndicator } from '@/features/projects/ProjectIndicator';
import { SidebarFooter } from './SidebarFooter';
import { GenerateTab } from './tabs/GenerateTab';
import { MultiTaskTab } from './tabs/MultiTaskTab';
import { WorkflowTab } from './tabs/WorkflowTab';
import { PromptsTab } from './tabs/PromptsTab';
import { SnippetsTab } from './tabs/SnippetsTab';
import { PhotosTab } from './tabs/PhotosTab';
import { HistoryTab } from './tabs/HistoryTab';
import { LogsTab } from './tabs/LogsTab';

const TAB_I18N_KEY: Record<SidebarTab, string> = {
  generate: 'tabs.generate',
  workflow: 'tabs.workflow',
  prompts: 'tabs.prompts',
  'multi-task': 'tabs.multiTask',
  photos: 'tabs.photos',
  snippets: 'tabs.snippets',
  history: 'tabs.history',
  logs: 'tabs.logs',
};

const TAB_ICON: Record<SidebarTab, LucideIcon> = {
  generate: Sparkles,
  workflow: Workflow,
  prompts: MessageSquare,
  'multi-task': ListChecks,
  photos: ImageIcon,
  snippets: Cloud,
  history: HistoryIcon,
  logs: Terminal,
};

const TAB_COMPONENTS: Record<SidebarTab, () => JSX.Element> = {
  generate: GenerateTab,
  workflow: WorkflowTab,
  prompts: PromptsTab,
  'multi-task': MultiTaskTab,
  photos: PhotosTab,
  snippets: SnippetsTab,
  history: HistoryTab,
  logs: LogsTab,
};

export function TabRouter() {
  const { t } = useTranslation();
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const hydrate = useAppStore((s) => s.hydrateFromStorage);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const ActiveTab = TAB_COMPONENTS[activeTab];

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-base text-text-1">
      {/* Header — 48px. */}
      <header className="sticky top-0 z-sticky flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-3">
        <div className="flex items-center gap-2">
          {/* Claude design §logo: 30×30 rounded-md, bg primary */}
          <div className="grid h-[30px] w-[30px] place-items-center rounded-md bg-primary text-primary-foreground">
            <span className="text-[13px] font-extrabold leading-none tracking-[-0.03em]">
              h2
            </span>
          </div>
          <span className="font-display text-[22px] italic leading-none text-foreground">
            h2-flow
          </span>
          <PlanBadge />
        </div>
        <div className="flex items-center gap-0.5">
          <StatusDot />
          <PromptsPanelButton />
          <LanguageSelector />
          <ThemeToggle />
          <NotificationBell />
          <AuthHeaderControl />
        </div>
      </header>

      {/* Project Indicator — 32px row right below the header. */}
      <ProjectIndicator />

      {/* Tab bar — sticky, 40px, horizontal scroll. */}
      <nav
        role="tablist"
        aria-label="Sidebar tabs"
        className="sticky top-[80px] z-sticky flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-border bg-bg-base"
      >
        {SIDEBAR_TABS.map((tab) => {
          const isActive = tab === activeTab;
          const Icon = TAB_ICON[tab];
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab}`}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 px-3 text-body transition-colors',
                'hover:bg-bg-elevate',
                isActive
                  ? 'font-semibold text-text-1 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-500'
                  : 'text-text-2',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(TAB_I18N_KEY[tab])}
            </button>
          );
        })}
      </nav>

      {/* Tab content. */}
      <section
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={activeTab}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <ActiveTab />
      </section>

      {/* Always-on status footer. */}
      <SidebarFooter />
    </div>
  );
}
