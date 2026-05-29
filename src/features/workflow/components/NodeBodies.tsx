/**
 * NodeBodies — per-kind body renderer cho BaseNode.
 *
 * Layer: UI
 * Owner: features/workflow/components
 *
 * Mỗi kind có UI riêng biệt theo `reference-ext/src/workflow/NodeTemplates.js`:
 *   - trigger: source badge
 *   - prompt: inline textarea + enhance mode badge
 *   - generate / chatgpt / grok / gemini: ratio-aware preview + provider chips
 *   - edit: source preview + strength bar + mode chip
 *   - angles: preset name + count radial pattern
 *   - effects: effect name + intensity bar
 *   - branch: expression input + 2 labeled outputs (true/false)
 *   - delay: inline "Chờ {N} giây" number input
 *   - download: folder template + segmented resolution
 *   - telegram: linked status + send mode
 *   - multi: run_mode segmented + parallel count
 *
 * Inline-editable nodes (prompt textarea / delay number / branch expression)
 * có `nodrag` class style để React Flow KHÔNG capture pointer khi user gõ.
 * (Cách dùng: React Flow check `.nodrag` className để skip drag.)
 */

import { Folder, Send, Sparkles, Clock, GitBranch, ImageIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useWorkflowStore } from '../store/workflow.store';
import type { NodeKind, WorkflowNodeData } from '@/types/workflow.types';

/* ─── Size per kind ─────────────────────────────────────────────────── */

export interface NodeSize {
  width: number;
  minHeight: number;
}

export const NODE_SIZE: Record<NodeKind, NodeSize> = {
  trigger: { width: 220, minHeight: 120 },
  prompt: { width: 240, minHeight: 200 },
  generate: { width: 260, minHeight: 380 },
  chatgpt: { width: 260, minHeight: 380 },
  grok: { width: 260, minHeight: 380 },
  gemini: { width: 260, minHeight: 380 },
  edit: { width: 240, minHeight: 280 },
  angles: { width: 240, minHeight: 220 },
  effects: { width: 240, minHeight: 200 },
  branch: { width: 220, minHeight: 160 },
  delay: { width: 200, minHeight: 100 },
  download: { width: 220, minHeight: 180 },
  telegram: { width: 220, minHeight: 180 },
  multi: { width: 240, minHeight: 180 },
};

/** Map ratio key/value → aspect-ratio CSS value. */
const RATIO_CSS: Record<string, string> = {
  '16:9': '16/9',
  '9:16': '9/16',
  '1:1': '1/1',
  '4:3': '4/3',
  '3:4': '3/4',
  '2:3': '2/3',
  '3:2': '3/2',
  'widescreen': '16/9',
  'story': '9/16',
  'square': '1/1',
  'landscape': '4/3',
  'portrait': '3/4',
};

/* ─── Dispatcher ─────────────────────────────────────────────────── */

export function renderNodeBody(nodeId: string, data: WorkflowNodeData): React.ReactNode {
  switch (data.kind) {
    case 'trigger':
      return <TriggerBody data={data} />;
    case 'prompt':
      return <PromptBody nodeId={nodeId} data={data} />;
    case 'generate':
    case 'chatgpt':
    case 'grok':
    case 'gemini':
      return <ProviderGenBody data={data} />;
    case 'edit':
      return <EditBody data={data} />;
    case 'angles':
      return <AnglesBody data={data} />;
    case 'effects':
      return <EffectsBody data={data} />;
    case 'branch':
      return <BranchBody nodeId={nodeId} data={data} />;
    case 'delay':
      return <DelayBody nodeId={nodeId} data={data} />;
    case 'download':
      return <DownloadBody data={data} />;
    case 'telegram':
      return <TelegramBody data={data} />;
    case 'multi':
      return <MultiBody data={data} />;
    default:
      return null;
  }
}

/* ─── Per-kind body components ─────────────────────────────────────────── */

function TriggerBody({ data }: { data: WorkflowNodeData }) {
  const source = String(data.params.source ?? 'manual');
  const labelMap: Record<string, string> = {
    manual: 'Thủ công',
    telegram: 'Telegram bot',
    schedule: 'Theo lịch',
  };
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-4">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
        <Sparkles className="h-4 w-4" strokeWidth={2} />
      </span>
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Nguồn</p>
      <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[12px] font-medium text-foreground">
        {labelMap[source] ?? source}
      </span>
    </div>
  );
}

