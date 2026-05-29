/**
 * EditorSideToolbar — vertical icon toolbar trái, TobyFlow-style.
 *
 * Layer: UI
 * Owner: features/workflow/components
 *
 * Icons (theo screenshot):
 *   +    → mở Node Palette popup
 *   ▶    → Run workflow
 *   ↶    → Undo
 *   ↷    → Redo
 *   📄    → Save / templates
 *   ⊡    → Frame fit
 *   ⊞    → Toggle grid / minimap
 *   ⚙    → Editor settings
 */

import { useState } from 'react';
import {
  FileText,
  Maximize2,
  Plus,
  Redo2,
  Settings,
  Play,
  Square,
  Undo2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useWorkflowStore } from '../store/workflow.store';
import { NodePalettePopover } from './NodePalettePopover';

interface Props {
  onSave?: () => void;
  onRun?: () => void;
  onStop?: () => void;
  onFitView?: () => void;
  isRunning?: boolean;
}

export function EditorSideToolbar({ onSave, onRun, onStop, onFitView, isRunning }: Props) {
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const past = useWorkflowStore((s) => s.past);
  const future = useWorkflowStore((s) => s.future);
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <aside className="relative z-20 flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-white/5 bg-[#0c0c10] py-3">
      <IconBtn label="Thêm node" active={paletteOpen} onClick={() => setPaletteOpen((v) => !v)}>
        <Plus className="h-4 w-4" />
      </IconBtn>

      <div className="my-1 h-px w-6 bg-white/5" />

      {isRunning ? (
        <IconBtn label="Dừng" variant="destructive" onClick={onStop}>
          <Square className="h-3.5 w-3.5" />
        </IconBtn>
      ) : (
        <IconBtn label="Chạy" variant="primary" onClick={onRun}>
          <Play className="h-3.5 w-3.5" />
        </IconBtn>
      )}

      <IconBtn label="Hoàn tác (Ctrl+Z)" disabled={past.length === 0} onClick={undo}>
        <Undo2 className="h-4 w-4" />
      </IconBtn>
      <IconBtn label="Làm lại (Ctrl+Y)" disabled={future.length === 0} onClick={redo}>
        <Redo2 className="h-4 w-4" />
      </IconBtn>

      <div className="my-1 h-px w-6 bg-white/5" />

      <IconBtn label="Lưu (Ctrl+S)" onClick={onSave}>
        <FileText className="h-4 w-4" />
      </IconBtn>
      <IconBtn label="Fit view" onClick={onFitView}>
        <Maximize2 className="h-4 w-4" />
      </IconBtn>

      <div className="mt-auto" />
      <IconBtn label="Cài đặt">
        <Settings className="h-4 w-4" />
      </IconBtn>

      {paletteOpen && (
        <NodePalettePopover
          onClose={() => setPaletteOpen(false)}
          /* Anchor relative to plus button position */
        />
      )}
    </aside>
  );
}

interface IconBtnProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'default' | 'primary' | 'destructive';
  children: React.ReactNode;
}
function IconBtn({ label, onClick, disabled, active, variant = 'default', children }: IconBtnProps) {
  const variantClass =
    variant === 'primary'
      ? 'bg-primary text-primary-foreground hover:opacity-90'
      : variant === 'destructive'
        ? 'bg-destructive text-destructive-foreground hover:opacity-90'
        : active
          ? 'bg-white/10 text-foreground'
          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'grid h-8 w-8 place-items-center rounded transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-30',
        variantClass,
      )}
    >
      {children}
    </button>
  );
}
