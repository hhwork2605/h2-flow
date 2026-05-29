/**
 * DiagramCanvas — React Flow wrapper với typed connection validation.
 *
 * Layer: UI
 * Owner: features/workflow/components
 *
 * - Đọc state từ `useWorkflowStore` (nodes + edges + viewport).
 * - Sync React Flow changes về store (position drag, edge connect, delete).
 * - Validate connection trước khi commit (PORT_COMPAT + cycle).
 * - Drag-drop từ palette: nhận `h2flow:drop` CustomEvent (pointer-based,
 *   xem `NodePalette.tsx` — không dùng HTML5 dataTransfer).
 *
 * Spec: docs/features/04-workflow.md §A2-A3 + §D1 (port type system).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  useReactFlow,
  useStore as useReactFlowStore,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { cn } from '@/utils/cn';
import { useWorkflowStore } from '../store/workflow.store';
import { BaseNode } from './BaseNode';
import { CanvasBottomBar } from './CanvasBottomBar';
import { NodeContextMenu } from './NodeContextMenu';
import { showToast } from '@/ui/components/Toast';
import { useEntitlements } from '@/core/useEntitlements';
import type { NodeKind, PortType, WorkflowNodeData } from '@/types/workflow.types';

const PLAN_LABEL: Record<string, string> = {
  free: 'FREE',
  trial: 'TRIAL',
  pro: 'PRO',
  team: 'TEAM',
};

const PLAN_BADGE_STYLE: Record<string, string> = {
  free: 'bg-white/10 text-muted-foreground',
  trial: 'bg-warning/20 text-warning',
  pro: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white',
  team: 'bg-primary/30 text-primary',
};

const NODE_TYPES: NodeTypes = {
  base: BaseNode,
};

const PORT_COLOR: Record<PortType, string> = {
  text: '#9177e1',
  image: '#3b82f6',
  video: '#a855f7',
  frame: '#14b8a6',
  any: '#71717a',
};

const REJECT_MESSAGE: Record<
  'incompatible' | 'cycle' | 'duplicate' | 'no-workflow',
  { title: string; message?: string; variant: 'error' | 'warn' }
> = {
  incompatible: {
    title: 'Loại port không khớp',
    message: 'Output và input phải cùng kiểu (text/image/video/frame).',
    variant: 'error',
  },
  cycle: {
    title: 'Sẽ tạo vòng lặp',
    message: 'Không thể nối nếu target là ancestor của source.',
    variant: 'error',
  },
  duplicate: {
    title: 'Đã có kết nối',
    message: 'Hai handle này đã nối với nhau.',
    variant: 'warn',
  },
  'no-workflow': { title: 'Chưa có workflow', variant: 'warn' },
};

/**
 * QUAN TRỌNG: component này phải nằm trong `<ReactFlowProvider>` (do
 * `WorkflowEditor.tsx` wrap). Lý do: NodeInspector cũng đọc state React Flow,
 * cần share cùng 1 provider.
 */