function PromptBody({ nodeId, data }: { nodeId: string; data: WorkflowNodeData }) {
  const updateParams = useWorkflowStore((s) => s.updateNodeParams);
  const text = String(data.params.text ?? '');
  const enhance = !!data.params.enhance;
  const multi = !!data.params.multi_prompt;
  const provider = String(data.params.provider ?? 'chatgpt');

  return (
    <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
      <textarea
        className="nodrag h-[88px] w-full resize-none rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none"
        placeholder="Nhập prompt..."
        value={text}
        onChange={(e) => updateParams(nodeId, { text: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <div className="flex flex-wrap items-center gap-1">
        {enhance ? (
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10.5px] font-medium text-primary">
            Enhance · {provider === 'gemini' ? 'Gemini' : 'ChatGPT'}
          </span>
        ) : (
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
            Plain
          </span>
        )}
        {multi && (
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
            Multi-prompt
          </span>
        )}
      </div>
    </div>
  );
}

function ProviderGenBody({ data }: { data: WorkflowNodeData }) {
  const ratio = String(data.params.ratio ?? '16:9');
  const aspect = RATIO_CSS[ratio] ?? '16/9';
  const preview = data.outputPreview;

  return (
    <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
      {/* Ratio-aware preview box */}
      <div
        className="grid w-full place-items-center overflow-hidden rounded-lg bg-black/40"
        style={{ aspectRatio: aspect }}
      >
        {preview ? (
          <img src={preview} alt="output" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground/25" strokeWidth={1.2} />
        )}
      </div>
    </div>
  );
}

function EditBody({ data }: { data: WorkflowNodeData }) {
  const mode = String(data.params.mode ?? 'inpaint');
  const strength = Number(data.params.strength ?? 0.7);
  const strengthPct = Math.max(0, Math.min(1, strength)) * 100;
  return (
    <div className="flex flex-1 flex-col gap-2.5 px-3 py-2.5">
      <div
        className="grid w-full place-items-center overflow-hidden rounded-lg bg-black/40"
        style={{ aspectRatio: '1/1' }}
      >
        <ImageIcon className="h-7 w-7 text-muted-foreground/25" strokeWidth={1.2} />
      </div>
      <div className="space-y-1">
        <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground/80">
          Strength · {Math.round(strengthPct)}%
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-primary/70"
            style={{ width: `${strengthPct}%` }}
          />
        </div>
        <span className="inline-block rounded bg-white/5 px-1.5 py-0.5 text-[10.5px] capitalize text-muted-foreground">
          {mode}
        </span>
      </div>
    </div>
  );
}

function AnglesBody({ data }: { data: WorkflowNodeData }) {
  const preset = String(data.params.preset ?? 'portrait-reangle');
  const count = Number(data.params.angle_count ?? 3);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-3">
      {/* Radial mini-pattern: render `count` dots arranged in a circle. */}
      <div className="relative h-16 w-16">
        {Array.from({ length: Math.max(3, Math.min(8, count)) }).map((_, i, arr) => {
          const angle = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
          const r = 26;
          const x = 32 + r * Math.cos(angle) - 4;
          const y = 32 + r * Math.sin(angle) - 4;
          return (
            <span
              key={i}
              className="absolute h-2 w-2 rounded-full bg-primary/70"
              style={{ left: x, top: y }}
            />
          );
        })}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[13px] font-semibold text-foreground">
          {count}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">{preset}</p>
    </div>
  );
}

function EffectsBody({ data }: { data: WorkflowNodeData }) {
  const effectId = String(data.params.effect_id ?? '');
  const intensity = Number(data.params.intensity ?? 50);
  return (
    <div className="flex flex-1 flex-col gap-2.5 px-3 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/80">
          Hiệu ứng
        </span>
        <span className="font-mono text-[10.5px] text-muted-foreground">{intensity}%</span>
      </div>
      <div className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5">
        <p className="truncate text-[12px] text-foreground">
          {effectId || <span className="text-muted-foreground/60">Chưa chọn effect</span>}
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${Math.max(0, Math.min(100, intensity))}%` }}
        />
      </div>
    </div>
  );
}

function BranchBody({ nodeId, data }: { nodeId: string; data: WorkflowNodeData }) {
  const updateParams = useWorkflowStore((s) => s.updateNodeParams);
  const expr = String(data.params.expression ?? '');
  return (
    <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground/80">
        <GitBranch className="h-3 w-3" />
        Điều kiện
      </div>
      <input
        type="text"
        className="nodrag h-8 w-full rounded border border-white/10 bg-black/40 px-2 font-mono text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none"
        placeholder="vd: count(input) > 5"
        value={expr}
        onChange={(e) => updateParams(nodeId, { expression: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <div className="mt-auto flex items-center justify-between text-[10.5px]">
        <span className="inline-flex items-center gap-1 text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> true
        </span>
        <span className="inline-flex items-center gap-1 text-destructive">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> false
        </span>
      </div>
    </div>
  );
}

function DelayBody({ nodeId, data }: { nodeId: string; data: WorkflowNodeData }) {
  const updateParams = useWorkflowStore((s) => s.updateNodeParams);
  const durationMs = Number(data.params.duration_ms ?? 3000);
  const seconds = Math.round(durationMs / 1000);
  return (
    <div className="flex flex-1 items-center justify-center gap-2 px-3 py-3">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <span className="text-[12.5px] text-muted-foreground">Chờ</span>
      <input
        type="number"
        min={1}
        max={300}
        value={seconds}
        onChange={(e) => updateParams(nodeId, { duration_ms: Number(e.target.value) * 1000 })}
        onPointerDown={(e) => e.stopPropagation()}
        className="nodrag h-7 w-14 rounded border border-white/10 bg-black/40 px-1.5 text-center font-mono text-[13px] text-foreground"
      />
      <span className="text-[12.5px] text-muted-foreground">giây</span>
    </div>
  );
}

function DownloadBody({ data }: { data: WorkflowNodeData }) {
  const folder = String(data.params.folder_template ?? '{date}/{project}');
  const resolution = String(data.params.resolution ?? '2K');
  return (
    <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground/80">
        <Folder className="h-3 w-3" />
        Thư mục
      </div>
      <div className="truncate rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-foreground">
        {folder}
      </div>
      <div className="mt-1 flex items-center gap-1">
        {['1K', '2K', '4K'].map((r) => (
          <span
            key={r}
            className={cn(
              'flex-1 rounded px-2 py-1 text-center text-[11px]',
              r === resolution
                ? 'bg-primary/15 text-primary'
                : 'bg-white/5 text-muted-foreground',
            )}
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

function TelegramBody({ data }: { data: WorkflowNodeData }) {
  const chatId = String(data.params.telegram_chat_id ?? '');
  const mode = String(data.params.mode ?? 'photo');
  return (
    <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Send className="h-3.5 w-3.5 text-[#26A5E4]" />
        {chatId ? (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Đã kết nối
          </span>
        ) : (
          <span className="text-[11.5px] text-muted-foreground">Chưa cấu hình</span>
        )}
      </div>
      <div className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[11px]">
        {chatId || <span className="text-muted-foreground/60">chat_id chưa set</span>}
      </div>
      <span className="inline-block w-fit rounded bg-white/5 px-1.5 py-0.5 text-[10.5px] capitalize text-muted-foreground">
        {mode === 'photo' ? 'Từng ảnh' : 'Document'}
      </span>
    </div>
  );
}

function MultiBody({ data }: { data: WorkflowNodeData }) {
  const runMode = String(data.params.run_mode ?? 'parallel');
  const maxParallel = Number(data.params.max_parallel ?? 4);
  return (
    <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center gap-1">
        {(['sequential', 'parallel'] as const).map((m) => (
          <span
            key={m}
            className={cn(
              'flex-1 rounded px-2 py-1 text-center text-[10.5px] capitalize',
              m === runMode
                ? 'bg-primary/15 text-primary'
                : 'bg-white/5 text-muted-foreground',
            )}
          >
            {m === 'sequential' ? 'Tuần tự' : 'Song song'}
          </span>
        ))}
      </div>
      {runMode === 'parallel' && (
        <div className="flex items-center justify-between rounded-md bg-white/[0.02] px-2.5 py-1.5">
          <span className="text-[11px] text-muted-foreground">Max parallel</span>
          <span className="font-mono text-[13px] font-semibold text-foreground">
            {maxParallel}
          </span>
        </div>
      )}
    </div>
  );
}
