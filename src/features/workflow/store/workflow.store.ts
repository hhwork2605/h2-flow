/**
 * workflow.store.ts — Active workflow editor state.
 *
 * Layer: State
 * Owner: features/workflow/store
 *
 * Spec: `docs/features/04-workflow.md §A` (editor) + `docs/09-workflow-engine.md`.
 *
 * Holds 1 active workflow ở editor + undo/redo stack. List of workflows + Dexie
 * autosave sống ở module riêng (`features/workflow/persistence.ts` — P3 sau).
 *
 * Snapshot strategy: 50 snapshots max, debounce 400ms ở caller side để gom
 * combo drag + edit title vào cùng 1 snapshot.
 */

import { create } from 'zustand';
import { nanoid } from '@/utils/nanoid';
import {
  type WorkflowDocument,
  type WorkflowSavedNode,
  type WorkflowSavedEdge,
  type NodeKind,
  type NodeStatus,
  type PortType,
  PORT_COMPAT,
} from '@/types/workflow.types';
import { NODE_TEMPLATES } from '../node-types';

const MAX_HISTORY = 50;
const SCHEMA_VERSION = 1;

interface HistorySnapshot {
  nodes: WorkflowSavedNode[];
  edges: WorkflowSavedEdge[];
}

export type AddEdgeResult =
  | { ok: true; edgeId: string }
  | { ok: false; reason: 'incompatible' | 'cycle' | 'duplicate' | 'no-workflow' };

interface WorkflowState {
  /** Đang mở workflow nào (null = chưa mở). */
  current: WorkflowDocument | null;

  /** Undo / redo stacks. Top = state hiện tại không nằm trong stack. */
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  /** Pointer-drag từ palette: kind đang kéo + position chuột hiện tại (viewport). */
  draggingKind: NodeKind | null;
  draggingPos: { x: number; y: number } | null;
  setDragging: (kind: NodeKind | null, pos?: { x: number; y: number } | null) => void;

  /** Run state — set bởi WorkflowExecutor. */
  isRunning: boolean;
  currentRunId: string | null;
  setRunning: (running: boolean, runId?: string | null) => void;

  /* Actions — không async, không network. */
  load: (doc: WorkflowDocument) => void;
  close: () => void;
  newWorkflow: (project_id: string | null) => void;

  rename: (name: string) => void;
  setSyncState: (state: WorkflowDocument['sync_state']) => void;

  /** Thêm node mới từ template tại vị trí position. */
  addNode: (kind: NodeKind, position: { x: number; y: number }) => string;
  removeNodes: (ids: string[]) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  updateNodeParams: (id: string, params: Record<string, unknown>) => void;
  updateNodeTitle: (id: string, title: string) => void;

  /** Duplicate node(s) — clone với offset (+40,+40), tạo id mới, KHÔNG copy edges. */
  duplicateNodes: (ids: string[]) => string[];

  /** Toggle `data.disabled` flag. Disabled node sẽ bị executor skip. */
  toggleNodeEnabled: (id: string) => void;

  /**
   * Tạo node mới downstream của source (theo reference-ext "branch" action).
   * Mặc định kind='prompt' — caller có thể override. Tự nối edge từ output đầu
   * tiên của source → input đầu tiên của new node nếu compatible. Position:
   * bên phải source với offset (+320, 0).
   */
  branchFromNode: (sourceId: string, targetKind?: NodeKind) => string | null;

  /* Runtime status — KHÔNG push history snapshot (transient). */
  setNodeStatus: (id: string, status: NodeStatus, errorMessage?: string) => void;
  setNodeOutput: (id: string, outputPreview: string | undefined) => void;
  resetRunStatuses: () => void;

  /**
   * Thêm edge mới. Tự validate `PORT_COMPAT`. Trả discriminated result để
   * caller phân biệt lý do reject mà show toast tương ứng.
   */
  addEdge: (params: {
    source: string;
    sourceHandle: string;
    sourceType: PortType;
    target: string;
    targetHandle: string;
    targetType: PortType;
  }) => AddEdgeResult;
  removeEdges: (ids: string[]) => void;

  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;

