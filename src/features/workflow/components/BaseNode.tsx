/**
 * BaseNode — generic renderer cho mọi node kind, **TobyFlow-style**.
 *
 * Layer: UI
 * Owner: features/workflow/components
 *
 * Layout:
 *   ┌─ floating action toolbar (chỉ khi selected) ─┐
 *   │  ▶ ⚙ 🔀 ⧉ 🗑                                 │
 *   ├──────────────────────────────────────────────┤
 *   │ <icon> Type label              [enable toggle]│  header bar (color border)
 *   ├──────────────────────────────────────────────┤
 *   │                                              │
 *   │              [preview image area]            │  500-650px tall
 *   │                                              │
 *   ├──────────────────────────────────────────────┤
 *   │ <param chips: media / ratio / quality>  ⚙   │  bottom strip
 *   └──────────────────────────────────────────────┘
 *
 * Ports: image-in trên cạnh trái giữa, image-out + text-in cạnh phải.
 * Tự vẽ port circle bên ngoài node body, không trộn vào layout.
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import * as Icons from 'lucide-react';
import { cn } from '@/utils/cn';
import { getTemplate } from '../node-types';
import { useWorkflowStore } from '../store/workflow.store';
import { runSingleNodeMock } from '../executor/WorkflowExecutor';
import { openNodeSettings } from './NodeSettingsModal';
import { renderNodeBody, NODE_SIZE } from './NodeBodies';
import { showToast } from '@/ui/components/Toast';
import type { PortDef, WorkflowNodeData, NodeStatus } from '@/types/workflow.types';

const PORT_COLOR: Record<string, string> = {
  text: '#9177e1',
  image: '#3b82f6',
  video: '#a855f7',
  frame: '#14b8a6',
  any: '#71717a',
};

const STATUS_RING: Record<NodeStatus, string> = {
  idle: '',
  pending: 'animate-pulse',
  running: 'animate-pulse',
  completed: '',
  failed: '',
  cancelled: 'opacity-50',
  skipped: 'opacity-40',
};

export const BaseNode = memo(function BaseNode({
  data,
  selected,
  id,
}: NodeProps<WorkflowNodeData>) {
  const template = getTemplate(data.kind);
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      template.iconName
    ] ?? Icons.Circle;

  const status = data.status ?? 'idle';
  const title = data.title ?? template.label;
  const accent = template.accent;

  const duplicateNodes = useWorkflowStore((s) => s.duplicateNodes);
  const removeNodes = useWorkflowStore((s) => s.removeNodes);
  const toggleEnabled = useWorkflowStore((s) => s.toggleNodeEnabled);
  const branchFromNode = useWorkflowStore((s) => s.branchFromNode);
  const isRunning = useWorkflowStore((s) => s.isRunning);
  const isDisabled = !!data.disabled;

  const onRunSingle = () => {
    if (isRunning) {
      showToast({ title: 'Đang chạy', message: 'Đợi run hiện tại kết thúc.', variant: 'warn' });
      return;
    }
    const handle = runSingleNodeMock(id);
    if (!handle) {
      showToast({ title: 'Không khởi chạy được node', variant: 'error' });
    }
  };

  const onBranch = () => {
    const newId = branchFromNode(id);
    if (newId) {
      showToast({
        title: 'Đã tạo nhánh',
        message: 'Node mới nối vào output đầu tiên.',
        variant: 'success',
        durationMs: 1800,
      });
    } else {
      showToast({ title: 'Không tạo được nhánh', variant: 'error' });
    }
  };

  return (
    <div className="relative">
      {/* ─── Floating action toolbar (hover/selected) ─── */}
      {selected && (
        <div
          className={cn(
            'absolute -top-9 left-1/2 -translate-x-1/2 z-10',
            'inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-[#1a1a22] px-1 py-1',
            'shadow-card-dark',
          )}
          // Prevent React Flow node-drag khi click vào toolbar.
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ActionBtn label="Chạy node" icon={Icons.Play} onClick={onRunSingle} />
          <ActionBtn
            label="Cài đặt"
            icon={Icons.Settings}
            onClick={() => openNodeSettings(id)}
          />
          <ActionBtn label="Tạo nhánh" icon={Icons.GitBranch} onClick={onBranch} />
          <ActionBtn
            label="Nhân bản (Ctrl+D)"
            icon={Icons.Copy}
            onClick={() => duplicateNodes([id])}
          />
          <ActionBtn
            label="Xoá"
            icon={Icons.Trash2}
            variant="destructive"
            onClick={() => removeNodes([id])}
          />
        </div>
      )}

      {/* ─── Node body ─── */}
      <div
        className={cn(
          'flex flex-col overflow-hidden rounded-2xl border-2 bg-[#15151c]',
          'transition-shadow',
          STATUS_RING[status],
          isDisabled && 'opacity-60',
        )}
        style={{
          width: NODE_SIZE[data.kind].width,
          minHeight: NODE_SIZE[data.kind].minHeight,
          borderColor: selected ? accent : 'rgba(255,255,255,0.08)',
          boxShadow: selected ? `0 0 0 1px ${accent}40, 0 0 24px ${accent}40` : undefined,
        }}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center gap-2 border-b border-white/5 px-3 py-2">
          <span
            className="grid h-5 w-5 place-items-center rounded text-white"
            style={{ background: accent }}
          >
            <Icon className="h-3 w-3" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
            {title}
          </span>
          {/* Enable toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={!isDisabled}
            onClick={() => toggleEnabled(id)}
            onPointerDown={(e) => e.stopPropagation()}
            title={isDisabled ? 'Bật node' : 'Tắt node (executor sẽ skip)'}
            className={cn(
              'inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors',
              isDisabled ? 'bg-white/15' : 'bg-success',
            )}
            aria-label="Enable"
          >
            <span
              className={cn(
                'inline-block h-3 w-3 rounded-full bg-white shadow transition-transform',
                isDisabled ? 'translate-x-[2px]' : 'translate-x-[14px]',
              )}
            />
          </button>
        </header>

        {/* Per-kind body */}
        {renderNodeBody(id, data)}

        {/* Bottom strip: params chips (kind-specific summary) + Settings cog */}
        <footer className="flex shrink-0 items-center gap-1.5 border-t border-white/5 bg-black/20 px-2 py-1.5 text-[10.5px]">
          {renderParamChips(data, template.kind)}
          <span className="ml-auto" />
          <button
            type="button"
            onClick={() => openNodeSettings(id)}
            onPointerDown={(e) => e.stopPropagation()}
            title="Cài đặt node"
            className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground"
            aria-label="Node settings"
          >
            <Icons.Settings className="h-3 w-3" />
          </button>
        </footer>

        {/* Error footer */}
        {data.errorMessage && (
          <div className="shrink-0 border-t border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
            {data.errorMessage}
          </div>
        )}
      </div>

      {/* ─── Side ports — vẽ nổi ngoài body ─── */}
      {template.inputs.map((p, i) => (
        <SidePort key={`in-${p.id}`} port={p} side="left" index={i} count={template.inputs.length} nodeId={id} />
      ))}
      {template.outputs.map((p, i) => (
        <SidePort key={`out-${p.id}`} port={p} side="right" index={i} count={template.outputs.length} nodeId={id} />
      ))}
    </div>
  );
});

