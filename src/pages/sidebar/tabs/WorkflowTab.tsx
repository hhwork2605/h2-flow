/**
 * WorkflowTab — sidebar tab listing user's workflows.
 *
 * Layer: UI
 * Owner: pages/sidebar/tabs
 *
 * Phase 3 P3.6 + P3.10: list workflows từ localStorage persistence. "+ Workflow
 * mới" / click 1 card → mở `workflow-editor.html?wf=<id>` ở **tab mới** (qua
 * `chrome.windows.create({ type: 'popup' })` cho extension, fallback
 * `window.open` cho dev:web).
 *
 * Cross-tab sync: lắng nghe `storage` event để refresh list khi tab editor
 * lưu workflow.
 *
 * Spec: docs/features/04-workflow.md §E.
 */

import { useEffect, useState } from 'react';
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { nanoid } from '@/utils/nanoid';
import {
  deleteWorkflow,
  listWorkflows,
  saveWorkflow,
  subscribeToIndex,
  type WorkflowListEntry,
} from '@/features/workflow/persistence';
import { showConfirm } from '@/ui/components/ConfirmDialog';
import { showToast } from '@/ui/components/Toast';
import type { WorkflowDocument } from '@/types/workflow.types';

const SCHEMA_VERSION = 1;

export function WorkflowTab() {
  const [items, setItems] = useState<WorkflowListEntry[]>([]);
  const [search, setSearch] = useState('');

  // Initial load + cross-tab refresh.
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const next = await listWorkflows();
      if (!cancelled) setItems(next);
    }
    refresh();
    const unsub = subscribeToIndex(() => {
      refresh();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const filtered = items.filter((it) =>
    search.trim() ? it.name.toLowerCase().includes(search.trim().toLowerCase()) : true,
  );

  async function handleCreate() {
    // Tạo workflow rỗng trong storage trước, rồi mở tab.
    const doc: WorkflowDocument = {
      id: nanoid('wf'),
      name: 'Workflow chưa đặt tên',
      description: '',
      project_id: null,
      schema_version: SCHEMA_VERSION,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      created_at: Date.now(),
      updated_at: Date.now(),
      sync_state: 'unsaved',
    };
    await saveWorkflow(doc);
    setItems(await listWorkflows());
    openEditorTab(doc.id);
  }

  function handleOpen(id: string) {
    openEditorTab(id);
  }

  async function handleDelete(id: string) {
    const entry = items.find((it) => it.id === id);
    const ok = await showConfirm({
      title: 'Xoá workflow?',
      message: entry
        ? `"${entry.name}" sẽ bị xoá vĩnh viễn. Tab editor đang mở (nếu có) sẽ tự đóng.`
        : 'Hành động này không thể hoàn tác.',
      confirmLabel: 'Xoá',
      cancelLabel: 'Huỷ',
      variant: 'destructive',
    });
    if (!ok) return;
    await deleteWorkflow(id);
    setItems(await listWorkflows());
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-1 justify-center overflow-y-auto">
        <div className="flex w-full max-w-[860px] flex-col gap-4 px-3 py-4 sm:px-4 md:px-7 md:py-6">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-eyebrow uppercase tracking-[0.12em] text-muted-foreground">
                Studio · Workflows
              </p>
              <h1 className="mt-1 font-display text-section italic text-foreground">
                Workflow của bạn
              </h1>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded px-3',
                'bg-primary text-primary-foreground shadow-btn-glow',
                'text-meta font-semibold hover:opacity-95',
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Workflow mới
            </button>
          </header>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm workflow…"
              className="h-8 flex-1 rounded border bg-background px-2.5 text-meta text-foreground placeholder:text-muted-foreground/70"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState onCreate={handleCreate} />
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((it) => (
                <WorkflowCard
                  key={it.id}
                  item={it}
                  onOpen={() => handleOpen(it.id)}
                  onDelete={() => handleDelete(it.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed bg-card/50 px-6 py-12 text-center">
      <WorkflowIcon className="h-10 w-10 text-muted-foreground/40" />
      <p className="mt-3 font-display text-section italic text-foreground">
        Chưa có workflow nào
      </p>
      <p className="mt-1 max-w-[320px] text-meta text-muted-foreground">
        Tạo workflow đầu tiên: kéo node Generate / Download / Telegram vào canvas,
        nối chúng lại, click Chạy để batch generate hàng loạt.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className={cn(
          'mt-4 inline-flex h-9 items-center gap-2 rounded px-4',
          'bg-primary text-primary-foreground shadow-btn-glow',
          'text-meta font-semibold hover:opacity-95',
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Tạo workflow mới
      </button>
    </div>
  );
}

interface WorkflowCardProps {
  item: WorkflowListEntry;
  onOpen: () => void;
  onDelete: () => void;
}

function WorkflowCard({ item, onOpen, onDelete }: WorkflowCardProps) {
  return (
    <li
      onClick={onOpen}
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-card',
        'transition-colors hover:bg-accent/30',
      )}
    >
      <span className="grid h-9 w-9 place-items-center rounded bg-primary/10 text-primary">
        <WorkflowIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-meta font-semibold text-foreground">{item.name}</p>
        <p className="truncate font-mono text-[10px] text-muted-foreground">
          {item.node_count} node · cập nhật {formatRelative(item.updated_at)}
          {item.sync_state !== 'synced' && (
            <span className="ml-1.5 text-warning">· chưa lưu</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            // Phase 3 P3.11 will hookup executor.
            showToast({
              title: 'Mở editor để chạy',
              message: 'Click "Mở editor" rồi bấm ▶ trong toolbar trái.',
              variant: 'info',
            });
          }}
          className="grid h-8 w-8 place-items-center rounded text-foreground hover:bg-accent"
          title="Chạy"
        >
          <Play className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="grid h-8 w-8 place-items-center rounded text-foreground hover:bg-accent"
          title="Mở editor"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="grid h-8 w-8 place-items-center rounded text-destructive hover:bg-destructive/10"
          title="Xoá"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:bg-accent"
          title="More"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function openEditorTab(workflowId: string) {
  const url = resolveExtensionUrl(`workflow-editor.html?wf=${encodeURIComponent(workflowId)}`);
  // Extension: dùng chrome.windows.create để pop riêng cửa sổ to.
  if (typeof chrome !== 'undefined' && chrome.windows?.create) {
    chrome.windows.create({
      url,
      type: 'popup',
      width: 1280,
      height: 800,
    });
    return;
  }
  // Dev:web: mở tab mới.
  window.open(url, '_blank', 'noopener,noreferrer');
}

function resolveExtensionUrl(relative: string): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(relative);
  }
  return `/${relative}`;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const d = Math.floor(hr / 24);
  return `${d} ngày trước`;
}

// suppress unused
void Loader2;
void Square;