  /* History. */
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function snapshotOf(doc: WorkflowDocument | null): HistorySnapshot {
  return {
    nodes: doc ? structuredClone(doc.nodes) : [],
    edges: doc ? structuredClone(doc.edges) : [],
  };
}

function applySnapshot(doc: WorkflowDocument, snap: HistorySnapshot): WorkflowDocument {
  return {
    ...doc,
    nodes: structuredClone(snap.nodes),
    edges: structuredClone(snap.edges),
    sync_state: 'unsaved',
    updated_at: Date.now(),
  };
}

/** Tạo workflow rỗng mới. */
function makeEmptyWorkflow(project_id: string | null): WorkflowDocument {
  return {
    id: nanoid('wf'),
    name: 'Workflow chưa đặt tên',
    description: '',
    project_id,
    schema_version: SCHEMA_VERSION,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    created_at: Date.now(),
    updated_at: Date.now(),
    sync_state: 'unsaved',
  };
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  current: null,
  past: [],
  future: [],

  draggingKind: null,
  draggingPos: null,
  setDragging: (kind, pos) => set({ draggingKind: kind, draggingPos: pos ?? null }),

  isRunning: false,
  currentRunId: null,
  setRunning: (running, runId = null) =>
    set({ isRunning: running, currentRunId: running ? runId : null }),

  load: (doc) =>
    set({
      current: doc,
      past: [],
      future: [],
    }),

  close: () => set({ current: null, past: [], future: [] }),

  newWorkflow: (project_id) =>
    set({
      current: makeEmptyWorkflow(project_id),
      past: [],
      future: [],
    }),

  rename: (name) =>
    set((s) =>
      s.current
        ? { current: { ...s.current, name, sync_state: 'unsaved', updated_at: Date.now() } }
        : s,
    ),

  setSyncState: (state) =>
    set((s) => (s.current ? { current: { ...s.current, sync_state: state } } : s)),

  addNode: (kind, position) => {
    const template = NODE_TEMPLATES[kind];
    const id = nanoid('n');
    set((s) => {
      if (!s.current) return s;
      const node: WorkflowSavedNode = {
        id,
        kind,
        position,
        data: {
          kind,
          params: structuredClone(template.defaultParams),
          status: 'idle',
        },
      };
      return {
        past: [...s.past, snapshotOf(s.current)].slice(-MAX_HISTORY),
        future: [],
        current: {
          ...s.current,
          nodes: [...s.current.nodes, node],
          sync_state: 'unsaved',
          updated_at: Date.now(),
        },
      };
    });
    return id;
  },

  removeNodes: (ids) =>
    set((s) => {
      if (!s.current) return s;
      const idSet = new Set(ids);
      return {
        past: [...s.past, snapshotOf(s.current)].slice(-MAX_HISTORY),
        future: [],
        current: {
          ...s.current,
          nodes: s.current.nodes.filter((n) => !idSet.has(n.id)),
          edges: s.current.edges.filter(
            (e) => !idSet.has(e.source) && !idSet.has(e.target),
          ),
          sync_state: 'unsaved',
          updated_at: Date.now(),
        },
      };
    }),

  updateNodePosition: (id, position) =>
    set((s) => {
      if (!s.current) return s;
      return {
        current: {
          ...s.current,
          nodes: s.current.nodes.map((n) =>
            n.id === id ? { ...n, position } : n,
          ),
          sync_state: 'unsaved',
          updated_at: Date.now(),
        },
      };
    }),

  updateNodeParams: (id, params) =>
    set((s) => {
      if (!s.current) return s;
      return {
        past: [...s.past, snapshotOf(s.current)].slice(-MAX_HISTORY),
        future: [],
        current: {
          ...s.current,
          nodes: s.current.nodes.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, params: { ...n.data.params, ...params } } }
              : n,
          ),
          sync_state: 'unsaved',
          updated_at: Date.now(),
        },
      };
    }),

  updateNodeTitle: (id, title) =>
    set((s) => {
      if (!s.current) return s;
      return {
        past: [...s.past, snapshotOf(s.current)].slice(-MAX_HISTORY),
        future: [],
        current: {
          ...s.current,
          nodes: s.current.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, title } } : n,
          ),
          sync_state: 'unsaved',
          updated_at: Date.now(),
        },
      };
    }),

  toggleNodeEnabled: (id) =>
    set((s) => {
      if (!s.current) return s;
      return {
        past: [...s.past, snapshotOf(s.current)].slice(-MAX_HISTORY),
        future: [],
        current: {
          ...s.current,
          nodes: s.current.nodes.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, disabled: !n.data.disabled } }
              : n,
          ),
          sync_state: 'unsaved',
          updated_at: Date.now(),
        },
      };
    }),

  branchFromNode: (sourceId, targetKind = 'prompt') => {
    const state = get();
    if (!state.current) return null;
    const source = state.current.nodes.find((n) => n.id === sourceId);
    if (!source) return null;
    const sourceTemplate = NODE_TEMPLATES[source.kind];
    const sourceOut = sourceTemplate.outputs[0];
    const targetTemplate = NODE_TEMPLATES[targetKind];
    const targetIn = targetTemplate.inputs[0];

    // Create downstream node với offset (+320, 0) — đủ rộng để hiển thị edge.
    const newNodeId = nanoid('n');
    const newPosition = { x: source.position.x + 320, y: source.position.y };
    set((s) => {
      if (!s.current) return s;
      const newNode: WorkflowSavedNode = {
        id: newNodeId,
        kind: targetKind,
        position: newPosition,
        data: {
          kind: targetKind,
          params: structuredClone(targetTemplate.defaultParams),
          status: 'idle',
        },
      };
      // Try wire edge nếu compatible.
      const edges = [...s.current.edges];
      if (sourceOut && targetIn && PORT_COMPAT[targetIn.type].includes(sourceOut.type)) {
        edges.push({
          id: nanoid('e'),
          source: sourceId,
          sourceHandle: sourceOut.id,
          target: newNodeId,
          targetHandle: targetIn.id,
          sourceType: sourceOut.type,
        });
      }
      return {
        past: [...s.past, snapshotOf(s.current)].slice(-MAX_HISTORY),
        future: [],
        current: {
          ...s.current,
          nodes: [...s.current.nodes, newNode],
          edges,
          sync_state: 'unsaved',
          updated_at: Date.now(),
        },
      };
    });
    return newNodeId;
  },

  duplicateNodes: (ids) => {
    const newIds: string[] = [];
    set((s) => {
      if (!s.current) return s;
      const idSet = new Set(ids);
      const toClone = s.current.nodes.filter((n) => idSet.has(n.id));
      if (toClone.length === 0) return s;
      const clones: WorkflowSavedNode[] = toClone.map((n) => {
        const newId = nanoid('n');
        newIds.push(newId);
        return {
          id: newId,
          kind: n.kind,
          position: { x: n.position.x + 40, y: n.position.y + 40 },
          data: {
            ...structuredClone(n.data),
            // Reset runtime status — clone là node "mới".
            status: 'idle',
            errorMessage: undefined,
            outputPreview: undefined,
          },
        };
      });
      return {
        past: [...s.past, snapshotOf(s.current)].slice(-MAX_HISTORY),
        future: [],
        current: {
          ...s.current,
          nodes: [...s.current.nodes, ...clones],
          sync_state: 'unsaved',
          updated_at: Date.now(),
        },
      };
    });
    return newIds;
  },

  /* ─── Runtime status (no history) ─── */

  setNodeStatus: (id, status, errorMessage) =>
    set((s) => {
      if (!s.current) return s;
      return {
        current: {
          ...s.current,
          nodes: s.current.nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    status,
                    errorMessage: status === 'failed' ? errorMessage : undefined,
                  },
                }
              : n,
          ),
        },
      };
    }),

  setNodeOutput: (id, outputPreview) =>
    set((s) => {
      if (!s.current) return s;
      return {
        current: {
          ...s.current,
          nodes: s.current.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, outputPreview } } : n,
          ),
        },
      };
    }),

  resetRunStatuses: () =>
    set((s) => {
      if (!s.current) return s;
      return {
        current: {
          ...s.current,
          nodes: s.current.nodes.map((n) => ({
            ...n,
            data: {
              ...n.data,
              status: 'idle',
              errorMessage: undefined,
              // Giữ outputPreview để user xem kết quả run trước. resetOutputs() riêng nếu cần.
            },
          })),
        },
      };
    }),

  addEdge: ({ source, sourceHandle, sourceType, target, targetHandle, targetType }) => {
    const state = get();
    if (!state.current) return { ok: false, reason: 'no-workflow' };

    // Validate compatibility.
    const accepted = PORT_COMPAT[targetType] ?? [];
    if (!accepted.includes(sourceType)) return { ok: false, reason: 'incompatible' };

    // Prevent duplicate edge between same handles.
    const exists = state.current.edges.some(
      (e) =>
        e.source === source &&
        e.sourceHandle === sourceHandle &&
        e.target === target &&
        e.targetHandle === targetHandle,
    );
    if (exists) return { ok: false, reason: 'duplicate' };

    // Cycle check.
    if (createsCycle(state.current.edges, source, target)) {
      return { ok: false, reason: 'cycle' };
    }

    const edgeId = nanoid('e');
    set((s) => {
      if (!s.current) return s;
      const edge: WorkflowSavedEdge = {
        id: edgeId,
        source,
        sourceHandle,
        target,
        targetHandle,
        sourceType,
      };
      return {
        past: [...s.past, snapshotOf(s.current)].slice(-MAX_HISTORY),
        future: [],
        current: {
          ...s.current,
          edges: [...s.current.edges, edge],
          sync_state: 'unsaved',
          updated_at: Date.now(),
        },
      };
    });
    return { ok: true, edgeId };
  },

  removeEdges: (ids) =>
    set((s) => {
      if (!s.current) return s;
      const idSet = new Set(ids);
      return {
        past: [...s.past, snapshotOf(s.current)].slice(-MAX_HISTORY),
        future: [],
        current: {
          ...s.current,
          edges: s.current.edges.filter((e) => !idSet.has(e.id)),
          sync_state: 'unsaved',
          updated_at: Date.now(),
        },
      };
    }),

  setViewport: (viewport) =>
    set((s) => (s.current ? { current: { ...s.current, viewport } } : s)),

  pushSnapshot: () =>
    set((s) =>
      s.current
        ? {
            past: [...s.past, snapshotOf(s.current)].slice(-MAX_HISTORY),
            future: [],
          }
        : s,
    ),

  undo: () =>
    set((s) => {
      if (!s.current || s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1]!;
      const remaining = s.past.slice(0, -1);
      return {
        current: applySnapshot(s.current, previous),
        past: remaining,
        future: [snapshotOf(s.current), ...s.future].slice(0, MAX_HISTORY),
      };
    }),

  redo: () =>
    set((s) => {
      if (!s.current || s.future.length === 0) return s;
      const next = s.future[0]!;
      return {
        current: applySnapshot(s.current, next),
        past: [...s.past, snapshotOf(s.current)].slice(-MAX_HISTORY),
        future: s.future.slice(1),
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));

/* ─── Helpers ─────────────────────────────────────────────────────────── */

/** Trả true nếu thêm edge `source → target` sẽ tạo cycle. */
function createsCycle(
  edges: WorkflowSavedEdge[],
  source: string,
  target: string,
): boolean {
  if (source === target) return true;
  // BFS từ target để xem có thể về source không.
  const visited = new Set<string>([target]);
  const queue: string[] = [target];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (e.source !== cur) continue;
      if (e.target === source) return true;
      if (!visited.has(e.target)) {
        visited.add(e.target);
        queue.push(e.target);
      }
    }
  }
  return false;
}