/* ─── Helpers ─────────────────────────────────────────────────────── */

interface SidePortProps {
  port: PortDef;
  side: 'left' | 'right';
  index: number;
  count: number;
  nodeId: string;
}
function SidePort({ port, side, index, count, nodeId }: SidePortProps) {
  const color = PORT_COLOR[port.type] ?? '#71717a';
  // Phân bố đều theo cao của node body (~420px) — chia 1/(count+1) khoảng.
  const top = `${((index + 1) / (count + 1)) * 100}%`;
  const IconForType =
    port.type === 'text'
      ? 'T'
      : port.type === 'image' || port.type === 'frame'
        ? '🖼'
        : port.type === 'video'
          ? '▶'
          : '*';
  void nodeId;
  return (
    <div
      className={cn(
        'absolute z-[1] flex items-center gap-1',
        side === 'left' ? '-left-3 flex-row-reverse' : '-right-3',
      )}
      style={{ top, transform: 'translateY(-50%)' }}
    >
      <Handle
        type={side === 'left' ? 'target' : 'source'}
        position={side === 'left' ? Position.Left : Position.Right}
        id={port.id}
        style={{
          width: 24,
          height: 24,
          background: '#15151c',
          border: `2px solid ${color}`,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: color,
          fontWeight: 'bold',
        }}
        data-port-type={port.type}
      >
        <span style={{ pointerEvents: 'none', fontSize: 10, lineHeight: 1 }}>
          {typeof IconForType === 'string' && IconForType.length === 1 ? IconForType : ''}
        </span>
      </Handle>
    </div>
  );
}

interface ActionBtnProps {
  label: string;
  icon: typeof Icons.Play;
  variant?: 'default' | 'destructive';
  onClick?: () => void;
  disabled?: boolean;
}
function ActionBtn({ label, icon: Icon, variant, onClick, disabled }: ActionBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'grid h-7 w-7 place-items-center rounded transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-30',
        variant === 'destructive'
          ? 'text-destructive hover:bg-destructive/15'
          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/** Render param chips ở footer cho node kind. Body đã thể hiện chi tiết riêng. */
function renderParamChips(
  data: WorkflowNodeData,
  kind: WorkflowNodeData['kind'],
): React.ReactNode {
  const chips: { label: string }[] = [];
  const p = data.params as Record<string, unknown>;

  switch (kind) {
    case 'generate':
    case 'gemini':
      if (p.media_type) chips.push({ label: String(p.media_type) });
      if (p.ratio) chips.push({ label: String(p.ratio) });
      if (p.quantity) chips.push({ label: `${p.quantity}×` });
      break;
    case 'chatgpt':
      if (p.model) chips.push({ label: String(p.model) });
      if (p.ratio) chips.push({ label: String(p.ratio) });
      break;
    case 'grok':
      if (p.mode) chips.push({ label: String(p.mode) });
      if (p.ratio) chips.push({ label: String(p.ratio) });
      break;
    case 'edit':
      if (p.mode) chips.push({ label: String(p.mode) });
      break;
    case 'angles':
      if (p.angle_count) chips.push({ label: `${p.angle_count} góc` });
      break;
    case 'multi':
      if (p.run_mode) chips.push({ label: p.run_mode === 'parallel' ? 'Song song' : 'Tuần tự' });
      break;
    case 'trigger':
      if (p.source) chips.push({ label: String(p.source) });
      break;
    // delay / branch / download / telegram / prompt body đã có đủ chi tiết.
  }

  if (chips.length === 0) return null;
  return chips.map((c, i) => (
    <span
      key={i}
      className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-muted-foreground"
    >
      {c.label}
    </span>
  ));
}
