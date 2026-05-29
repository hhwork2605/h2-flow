/**
 * EditorToolbar — top header bar, TobyFlow-style.
 *
 * Layer: UI
 * Owner: features/workflow/components
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ <Name input> [enable]    ⚡ Runs 0/15 · ◷ Nodes 0/5  [Nâng cấp][Đóng][Tạo mới] │
 *   └──────────────────────────────────────────────────────────────────────┘
 */

import { useEffect } from 'react';
import { Crown, Plus, X, Zap, ListChecks } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useWorkflowStore } from '../store/workflow.store';
import { useEntitlements } from '@/core/useEntitlements';
import { nanoid } from '@/utils/nanoid';
import { saveWorkflow } from '../persistence';

interface Props {
  onSave?: () => void;
  onRun?: () => void;
  onStop?: () => void;
  isRunning?: boolean;
}

/**
 * Plan-based limits. Khi backend trả `quotas.workflow_run` / `quotas.nodes_per_workflow`
 * sẽ ưu tiên giá trị đó; còn không thì fallback theo plan slug.
 */
const PLAN_LIMITS: Record<string, { runs: number; nodes: number }> = {
  free: { runs: 15, nodes: 5 },
  trial: { runs: 50, nodes: 20 },
  pro: { runs: 200, nodes: 100 },
  team: { runs: 1000, nodes: 500 },
};
const DEFAULT_LIMIT = PLAN_LIMITS.free!;

export function EditorToolbar({ onSave }: Props) {
  const current = useWorkflowStore((s) => s.current);
  const rename = useWorkflowStore((s) => s.rename);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);

  // Plan-based limits — read từ entitlements.
  const entitlements = useEntitlements();
  const plan = entitlements.data?.plan ?? 'free';
  const isPaid = plan !== 'free';
  const limits = PLAN_LIMITS[plan] ?? DEFAULT_LIMIT;
  // Nếu backend trả quotas chi tiết (P5+) → ưu tiên.
  const maxRuns =
    Number(entitlements.data?.quotas?.workflow_run?.limit) || limits.runs;
  const maxNodes =
    Number(entitlements.data?.quotas?.nodes_per_workflow?.limit) || limits.nodes;

  // Ctrl+S / Ctrl+Z / Ctrl+Y shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 's') {
        e.preventDefault();
        onSave?.();
      } else if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSave, undo, redo]);

  if (!current) return null;

  const nodeCount = current.nodes.length;

  function handleClose() {
    window.close();
  }

  async function handleCreate() {
    const newDoc = {
      id: nanoid('wf'),
      name: `Workflow mới - ${formatToday()}`,
      description: '',
      project_id: null,
      schema_version: 1,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      created_at: Date.now(),
      updated_at: Date.now(),
      sync_state: 'unsaved' as const,
    };
    await saveWorkflow(newDoc);
    // Reload current tab vào workflow mới
    window.location.href = `?wf=${encodeURIComponent(newDoc.id)}`;
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/5 bg-[#0c0c10] px-4 text-foreground">
      {/* ─── Name + enable toggle ─── */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <input
          type="text"
          value={current.name}
          onChange={(e) => rename(e.target.value)}
          placeholder="Tên workflow"
          className={cn(
            'min-w-0 max-w-[420px] flex-1 rounded border-0 bg-transparent px-1 py-1',
            'text-[15px] font-semibold text-foreground',
            'placeholder:text-muted-foreground/70 focus:bg-white/5 focus:outline-none',
          )}
        />
        <EnableToggle />
      </div>

      {/* ─── Counters ─── */}
      <div className="hidden items-center gap-4 md:flex">
        <Counter icon={Zap} label="Runs" current={0} max={maxRuns} />
        <span className="h-4 w-px bg-white/10" />
        <Counter
          icon={ListChecks}
          label="Nodes"
          current={nodeCount}
          max={maxNodes}
          warn={nodeCount >= maxNodes}
        />
      </div>

      {/* ─── Upgrade pill (ẩn cho paid users) ─── */}
      {!isPaid && (
        <button
          type="button"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full px-3',
            'bg-gradient-to-r from-amber-400 to-orange-500 text-white',
            'text-[12.5px] font-semibold shadow-btn-glow hover:brightness-110',
          )}
        >
          <Crown className="h-3.5 w-3.5" />
          Nâng cấp
        </button>
      )}

      {/* ─── Đóng + Tạo mới ─── */}
      <button
        type="button"
        onClick={handleClose}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded px-3',
          'bg-white/5 text-foreground hover:bg-white/10',
          'text-[12.5px] font-medium',
        )}
      >
        <X className="h-3.5 w-3.5" />
        Đóng
      </button>
      <button
        type="button"
        onClick={handleCreate}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded px-3',
          'bg-white text-[#0c0c10] hover:bg-white/90',
          'text-[12.5px] font-semibold',
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Tạo mới
      </button>
    </header>
  );
}

function EnableToggle() {
  // Đơn giản: state cục bộ, không persist (placeholder hiển thị).
  const [on, set] = [true, (_v: boolean) => {}];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => set(!on)}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        on ? 'bg-success' : 'bg-white/15',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          on ? 'translate-x-[18px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  );
}

interface CounterProps {
  icon: typeof Zap;
  label: string;
  current: number;
  max: number;
  warn?: boolean;
}
function Counter({ icon: Icon, label, current, max, warn }: CounterProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
      <Icon className={cn('h-3.5 w-3.5', warn ? 'text-warning' : 'text-muted-foreground/70')} />
      <span>{label}</span>
      <span className={cn('font-mono font-semibold', warn ? 'text-warning' : 'text-foreground')}>
        {current}/{max}
      </span>
    </span>
  );
}

function formatToday(): string {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
