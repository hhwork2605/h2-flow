/**
 * workflow.types.ts — Workflow editor + engine domain types.
 *
 * Layer: Types
 * Owner: shared (features/workflow + core executor)
 *
 * Spec: `docs/features/04-workflow.md` + `docs/09-workflow-engine.md`.
 * Behaviour reference: `reference-ext/src/core/WorkflowExecutor.js` +
 * `reference-ext/src/workflow/NodeTemplates.js` (port type system + node kinds).
 */

import type { ProviderSlug, MediaType } from './provider.types';

/* ─── Port types ───────────────────────────────────────────────────────── */

/** 5 port types — màu + icon docs/features/00-design-system.md §port. */
export type PortType = 'text' | 'image' | 'video' | 'frame' | 'any';

export interface PortDef {
  /** Unique within node (vd: "prompt-in", "image-out"). */
  id: string;
  type: PortType;
  /** Hiển thị trên hover (vd: "Văn bản prompt"). */
  label: string;
  /** Cho phép input port nhận nhiều edges hay không. Mặc định: input 1, output unlimited. */
  multiple?: boolean;
}

/**
 * Compatibility matrix: target type → set of acceptable source types.
 *
 * - `any` ↔ tất cả.
 * - `image` ↔ `frame` (coerce — frame là 1 image trong video pipeline).
 * - các loại khác phải khớp.
 *
 * Dùng trong React Flow `isValidConnection` callback.
 */
export const PORT_COMPAT: Record<PortType, PortType[]> = {
  text: ['text', 'any'],
  image: ['image', 'frame', 'any'],
  video: ['video', 'any'],
  frame: ['frame', 'image', 'any'],
  any: ['text', 'image', 'video', 'frame', 'any'],
};

/* ─── Node kinds — 14 loại ─────────────────────────────────────────────── */

export type NodeKind =
  | 'trigger'
  | 'prompt'
  | 'generate'
  | 'download'
  | 'edit'
  | 'telegram'
  | 'branch'
  | 'angles'
  | 'effects'
  | 'delay'
  | 'chatgpt'
  | 'grok'
  | 'gemini'
  | 'multi';

/**
 * Node metadata — render + execute. Một NodeTemplate cho mỗi `kind`.
 */
export interface NodeTemplate {
  kind: NodeKind;
  /** Tên hiển thị tiếng Việt. */
  label: string;
  /** 1 dòng mô tả ngắn. */
  description: string;
  /** Màu accent (cố định, không đổi theo theme) — khớp tokens `node.*`. */
  accent: string;
  /** Tên Lucide icon (tra cứu trong NodePalette để render). */
  iconName: string;
  inputs: PortDef[];
  outputs: PortDef[];
  /** Param schema mặc định khi tạo node mới. */
  defaultParams: Record<string, unknown>;
}

/* ─── Per-instance state ───────────────────────────────────────────────── */

/** Runtime status của 1 node trong 1 run (xem doc 04 §B1). */
export type NodeStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

/**
 * Data payload gắn vào React Flow node. React Flow tự quản lý `id`, `position`,
 * `type`. Phần còn lại đặt vào `data`.
 */
export interface WorkflowNodeData {
  kind: NodeKind;
  /** Tên user đặt (override default label). */
  title?: string;
  /** Param values current. */
  params: Record<string, unknown>;
  /** Runtime status — set bởi executor; ngoài run là 'idle'. */
  status?: NodeStatus;
  /** Error message khi status = 'failed'. */
  errorMessage?: string;
  /** Output preview thumbnail URL (nếu node sinh ảnh). */
  outputPreview?: string;
  /** Disabled = bị executor skip. Mặc định false (=enabled). Toggle qua header switch. */
  disabled?: boolean;
}

/** Toàn bộ workflow document persist vào Dexie / server. */
export interface WorkflowDocument {
  id: string;
  name: string;
  description?: string;
  project_id: string | null;
  /** Phiên bản DB schema cho migration. */
  schema_version: number;
  /** Nodes + edges raw từ React Flow. */
  nodes: WorkflowSavedNode[];
  edges: WorkflowSavedEdge[];
  /** Pan/zoom của canvas. */
  viewport: { x: number; y: number; zoom: number };
  created_at: number;
  updated_at: number;
  /** Sync status local-first. */
  sync_state: 'unsaved' | 'saving' | 'synced' | 'error';
}

export interface WorkflowSavedNode {
  id: string;
  kind: NodeKind;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowSavedEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  /** Port type của source — cache để vẽ màu edge khi load. */
  sourceType: PortType;
}

/* ─── Provider mapping cho Generate node ───────────────────────────────── */

export interface GenerateNodeParams {
  provider: ProviderSlug;
  media_type: MediaType;
  model: string;
  ratio: string;
  quantity: number;
  prompt_input: 'inline' | 'connected';
  inline_prompt?: string;
}

/* ─── Execution run-level ──────────────────────────────────────────────── */

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: number;
  completed_at?: number;
  /** Per-node state snapshot. */
  node_states: Record<string, { status: NodeStatus; error?: string; duration_ms?: number }>;
  /** Output preview URLs nhóm theo nodeId. */
  outputs: Record<string, string[]>;
}
