/**
 * ProjectIndicator — 32px row showing the current Flow project.
 *
 * Layer: UI
 * Owner: features/projects
 *
 * Spec: docs/05-ui-spec.md §1. Click row → dropdown to switch project.
 * Click "+" → inline input to create.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, Plus, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useProjectStore } from './project.store';

export function ProjectIndicator() {
  const { t } = useTranslation();
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const hydrate = useProjectStore((s) => s.hydrate);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const current = projects.find((p) => p.id === currentProjectId) ?? projects[0];

  function handleCreate() {
    createProject(draft);
    setDraft('');
    setCreating(false);
  }

  return (
    <div className="sticky top-12 z-sticky flex h-8 shrink-0 items-stretch border-b border-border bg-bg-base">
      {creating ? (
        <form
          className="flex w-full items-center gap-1 px-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-500" />
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (!draft.trim()) setCreating(false);
              else handleCreate();
            }}
            placeholder={t('projects.namePlaceholder')}
            className="flex-1 bg-transparent text-body text-text-1 outline-none placeholder:text-text-3"
          />
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setDraft('');
            }}
            className="text-caption text-text-2 hover:text-text-1"
          >
            ✕
          </button>
        </form>
      ) : (
        <>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className={cn(
                  'flex flex-1 items-center gap-1.5 px-2 text-body text-text-1',
                  'hover:bg-bg-elevate',
                )}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                <span className="flex-1 truncate text-left">
                  {current?.name ?? t('projects.empty')}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-3" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={2}
                // `w-[var(--radix-dropdown-menu-trigger-width)]` — Radix expose
                // width của trigger qua CSS var. Dropdown bằng width input (kể
                // cả khi resize sidebar). Min 200px tránh quá hẹp khi trigger
                // tí xíu (vd: project name siêu ngắn).
                className={cn(
                  'z-dropdown w-[var(--radix-dropdown-menu-trigger-width)] min-w-[200px] rounded-md border border-border bg-bg-overlay p-1 shadow-lg',
                  'data-[state=open]:animate-in data-[state=closed]:fade-out-0',
                )}
              >
                <div className="px-2 py-1 text-tag uppercase tracking-wide text-text-3">
                  {t('projects.switchHeader')}
                </div>
                {projects.map((p) => {
                  const isCurrent = p.id === current?.id;
                  return (
                    <DropdownMenu.Item
                      key={p.id}
                      onSelect={() => setCurrentProject(p.id)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-body',
                        'outline-none focus:bg-bg-elevate',
                        isCurrent ? 'text-text-1 font-medium' : 'text-text-2',
                      )}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                      <span className="flex-1 truncate">{p.name}</span>
                      {isCurrent && <Check className="h-3.5 w-3.5 text-brand-500" />}
                      {!isCurrent && projects.length > 1 && (
                        <button
                          type="button"
                          aria-label={t('common.delete')}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(p.id);
                          }}
                          className="grid h-5 w-5 place-items-center rounded text-text-3 hover:bg-bg-base hover:text-error"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <button
            type="button"
            onClick={() => setCreating(true)}
            aria-label={t('projects.create')}
            title={t('projects.create')}
            className="grid w-8 place-items-center border-l border-border text-text-2 hover:bg-bg-elevate hover:text-text-1"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
