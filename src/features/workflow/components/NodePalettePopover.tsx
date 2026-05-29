/**
 * NodePalettePopover — floating palette popup, mở từ "+" button của
 * EditorSideToolbar. Pointer-drag từ item vào canvas tạo node.
 *
 * Layer: UI
 * Owner: features/workflow/components
 */

import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { cn } from '@/utils/cn';
import { NODE_TEMPLATES, NODE_TEMPLATE_GROUPS } from '../node-types';
import { useWorkflowStore } from '../store/workflow.store';
import type { NodeKind } from '@/types/workflow.types';

interface Props {
  onClose: () => void;
}

export function NodePalettePopover({ onClose }: Props) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filter = search.trim().toLowerCase();

  return (
    <>
      {/* Backdrop click → close */}
      <div className="fixed inset-0 z-30" onClick={onClose} />
      {/* Popup positioned ngay sau side toolbar */}
      <div
        className={cn(
          'fixed left-14 top-16 z-40 flex h-[80vh] w-[260px] flex-col',
          'rounded-lg border border-white/10 bg-[#15151c] shadow-card-dark',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
          <p className="text-eyebrow uppercase tracking-[0.12em] text-muted-foreground">
            Node palette
          </p>
          <button
            type="button"
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            <Icons.X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="border-b border-white/5 px-2 py-2">
          <div className="relative">
            <Icons.Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm node…"
              className="h-7 w-full rounded border border-white/10 bg-black/40 pl-6 pr-2 text-meta text-foreground placeholder:text-muted-foreground/70"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {NODE_TEMPLATE_GROUPS.map((group) => {
            const visible = group.kinds.filter((k) => {
              if (!filter) return true;
              const tpl = NODE_TEMPLATES[k];
              return (
                tpl.label.toLowerCase().includes(filter) ||
                tpl.description.toLowerCase().includes(filter) ||
                k.toLowerCase().includes(filter)
              );
            });
            if (visible.length === 0) return null;
            return (
              <section key={group.id} className="border-b border-white/5 py-2">
                <h3 className="px-3 pb-1.5 text-eyebrow uppercase tracking-[0.12em] text-muted-foreground/80">
                  {group.label}
                </h3>
                <ul className="flex flex-col gap-0.5 px-1">
                  {visible.map((k) => (
                    <PaletteItem key={k} kind={k} onDropped={onClose} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <DragGhost />
    </>
  );
}

function PaletteItem({ kind, onDropped }: { kind: NodeKind; onDropped: () => void }) {
  const tpl = NODE_TEMPLATES[kind];
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      tpl.iconName
    ] ?? Icons.Circle;
  const setDragging = useWorkflowStore((s) => s.setDragging);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragging(kind, { x: e.clientX, y: e.clientY });

    const onMove = (mv: PointerEvent) => {
      setDragging(kind, { x: mv.clientX, y: mv.clientY });
    };
    const onUp = (up: PointerEvent) => {
      window.dispatchEvent(
        new CustomEvent('h2flow:drop', {
          detail: { kind, x: up.clientX, y: up.clientY },
        }),
      );
      setDragging(null, null);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      onDropped();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
  };

  return (
    <li
      role="button"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      className={cn(
        'group flex cursor-grab select-none items-center gap-2 rounded px-2 py-1.5 transition-colors',
        'hover:bg-white/5 active:cursor-grabbing',
      )}
      title={tpl.description}
    >
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded text-white"
        style={{ background: tpl.accent }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-meta font-medium text-foreground">{tpl.label}</p>
        <p className="truncate text-[10px] text-muted-foreground">{tpl.description}</p>
      </div>
    </li>
  );
}

function DragGhost() {
  const draggingKind = useWorkflowStore((s) => s.draggingKind);
  const draggingPos = useWorkflowStore((s) => s.draggingPos);
  if (!draggingKind || !draggingPos) return null;
  const tpl = NODE_TEMPLATES[draggingKind];
  return (
    <div
      className="pointer-events-none fixed z-[9999] flex items-center gap-1.5 rounded border border-white/10 bg-[#1a1a22] px-2 py-1 text-meta shadow-card-dark"
      style={{ left: draggingPos.x + 12, top: draggingPos.y + 12 }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: tpl.accent }} />
      <span className="text-foreground">{tpl.label}</span>
    </div>
  );
}
