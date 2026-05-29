/**
 * WorkflowExecutor — mock pipeline cho Phase 3.11.
 *
 * Layer: Service
 * Owner: features/workflow/executor
 *
 * Spec: `docs/features/04-workflow.md §B` (execution model).
 * Reference: `reference-ext/src/core/WorkflowExecutor.js` — topo sort + heartbeat
 * lock. Phase 3 chỉ mock: không gọi provider thật, chỉ delay + placeholder image.
 *
 * - Topological sort (Kahn). Cycle → trả lỗi (theo lý thuyết store đã chặn cycle).
 * - Per-node simulation 500-2000ms (random theo kind).
 * - Generate/ChatGPT/Grok/Gemini → set outputPreview = picsum URL.
 * - Branch / Trigger / Prompt → pass-through.
 * - Failure probability ~5% cho mỗi node để demo error path.
 * - Cancellation: caller hold `RunHandle`, gọi `cancel()` → abort signal +
 *   các node chưa start sẽ status='cancelled'.
 *
 * KHÔNG persist run history vào localStorage — Phase 4 thêm (cùng SSE).
 */

import { useWorkflowStore } from '../store/workflow.store';
import { nanoid } from '@/utils/nanoid';
import type {
  NodeKind,
  WorkflowDocument,
  WorkflowSavedEdge,
  WorkflowSavedNode,
} from '@/types/workflow.types';

export interface RunHandle {
  runId: string;
  /** Promise resolves khi run kết thúc (completed | failed | cancelled). */
  done: Promise<RunResult>;
  cancel: () => void;
}

export interface RunResult {
  runId: string;
  status: 'completed' | 'failed' | 'cancelled';
  /** Node IDs theo thứ tự execute. */
  executed: string[];
  /** Nodes bị skip do upstream fail / cancel. */
  skipped: string[];
  durationMs: number;
}

/* ─── Per-kind simulation profile ─────────────────────────────────────────── */

interface KindProfile {
  /** Min/max delay ms. */
  delay: [number, number];
  /** Có sinh output preview không. */
  producesImage: boolean;
  /** Xác suất fail (0..1). */
  failRate: number;
}

const KIND_PROFILE: Record<NodeKind, KindProfile> = {
  trigger: { delay: [80, 150], producesImage: false, failRate: 0 },
  prompt: { delay: [80, 150], producesImage: false, failRate: 0 },
  generate: { delay: [1200, 2000], producesImage: true, failRate: 0.04 },
  chatgpt: { delay: [900, 1600], producesImage: true, failRate: 0.04 },
  grok: { delay: [900, 1600], producesImage: true, failRate: 0.04 },
  gemini: { delay: [900, 1600], producesImage: true, failRate: 0.04 },
  edit: { delay: [700, 1300], producesImage: true, failRate: 0.05 },
  angles: { delay: [1100, 1800], producesImage: true, failRate: 0.04 },
  effects: { delay: [600, 1100], producesImage: true, failRate: 0.04 },
  download: { delay: [400, 700], producesImage: false, failRate: 0.03 },
  telegram: { delay: [500, 900], producesImage: false, failRate: 0.05 },
  branch: { delay: [120, 220], producesImage: false, failRate: 0 },
  delay: { delay: [0, 0], producesImage: false, failRate: 0 }, // dùng duration_ms từ params
  multi: { delay: [1000, 1800], producesImage: true, failRate: 0.04 },
};

/* ─── Public entry ────────────────────────────────────────────────────────── */

/**
 * Khởi chạy mock run trên document đang mở. Caller giữ `RunHandle` để cancel.
 *
 * KHÔNG nhận document làm arg — đọc trực tiếp từ store để mỗi node update status
 * sẽ ngay lập tức re-render BaseNode. Caller chỉ cần đảm bảo store đã load doc.
 */
export function startMockRun(): RunHandle | null {
  const store = useWorkflowStore.getState();
  const doc = store.current;
  if (!doc) return null;
  if (doc.nodes.length === 0) return null;
  if (store.isRunning) return null;

  const runId = nanoid('run');
  const abort = new AbortController();

  // Reset previous run state + flag running.
  store.resetRunStatuses();
  store.setRunning(true, runId);

  const done = executeWorkflow(doc, abort.signal, runId).then((result) => {
    useWorkflowStore.getState().setRunning(false, null);
    return result;
  });

  return {
    runId,
    done,
    cancel: () => abort.abort(),
  };
}

/**
 * Run đơn 1 node (theo reference-ext "run-node" action). KHÔNG đụng tới
 * upstream/downstream — chỉ execute node được chỉ định. Hữu ích để debug
 * params + xem output preview ngay.
 */
