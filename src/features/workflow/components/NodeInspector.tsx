/**
 * NodeInspector — right panel để edit params của node đang select.
 *
 * Layer: UI
 * Owner: features/workflow/components
 *
 * Tối thiểu Phase 3: render JSON-style key/value editor cho `data.params`.
 * Phase 4+ sẽ replace bằng form schema per kind (vd: provider dropdown, ratio
 * picker, model select reuse từ features/generate).
 */

import { useEffect, useState } from 'react';
import { useStore as useReactFlowStore } from 'reactflow';
import { useWorkflowStore } from '../store/workflow.store';
import { getTemplate } from '../node-types';
import { cn } from '@/utils/cn';

export function NodeInspector() {
  const current = useWorkflowStore((s) => s.current);
  const updateParams = useWorkflowStore((s) => s.updateNodeParams);
  const updateTitle = useWorkflowStore((s) => s.updateNodeTitle);
  const removeNodes = useWorkflowStore((s) => s.removeNodes);

  // React Flow tracks selection ở internal store.
  const selectedId = useReactFlowStore((s) => {
    const ids = Array.from(s.nodeInternals.values())
      .filter((n) => n.selected)
      .map((n) => n.id);
    return ids.length === 1 ? ids[0] : null;
  });

  const node = current?.nodes.find((n) => n.id === selectedId);

  if (!current) {
    return (
      <aside className="hidden h-full w-[280px] shrink-0 flex-col border-l bg-card md:flex">
        <header className="border-b px-3 py-2.5">
          <p className="text-eyebrow uppercase tracking-[0.12em] text-muted-foreground">
            Inspector
          </p>
        </header>
        <p className="px-3 py-4 text-meta text-muted-foreground">Chưa có workflow.</p>
      </aside>
    );
  }

  if (!node) {
    return (
      <aside className="hidden h-full w-[280px] shrink-0 flex-col border-l bg-card md:flex">
        <header className="border-b px-3 py-2.5">
          <p className="text-eyebrow uppercase tracking-[0.12em] text-muted-foreground">
            Inspector
          </p>
        </header>
        <p className="px-3 py-4 text-meta text-muted-foreground">
          Chọn 1 node để xem thuộc tính.
        </p>
      </aside>
    );
  }

  const tpl = getTemplate(node.kind);

  return (
    <aside className="hidden h-full w-[280px] shrink-0 flex-col overflow-y-auto border-l bg-card md:flex">
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <span
          className="grid h-6 w-6 place-items-center rounded text-white"
          style={{ background: tpl.accent }}
        >
          <span className="text-[10px] font-bold uppercase">{node.kind[0]}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow uppercase tracking-[0.12em] text-muted-foreground">
            {tpl.label}
          </p>
          <p className="truncate font-mono text-[10px] text-muted-foreground/70">
            {node.id}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 p-3">
        {/* Title field */}
        <Field label="Tên hiển thị">
          <input
            type="text"
            value={node.data.title ?? ''}
            placeholder={tpl.label}
            onChange={(e) => updateTitle(node.id, e.target.value)}
            className="h-8 w-full rounded border bg-background px-2 text-meta text-foreground"
          />
        </Field>

        {/* Params — render từng key */}
        {Object.entries(tpl.defaultParams).map(([key, defaultValue]) => (
          <ParamField
            key={key}
            paramKey={key}
            currentValue={node.data.params[key] ?? defaultValue}
            defaultValue={defaultValue}
            onChange={(v) => updateParams(node.id, { [key]: v })}
          />
        ))}

        {/* Actions */}
        <div className="mt-2 flex items-center justify-between border-t pt-3">
          <button
            type="button"
            onClick={() => removeNodes([node.id])}
            className="text-meta text-destructive hover:underline"
          >
            Xoá node
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">
            ({tpl.inputs.length} in / {tpl.outputs.length} out)
          </span>
        </div>
      </div>
    </aside>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}
function Field({ label, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

interface ParamFieldProps {
  paramKey: string;
  currentValue: unknown;
  defaultValue: unknown;
  onChange: (v: unknown) => void;
}
function ParamField({ paramKey, currentValue, defaultValue, onChange }: ParamFieldProps) {
  const [draft, setDraft] = useState(() => stringify(currentValue));
  useEffect(() => setDraft(stringify(currentValue)), [currentValue]);

  // Boolean
  if (typeof defaultValue === 'boolean') {
    return (
      <Field label={paramKey}>
        <button
          type="button"
          onClick={() => onChange(!currentValue)}
          className={cn(
            'inline-flex h-6 w-10 items-center rounded-full transition-colors',
            currentValue ? 'bg-primary' : 'bg-border',
          )}
        >
          <span
            className={cn(
              'h-5 w-5 rounded-full bg-background shadow transition-transform',
              currentValue ? 'translate-x-[18px]' : 'translate-x-[2px]',
            )}
          />
        </button>
      </Field>
    );
  }

  // Number
  if (typeof defaultValue === 'number') {
    return (
      <Field label={paramKey}>
        <input
          type="number"
          value={String(currentValue ?? '')}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 w-full rounded border bg-background px-2 text-meta text-foreground font-mono"
        />
      </Field>
    );
  }

  // String (default)
  return (
    <Field label={paramKey}>
      <input
        type="text"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        className="h-8 w-full rounded border bg-background px-2 text-meta text-foreground font-mono"
      />
    </Field>
  );
}

function stringify(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
