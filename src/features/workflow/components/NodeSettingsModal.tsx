/**
 * NodeSettingsModal — modal edit params cho 1 node.
 *
 * Layer: UI
 * Owner: features/workflow/components
 *
 * Mở từ event `h2flow:open-node-settings` (dispatch bởi BaseNode hover toolbar
 * Settings button hoặc context menu). Phase 3 chỉ render generic key/value
 * editor (giống NodeInspector cũ). Phase 4 sẽ swap form schema per kind
 * (provider dropdown, model picker, ratio chips…).
 *
 * Tham chiếu: `reference-ext/src/workflow/WorkflowEditor.js` event bus
 * `node:open_settings` → mở `df-node-settings-bar` panel.
 */

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Icons from 'lucide-react';
import { cn } from '@/utils/cn';
import { useWorkflowStore } from '../store/workflow.store';
import { getTemplate } from '../node-types';

const OPEN_EVENT = 'h2flow:open-node-settings';
const CLOSE_EVENT = 'h2flow:close-node-settings';

export function openNodeSettings(nodeId: string): void {
  window.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: nodeId }));
}

export function closeNodeSettings(): void {
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

export function NodeSettingsModal() {
  const [nodeId, setNodeId] = useState<string | null>(null);
  const current = useWorkflowStore((s) => s.current);
  const updateParams = useWorkflowStore((s) => s.updateNodeParams);
  const updateTitle = useWorkflowStore((s) => s.updateNodeTitle);
  const removeNodes = useWorkflowStore((s) => s.removeNodes);
  const toggleEnabled = useWorkflowStore((s) => s.toggleNodeEnabled);

  useEffect(() => {
    function onOpen(evt: Event) {
      const ce = evt as CustomEvent<string>;
      setNodeId(ce.detail);
    }
    function onClose() {
      setNodeId(null);
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
    };
  }, []);

  const node = current?.nodes.find((n) => n.id === nodeId) ?? null;
  const open = !!node;
  const tpl = node ? getTemplate(node.kind) : null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) setNodeId(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-[9000] bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-[fadeIn_0.18s_ease-out]',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[9001] -translate-x-1/2 -translate-y-1/2',
            'w-[440px] max-w-[92vw] rounded-xl border border-white/10 bg-[#15151c]',
            'shadow-card-dark',
            'data-[state=open]:animate-[scaleIn_0.18s_ease-out]',
          )}
        >
          {node && tpl && (
            <>
              <header className="flex items-center gap-2.5 border-b border-white/5 px-4 py-3">
                <span
                  className="grid h-7 w-7 place-items-center rounded text-white"
                  style={{ background: tpl.accent }}
                >
                  <span className="text-[11px] font-bold uppercase">{node.kind[0]}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-eyebrow uppercase tracking-[0.12em] text-muted-foreground">
                    Cài đặt node
                  </p>
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {node.data.title || tpl.label}
                  </p>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Đóng"
                    className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    <Icons.X className="h-3.5 w-3.5" />
                  </button>
                </Dialog.Close>
              </header>

              <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
                <Field label="Tên hiển thị">
                  <input
                    type="text"
                    value={node.data.title ?? ''}
                    placeholder={tpl.label}
                    onChange={(e) => updateTitle(node.id, e.target.value)}
                    className="h-9 w-full rounded border border-white/10 bg-black/40 px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60"
                  />
                </Field>

                <div className="my-3 flex items-center justify-between rounded border border-white/5 bg-white/[0.02] px-3 py-2.5">
                  <div>
                    <p className="text-[12.5px] font-medium text-foreground">
                      {node.data.disabled ? 'Đang tắt' : 'Đang bật'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Khi tắt, node sẽ bị executor skip.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!node.data.disabled}
                    onClick={() => toggleEnabled(node.id)}
                    className={cn(
                      'inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                      !node.data.disabled ? 'bg-success' : 'bg-white/15',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                        !node.data.disabled ? 'translate-x-[18px]' : 'translate-x-[2px]',
                      )}
                    />
                  </button>
                </div>

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
              </div>

              <footer className="flex items-center justify-between border-t border-white/5 bg-black/20 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    removeNodes([node.id]);
                    setNodeId(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-destructive hover:bg-destructive/10"
                >
                  <Icons.Trash2 className="h-3 w-3" />
                  Xoá node
                </button>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {tpl.inputs.length} in / {tpl.outputs.length} out · {node.id}
                </span>
              </footer>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}
function Field({ label, children }: FieldProps) {
  return (
    <label className="mb-3 flex flex-col gap-1">
      <span className="text-eyebrow uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
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
  // Boolean
  if (typeof defaultValue === 'boolean') {
    return (
      <Field label={paramKey}>
        <button
          type="button"
          role="switch"
          aria-checked={!!currentValue}
          onClick={() => onChange(!currentValue)}
          className={cn(
            'inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
            currentValue ? 'bg-primary' : 'bg-white/15',
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
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
          className="h-9 w-full rounded border border-white/10 bg-black/40 px-2.5 font-mono text-[13px] text-foreground"
        />
      </Field>
    );
  }

  // String (default) — multi-line khi key chứa "prompt" / "text" / "expression".
  const isMultiline = /prompt|text|expression|template/.test(paramKey);
  return (
    <Field label={paramKey}>
      {isMultiline ? (
        <textarea
          value={String(currentValue ?? '')}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded border border-white/10 bg-black/40 px-2.5 py-2 text-[13px] text-foreground resize-y"
        />
      ) : (
        <input
          type="text"
          value={String(currentValue ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded border border-white/10 bg-black/40 px-2.5 font-mono text-[13px] text-foreground"
        />
      )}
    </Field>
  );
}