export function DiagramCanvas() {
  const current = useWorkflowStore((s) => s.current);
  const addNodeAt = useWorkflowStore((s) => s.addNode);
  const removeNodes = useWorkflowStore((s) => s.removeNodes);
  const removeEdges = useWorkflowStore((s) => s.removeEdges);
  const updatePosition = useWorkflowStore((s) => s.updateNodePosition);
  const addEdgeAction = useWorkflowStore((s) => s.addEdge);
  const setViewport = useWorkflowStore((s) => s.setViewport);
  const duplicateNodes = useWorkflowStore((s) => s.duplicateNodes);

  // Selected node ids — track from React Flow internal store.
  const selectedIds = useReactFlowStore((s) =>
    Array.from(s.nodeInternals.values())
      .filter((n) => n.selected)
      .map((n) => n.id),
  );

  const wrapperRef = useRef<HTMLDivElement>(null);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const draggingKind = useWorkflowStore((s) => s.draggingKind);
  const draggingPos = useWorkflowStore((s) => s.draggingPos);

  // Right-click context menu state.
  const [ctxMenu, setCtxMenu] = useState<{ nodeId: string; x: number; y: number } | null>(
    null,
  );

  // Plan badge — đọc từ entitlements query (refetch khi auth thay đổi).
  const entitlements = useEntitlements();
  const plan = entitlements.data?.plan ?? 'free';

  // Drag-over highlight = đang drag + chuột nằm trong wrapper bounds.
  const dragOver = useMemo(() => {
    if (!draggingKind || !draggingPos || !wrapperRef.current) return false;
    const r = wrapperRef.current.getBoundingClientRect();
    return (
      draggingPos.x >= r.left &&
      draggingPos.x <= r.right &&
      draggingPos.y >= r.top &&
      draggingPos.y <= r.bottom
    );
  }, [draggingKind, draggingPos]);

  // Ctrl+D duplicate selected nodes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key !== 'd' && e.key !== 'D') return;
      // Don't hijack if user is typing in an input/textarea.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (selectedIds.length === 0) return;
      e.preventDefault();
      const newIds = duplicateNodes(selectedIds);
      if (newIds.length > 0) {
        showToast({
          title: `Nhân bản ${newIds.length} node`,
          variant: 'success',
          durationMs: 1800,
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duplicateNodes, selectedIds]);

  // Listen 'h2flow:drop' fired bởi NodePalette khi pointerup.
  useEffect(() => {
    function onCustomDrop(evt: Event) {
      const ce = evt as CustomEvent<{ kind: NodeKind; x: number; y: number }>;
      if (!wrapperRef.current) return;
      const r = wrapperRef.current.getBoundingClientRect();
      const { kind, x, y } = ce.detail;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) {
        console.info('[workflow] drop outside canvas — ignored');
        return;
      }
      const position = screenToFlowPosition({ x, y });
      console.info('[workflow] addNode', kind, position);
      addNodeAt(kind, position);
    }
    window.addEventListener('h2flow:drop', onCustomDrop);
    return () => window.removeEventListener('h2flow:drop', onCustomDrop);
  }, [addNodeAt, screenToFlowPosition]);

  /* ─── Derive React Flow data from store ─── */

  const rfNodes: Node<WorkflowNodeData>[] = useMemo(() => {
    if (!current) return [];
    return current.nodes.map((n) => ({
      id: n.id,
      type: 'base',
      position: n.position,
      data: n.data,
    }));
  }, [current]);

  const rfEdges: Edge[] = useMemo(() => {
    if (!current) return [];
    return current.edges.map((e) => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle,
      animated: true,
      style: {
        stroke: PORT_COLOR[e.sourceType],
        strokeWidth: 2.5,
        strokeDasharray: '6 4',
        filter: `drop-shadow(0 0 6px ${PORT_COLOR[e.sourceType]}80)`,
      },
    }));
  }, [current]);

  /* ─── Handle changes ─── */

  /**
   * onNodesChange — phải apply position update mỗi frame (kể cả `c.dragging=true`)
   * để node visually di chuyển. React Flow controlled mode = parent là source of
   * truth: nếu không gửi position mới về nodes prop, RF sẽ render lại node ở
   * vị trí cũ → node "snap back" / "không di chuyển".
   *
   * Trade-off: store update 60fps khi drag. `updateNodePosition` action KHÔNG push
   * history snapshot → chỉ là set state. Auto-save subscription debounce 1s →
   * save thực sự chỉ xảy ra sau khi user thả chuột.
   */
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position) {
          updatePosition(c.id, c.position);
        } else if (c.type === 'remove') {
          removeNodes([c.id]);
        }
      }
    },
    [removeNodes, updatePosition],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const c of changes) {
        if (c.type === 'remove') {
          removeEdges([c.id]);
        }
      }
    },
    [removeEdges],
  );

  /**
   * isValidConnection: gọi liên tục khi user kéo cable — dùng để show ✓ / ✗.
   * Đọc `data-port-type` attribute trên handle (set bởi BaseNode).
   */
  const isValidConnection = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return false;
      if (!connection.sourceHandle || !connection.targetHandle) return false;
      if (connection.source === connection.target) return false;
      // Compatibility check delegated to onConnect (PORT_COMPAT trong store).
      // Ở đây chỉ check shape — chi tiết type compare ở store.
      return true;
    },
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (!connection.sourceHandle || !connection.targetHandle) return;

      // Resolve port types từ DOM (handle data-port-type).
      const sourceType = resolvePortType(connection.source, connection.sourceHandle);
      const targetType = resolvePortType(connection.target, connection.targetHandle);
      if (!sourceType || !targetType) return;

      const result = addEdgeAction({
        source: connection.source,
        sourceHandle: connection.sourceHandle,
        sourceType,
        target: connection.target,
        targetHandle: connection.targetHandle,
        targetType,
      });
      if (!result.ok) {
        const msg = REJECT_MESSAGE[result.reason];
        showToast({ title: msg.title, message: msg.message, variant: msg.variant });
        console.warn('[workflow] connection rejected', {
          reason: result.reason,
          sourceType,
          targetType,
        });
      }
    },
    [addEdgeAction],
  );

  const onMoveEnd = useCallback(
    (_evt: unknown, viewport: { x: number; y: number; zoom: number }) => {
      setViewport(viewport);
    },
    [setViewport],
  );

  const onNodeContextMenu = useCallback(
    (evt: React.MouseEvent, node: Node) => {
      evt.preventDefault();
      setCtxMenu({ nodeId: node.id, x: evt.clientX, y: evt.clientY });
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setCtxMenu(null);
  }, []);

  const onPaneContextMenu = useCallback((evt: React.MouseEvent) => {
    evt.preventDefault();
    setCtxMenu(null);
  }, []);

  // (Đã thay HTML5 drag-and-drop bằng pointer-based — xem useEffect trên + NodePalette).

  /* ─── Render ─── */

  if (!current) {
    return (
      <div className="grid h-full place-items-center text-meta text-muted-foreground">
        Chưa có workflow nào mở.
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'relative h-full w-full bg-[#0c0c10] transition-colors',
        dragOver && 'ring-2 ring-inset ring-primary/40',
      )}
    >
      {/* Brand badge top-left */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#15151c]/80 px-2.5 py-1 shadow-card-dark backdrop-blur">
        <span className="grid h-5 w-5 place-items-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
          h2
        </span>
        <span className="font-display text-[13px] italic text-foreground">h2-flow</span>
        <span
          className={cn(
            'rounded px-1 text-[9px] font-bold uppercase tracking-wider',
            PLAN_BADGE_STYLE[plan] ?? PLAN_BADGE_STYLE.free,
          )}
        >
          {PLAN_LABEL[plan] ?? plan.toUpperCase()}
        </span>
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        isValidConnection={isValidConnection}
        onMoveEnd={onMoveEnd}
        onInit={(inst) => {
          rfInstance.current = inst;
        }}
        proOptions={{ hideAttribution: true }}
        // KHÔNG dùng fitView — RF auto-zoom sẽ override defaultViewport.zoom=1
        // và chỉnh zoom theo bbox của nodes (~0.7-0.85). User: muốn mở mặc định
        // 100%. Caller có thể fitView qua nút "Căn giữa" / side toolbar "Fit view".
        // Fallback `{0,0,1}` để chống doc cũ thiếu field viewport.
        defaultViewport={current.viewport ?? { x: 0, y: 0, zoom: 1 }}
        deleteKeyCode={['Backspace', 'Delete']}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.06)"
        />
        <CanvasBottomBar />
      </ReactFlow>

      {ctxMenu && (
        <NodeContextMenu
          nodeId={ctxMenu.nodeId}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

/** Đọc `data-port-type` attribute của handle DOM. */
function resolvePortType(nodeId: string, handleId: string): PortType | null {
  const el = document.querySelector(
    `[data-id="${nodeId}"] [data-handleid="${handleId}"]`,
  ) as HTMLElement | null;
  const type = el?.getAttribute('data-port-type');
  if (!type) return null;
  return type as PortType;
}
