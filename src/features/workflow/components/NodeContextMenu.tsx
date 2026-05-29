/**
 * NodeContextMenu — right-click menu cho node.
 *
 * Layer: UI
 * Owner: features/workflow/components
 *
 * Mở từ `DiagramCanvas` qua `onNodeContextMenu` prop. Items đồng bộ với
 * BaseNode hover toolbar (theo reference-ext: hover toolbar + context menu
 * share dispatchNodeAction).
 *
 * Tham chiếu: `reference-ext/src/workflow/DiagramCanvas.js` `_showNodeContextMenu`.
 */

import { useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import { cn } from '@/utils/cn';
import { useWorkflowStore } from '../store/workflow.store';
import { runSingleNodeMock } from '../executor/WorkflowExecutor';
import { openNodeSettings } from './NodeSettingsModal';
import { showToast } from '@/ui/components/Toast';

export interface NodeContextMenuProps {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function NodeContextMenu({ nodeId, x, y, onClose }: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const duplicateNodes = useWorkflowStore((s) => s.duplicateNodes);
  const removeNodes = useWorkflowStore((s) => s.removeNodes);
  const toggleEnabled = useWorkflowStore((s) => s.toggleNodeEnabled);
  const branchFromNode = useWorkflowStore((s) => s.branchFromNode);
  const isRunning = useWorkflowStore((s) => s.isRunning);
  const node = useWorkflowStore((s) =>
    s.current?.nodes.find((n) => n.id === nodeId),
  );

  // Close on outside click / Escape.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Adjust position khi menu vượt viewport.
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (rect.right > window.innerWidth - 8) nx = window.innerWidth - rect.width - 8;
    if (rect.bottom > window.innerHeight - 8) ny = window.innerHeight - rect.height - 8;
    el.style.left = `${Math.max(8, nx)}px`;
    el.style.top = `${Math.max(8, ny)}px`;
  }, [x, y]);

  if (!node) return null;

  const isDisabled = !!node.data.disabled;

  function run(action: () => void) {
    action();
    onClose();
  }

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-[9500] flex w-[200px] flex-col rounded-md border border-white/10 bg-[#1a1a22] py-1',
        'shadow-card-dark animate-[fadeIn_0.12s_ease-out]',
      )}
      style={{ left: x, top: y }}
      role="menu"
    >
      <MenuItem
        icon={Icons.Play}
        label="Chạy node"
        shortcut={isRunning ? undefined : undefined}
        disabled={isRunning}
        onClick={() => {
          run(() => {
            if (!isRunning) runSingleNodeMock(nodeId);
          });
        }}
      />
      <MenuItem
        icon={isDisabled ? Icons.ToggleLeft : Icons.ToggleRight}
        label={isDisabled ? 'Bật node' : 'Tắt node'}
        onClick={() => run(() => toggleEnabled(nodeId))}
      />
      <MenuItem
        icon={Icons.Settings}
        label="Cài đặt"
        onClick={() => run(() => openNodeSettings(nodeId))}
      />
      <MenuItem
        icon={Icons.GitBranch}
        label="Tạo nhánh"
        onClick={() =>
          run(() => {
            const newId = branchFromNode(nodeId);
            if (newId) {
              showToast({
                title: 'Đã tạo nhánh',
                variant: 'success',
                durationMs: 1500,
              });
            }
          })
        }
      />
      <Separator />
      <MenuItem
        icon={Icons.Copy}
        label="Nhân bản"
        shortcut="Ctrl+D"
        onClick={() => run(() => duplicateNodes([nodeId]))}
      />
      <MenuItem
        icon={Icons.Trash2}
        label="Xoá"
        shortcut="Del"
        variant="destructive"
        onClick={() => run(() => removeNodes([nodeId]))}
      />
    </div>
  );
}

interface MenuItemProps {
  icon: typeof Icons.Play;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
  onClick: () => void;
}
function MenuItem({ icon: Icon, label, shortcut, disabled, variant, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-30',
        variant === 'destructive'
          ? 'text-destructive hover:bg-destructive/15'
          : 'text-foreground hover:bg-white/5',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="font-mono text-[10.5px] text-muted-foreground">{shortcut}</span>
      )}
    </button>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-white/5" />;
}