export function runSingleNodeMock(nodeId: string): RunHandle | null {
  const store = useWorkflowStore.getState();
  const doc = store.current;
  if (!doc) return null;
  if (store.isRunning) return null;
  const node = doc.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const runId = nanoid('run');
  const abort = new AbortController();
  store.setNodeStatus(nodeId, 'pending');
  store.setRunning(true, runId);

  const startedAt = Date.now();
  const done = (async (): Promise<RunResult> => {
    try {
      await executeNode(node, abort.signal);
      return {
        runId,
        status: 'completed',
        executed: [nodeId],
        skipped: [],
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      if (abort.signal.aborted) {
        useWorkflowStore.getState().setNodeStatus(nodeId, 'cancelled');
        return {
          runId,
          status: 'cancelled',
          executed: [],
          skipped: [nodeId],
          durationMs: Date.now() - startedAt,
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      useWorkflowStore.getState().setNodeStatus(nodeId, 'failed', message);
      return {
        runId,
        status: 'failed',
        executed: [],
        skipped: [nodeId],
        durationMs: Date.now() - startedAt,
      };
    } finally {
      useWorkflowStore.getState().setRunning(false, null);
    }
  })();

  return { runId, done, cancel: () => abort.abort() };
}

/* ─── Topological sort ────────────────────────────────────────────────────── */

interface ToposortResult {
  order: string[];
  /** Adjacency for downstream lookup: nodeId → downstream node ids. */
  downstream: Map<string, Set<string>>;
}

function topoSort(
  nodes: WorkflowSavedNode[],
  edges: WorkflowSavedEdge[],
): ToposortResult | null {
  const inDegree = new Map<string, number>();
  const downstream = new Map<string, Set<string>>();
  for (const n of nodes) {
    inDegree.set(n.id, 0);
    downstream.set(n.id, new Set());
  }
  for (const e of edges) {
    if (!inDegree.has(e.source) || !inDegree.has(e.target)) continue;
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    downstream.get(e.source)!.add(e.target);
  }
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of downstream.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }
  if (order.length !== nodes.length) return null; // cycle
  return { order, downstream };
}

/* ─── Execution loop ──────────────────────────────────────────────────────── */

async function executeWorkflow(
  doc: WorkflowDocument,
  signal: AbortSignal,
  runId: string,
): Promise<RunResult> {
  const startedAt = Date.now();
  const sorted = topoSort(doc.nodes, doc.edges);
  if (!sorted) {
    console.warn('[executor] cycle detected — aborting', { runId });
    return {
      runId,
      status: 'failed',
      executed: [],
      skipped: doc.nodes.map((n) => n.id),
      durationMs: Date.now() - startedAt,
    };
  }

  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));
  const failed = new Set<string>();
  const executed: string[] = [];
  const skipped: string[] = [];

  // Mark all as pending up front.
  const store = useWorkflowStore.getState();
  for (const id of sorted.order) {
    store.setNodeStatus(id, 'pending');
  }

  for (const id of sorted.order) {
    if (signal.aborted) {
      useWorkflowStore.getState().setNodeStatus(id, 'cancelled');
      skipped.push(id);
      continue;
    }
    // Skip downstream của failed nodes.
    const upstreamFailed = hasFailedUpstream(id, doc.edges, failed);
    if (upstreamFailed) {
      useWorkflowStore.getState().setNodeStatus(id, 'skipped');
      skipped.push(id);
      continue;
    }

    const node = nodeById.get(id)!;
    // Disabled node → skip nhưng KHÔNG fail upstream chain.
    if (node.data.disabled) {
      useWorkflowStore.getState().setNodeStatus(id, 'skipped');
      skipped.push(id);
      continue;
    }
    try {
      await executeNode(node, signal);
      executed.push(id);
    } catch (err) {
      if (signal.aborted) {
        useWorkflowStore.getState().setNodeStatus(id, 'cancelled');
        skipped.push(id);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        useWorkflowStore.getState().setNodeStatus(id, 'failed', message);
        failed.add(id);
      }
    }
  }

  const status: RunResult['status'] = signal.aborted
    ? 'cancelled'
    : failed.size > 0
      ? 'failed'
      : 'completed';

  console.info('[executor] run finished', {
    runId,
    status,
    executed: executed.length,
    failed: failed.size,
    skipped: skipped.length,
    durationMs: Date.now() - startedAt,
  });

  return {
    runId,
    status,
    executed,
    skipped,
    durationMs: Date.now() - startedAt,
  };
}

function hasFailedUpstream(
  id: string,
  edges: WorkflowSavedEdge[],
  failed: Set<string>,
): boolean {
  for (const e of edges) {
    if (e.target !== id) continue;
    if (failed.has(e.source)) return true;
  }
  return false;
}

/* ─── Per-node simulation ─────────────────────────────────────────────────── */

async function executeNode(node: WorkflowSavedNode, signal: AbortSignal): Promise<void> {
  const store = useWorkflowStore.getState();
  store.setNodeStatus(node.id, 'running');

  const profile = KIND_PROFILE[node.kind];

  // Delay node: dùng params.duration_ms thay vì profile.
  let delayMs: number;
  if (node.kind === 'delay') {
    const dur = Number(node.data.params.duration_ms);
    delayMs = Number.isFinite(dur) && dur >= 0 ? dur : 1000;
    // Cap dev tránh chờ quá lâu.
    delayMs = Math.min(delayMs, 5000);
  } else {
    const [min, max] = profile.delay;
    delayMs = Math.round(min + Math.random() * (max - min));
  }

  await sleep(delayMs, signal);

  // Random fail (sau khi chạy xong delay — mô phỏng provider trả lỗi).
  if (profile.failRate > 0 && Math.random() < profile.failRate) {
    throw new Error(`Mock fail: ${node.kind} provider timeout`);
  }

  // Produce output preview cho nodes sinh ảnh.
  if (profile.producesImage) {
    const seed = `${node.id}-${Date.now()}`;
    const url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/240/240`;
    store.setNodeOutput(node.id, url);
  }

  store.setNodeStatus(node.id, 'completed');
}

/* ─── Util ────────────────────────────────────────────────────────────────── */

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) {
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
