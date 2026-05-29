/**
 * NodePalette — sidebar trái với 14 node templates, **pointer-drag** onto canvas.
 *
 * Layer: UI
 * Owner: features/workflow/components
 *
 * Dùng pointer events thay vì HTML5 drag-and-drop (`dataTransfer`) vì
 * dataTransfer không reliable trong vài context (React Flow internals đôi khi
 * cancel drag operation). Pointer-based:
 *   onPointerDown trên palette item → setDragging(kind, pos)
 *   document.onPointerMove → cập nhật pos (DiagramCanvas + ghost theo dõi)
 *   document.onPointerUp → DiagramCanvas check toạ độ, addNode nếu trong canvas
 *
 * Spec: docs/features/04-workflow.md §A2.
 */

import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  NODE_TEMPLATES,
  NODE_TEMPLATE_GROUPS,
} from '../node-types';
import { useWorkflowStore } from '../store/workflow.store';
import type { NodeKind } from '@/types/workflow.types';

export function NodePalette() {
  const [search, setSearch] = useState('');
  const filter = search.trim().toLowerCase();

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r bg-card">
      <header className="border-b px-3 py-2.5">
        <p className="text-eyebrow uppercase tracking-[0.12em] text-muted-foreground">
          Node palette
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Kéo thả vào canvas để thêm node
        </p>
      </header>

      <div className="border-b px-2 py-2">
        <div className="relative">
          <Icons.Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm node…"
            className="h-7 w-full rounded border bg-background pl-6 pr-2 text-meta text-foreground placeholder:text-muted-foreground/70"
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
            <section key={group.id} className="border-b py-2">
              <h3 className="px-3 pb-1.5 text-eyebrow uppercase tracking-[0.12em] text-muted-foreground/80">
                {group.label}
              </h3>
              <ul className="flex flex-col gap-0.5 px-1">
                {visible.map((k) => (
                  <PaletteItem key={k} kind={k} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <DragGhost />
    </aside>
  );
}

function PaletteItem({ kind }: { kind: NodeKind }) {
  const tpl = NODE_TEMPLATES[kind];
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      tpl.iconName
    ] ?? Icons.Circle;
  const setDragging = useWorkflowStore((s) => s.setDragging);

  /**
   * Pointer-down → bắt đầu drag. Document-level move + up listeners gắn 1 lần
   * tại đây (cleanup khi up). Canvas component lo logic addNode khi up.
   */
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // chỉ chuột trái
    e.preventDefault();
    setDragging(kind, { x: e.clientX, y: e.clientY });
    console.info('[workflow] pointer-drag start', kind);

    const onMove = (mv: PointerEvent) => {
      setDragging(kind, { x: mv.clientX, y: mv.clientY });
    };
    const onUp = (up: PointerEvent) => {
      console.info('[workflow] pointer-drag end at', up.clientX, up.clientY);
      // Dispatch custom event để DiagramCanvas pick up + addNode nếu trong canvas.
      window.dispatchEvent(
        new CustomEvent('h2flow:drop', {
          detail: { kind, x: up.clientX, y: up.clientY },
        }),
      );
      setDragging(null, null);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
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
        'hover:bg-accent active:cursor-grabbing',
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

/**
 * DragGhost — floating tag theo dõi chuột khi đang drag.
 * Render qua portal vào body để khỏi bị parent overflow clip.
 */
function DragGhost() {
  const draggingKind = useWorkflowStore((s) => s.draggingKind);
  const draggingPos = useWorkflowStore((s) => s.draggingPos);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!draggingKind || !draggingPos || !mounted) return null;
  const tpl = NODE_TEMPLATES[draggingKind];

  return (
    <div
      className="pointer-events-none fixed z-[9999] flex items-center gap-1.5 rounded border bg-card px-2 py-1 text-meta shadow-card"
      style={{
        left: draggingPos.x + 12,
        top: draggingPos.y + 12,
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: tpl.accent }}
      />
      <span className="text-foreground">{tpl.label}</span>
    </div>
  );
}
