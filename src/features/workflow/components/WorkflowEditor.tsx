/**
 * WorkflowEditor — top-level editor shell, TobyFlow-style.
 *
 * Layout:
 *   ┌────────────────────────────────────────────────┐
 *   │  EditorToolbar (name + counters + Đóng + Tạo) │
 *   ├──┬─────────────────────────────────────────────┤
 *   │↕ │  DiagramCanvas (free-flow, dark)           │
 *   │  │                                             │
 *   └──┴─────────────────────────────────────────────┘
 *   ↕ = EditorSideToolbar: +/▶/↶/↷/📄/⊡/⚙
 *   "+" mở NodePalettePopover (floating sheet).
 *   NodeInspector ẩn — node settings access qua action toolbar trên node.
 */

import { useEffect, useRef } from 'react';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import { useWorkflowStore } from '../store/workflow.store';
import { DiagramCanvas } from './DiagramCanvas';
import { EditorSideToolbar } from './EditorSideToolbar';
import { EditorToolbar } from './EditorToolbar';
import { loadWorkflow, saveWorkflow, subscribeToWorkflowDeleted } from '../persistence';
import { startMockRun, type RunHandle } from '../executor/WorkflowExecutor';
import { NodeSettingsModal } from './NodeSettingsModal';
import { showToast, ToastViewport } from '@/ui/components/Toast';
import { ConfirmDialogViewport } from '@/ui/components/ConfirmDialog';

interface Props {
  workflowId?: string;
}

export function WorkflowEditor({ workflowId }: Props) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner workflowId={workflowId} />
    </ReactFlowProvider>
  );
}

function WorkflowEditorInner({ workflowId }: Props) {
  const current = useWorkflowStore((s) => s.current);
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);
  const load = useWorkflowStore((s) => s.load);
  const setSyncState = useWorkflowStore((s) => s.setSyncState);
  const isRunning = useWorkflowStore((s) => s.isRunning);
  const { fitView } = useReactFlow();
  const runHandleRef = useRef<RunHandle | null>(null);
  /** Auto-save debounce timer — declare TRƯỚC các effect tham chiếu nó. */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bootstrap (async vì Dexie)
  useEffect(() => {
    if (current) return;
    let cancelled = false;
    (async () => {
      if (workflowId && workflowId !== 'new') {
        const doc = await loadWorkflow(workflowId);
        if (cancelled) return;
        if (doc) {
          load(doc);
          return;
        }
      }
      if (cancelled) return;
      newWorkflow(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [current, workflowId, load, newWorkflow]);

  /**
   * Listen broadcast `workflow-deleted` — nếu workflow đang mở bị xoá (từ
   * sidebar list HOẶC tab editor khác cùng id), CANCEL pending auto-save
   * trước rồi đóng tab. Skip auto-save khác đè data đã xoá.
   */
  useEffect(() => {
    const unsub = subscribeToWorkflowDeleted((deletedId) => {
      const cur = useWorkflowStore.getState().current;
      if (!cur || cur.id !== deletedId) return;
      // Huỷ debounce save đang pending để không resurrect doc đã xoá.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      // Đánh dấu synced để effect autosave không kick off.
      setSyncState('synced');
      // Đóng tab. Chỉ work nếu tab được tạo qua script (chrome.windows.create).
      // Browser thường sẽ block window.close() từ user-opened tab.
      window.close();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSyncState]);

  // Auto-save debounce 1s
  useEffect(() => {
    return useWorkflowStore.subscribe((state, prev) => {
      const cur = state.current;
      const prevCur = prev.current;
      if (!cur || !prevCur) return;
      if (cur.updated_at === prevCur.updated_at) return;
      if (cur.sync_state === 'synced') return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const fresh = useWorkflowStore.getState().current;
        if (!fresh) return;
        // Fire-and-forget — toast on error nếu cần (chưa cần ở Phase 3).
        void saveWorkflow({ ...fresh, sync_state: 'synced' });
        setSyncState('synced');
      }, 1000);
    });
  }, [setSyncState]);

  function handleSave() {
    const fresh = useWorkflowStore.getState().current;
    if (!fresh) return;
    void saveWorkflow({ ...fresh, sync_state: 'synced' });
    setSyncState('synced');
  }

  function handleRun() {
    if (runHandleRef.current) return;
    const cur = useWorkflowStore.getState().current;
    if (!cur || cur.nodes.length === 0) {
      showToast({
        title: 'Chưa có node nào',
        message: 'Kéo node từ palette vào canvas trước khi chạy.',
        variant: 'warn',
      });
      return;
    }
    const handle = startMockRun();
    if (!handle) {
      showToast({ title: 'Không khởi chạy được', variant: 'error' });
      return;
    }
    runHandleRef.current = handle;
    showToast({ title: 'Bắt đầu chạy', message: 'Mô phỏng pipeline…', variant: 'info' });
    handle.done.then((result) => {
      runHandleRef.current = null;
      if (result.status === 'completed') {
        showToast({
          title: 'Hoàn tất',
          message: `${result.executed.length} node • ${(result.durationMs / 1000).toFixed(1)}s`,
          variant: 'success',
        });
      } else if (result.status === 'failed') {
        showToast({
          title: 'Run thất bại',
          message: `${result.skipped.length} node bị skip do upstream lỗi`,
          variant: 'error',
        });
      } else {
        showToast({ title: 'Đã dừng', variant: 'warn' });
      }
    });
  }

  function handleStop() {
    runHandleRef.current?.cancel();
  }

  function handleFitView() {
    fitView({ duration: 250, padding: 0.2 });
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#0c0c10] text-foreground">
      <EditorToolbar onSave={handleSave} />
      <div className="flex min-h-0 flex-1">
        <EditorSideToolbar
          onSave={handleSave}
          onRun={handleRun}
          onStop={handleStop}
          onFitView={handleFitView}
          isRunning={isRunning}
        />
        <main className="relative min-w-0 flex-1">
          <DiagramCanvas />
        </main>
      </div>
      <NodeSettingsModal />
      <ToastViewport />
      <ConfirmDialogViewport />
    </div>
  );
}
