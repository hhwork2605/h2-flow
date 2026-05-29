/**
 * persistence.ts — Workflow list & doc CRUD qua Dexie (IndexedDB).
 *
 * Layer: Storage adapter
 * Owner: features/workflow
 *
 * Phase 3 P3.10: migrate từ localStorage → Dexie để hỗ trợ workflows lớn
 * (nodes có outputPreview blob, runs history sắp tới ở Phase 4). API public
 * giữ tên cũ nhưng đổi sang `Promise`-based — caller phải `await`.
 *
 * - Schema: bảng `workflows` (xem `storage/db.ts`).
 * - One-shot migration: lần đầu chạy sẽ đọc `af_wf_index` + `af_wf_<id>` từ
 *   localStorage rồi seed Dexie, sau đó xoá localStorage keys (gắn flag
 *   `af_wf_migrated_to_dexie=1`).
 * - Cross-tab sync: `BroadcastChannel('h2flow-workflows')` thay vì `storage`
 *   event (storage event chỉ fire khi key thay đổi — Dexie không touch
 *   localStorage). Tab editor sau khi `saveWorkflow` sẽ post message
 *   `{type:'index-changed'}`, sidebar tab list re-fetch.
 */

import { db, type WorkflowRow } from '@/storage/db';
import type { WorkflowDocument } from '@/types/workflow.types';

export interface WorkflowListEntry {
  id: string;
  name: string;
  updated_at: number;
  node_count: number;
  sync_state: WorkflowDocument['sync_state'];
}

const LEGACY_INDEX_KEY = 'af_wf_index';
const LEGACY_DOC_PREFIX = 'af_wf_';
const MIGRATION_FLAG = 'af_wf_migrated_to_dexie';
const CHANNEL_NAME = 'h2flow-workflows';

/* ─── Migration ─────────────────────────────────────────────────────── */

let migrationPromise: Promise<void> | null = null;

/**
 * Migrate localStorage → Dexie 1 lần. Idempotent: lần thứ 2 trở đi trả Promise
 * resolved ngay. Tự gọi trong listWorkflows() / loadWorkflow() / saveWorkflow().
 */
function ensureMigrated(): Promise<void> {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    try {
      if (localStorage.getItem(MIGRATION_FLAG) === '1') return;
      const rawIndex = localStorage.getItem(LEGACY_INDEX_KEY);
      if (!rawIndex) {
        // Không có data cũ — đánh dấu đã migrate.
        localStorage.setItem(MIGRATION_FLAG, '1');
        return;
      }
      const entries = JSON.parse(rawIndex);
      if (!Array.isArray(entries)) {
        localStorage.setItem(MIGRATION_FLAG, '1');
        return;
      }
      const docs: WorkflowDocument[] = [];
      for (const e of entries) {
        if (!e?.id) continue;
        const docRaw = localStorage.getItem(LEGACY_DOC_PREFIX + e.id);
        if (!docRaw) continue;
        try {
          docs.push(JSON.parse(docRaw) as WorkflowDocument);
        } catch {
          // skip corrupted
        }
      }
      if (docs.length > 0) {
        await db.workflows.bulkPut(docs.map(toRow));
        console.info(`[workflow] migrated ${docs.length} workflows localStorage → Dexie`);
      }
      // Sau migration xoá localStorage keys (giữ flag).
      localStorage.removeItem(LEGACY_INDEX_KEY);
      for (const e of entries) {
        if (e?.id) localStorage.removeItem(LEGACY_DOC_PREFIX + e.id);
      }
      localStorage.setItem(MIGRATION_FLAG, '1');
    } catch (err) {
      console.warn('[workflow] migration fail', err);
    }
  })();
  return migrationPromise;
}

/* ─── List ───────────────────────────────────────────────────────────── */

export async function listWorkflows(): Promise<WorkflowListEntry[]> {
  await ensureMigrated();
  const rows = await db.workflows.orderBy('updated_at').reverse().toArray();
  return rows.map(rowToEntry);
}

/* ─── Doc CRUD ───────────────────────────────────────────────────────── */

export async function loadWorkflow(id: string): Promise<WorkflowDocument | null> {
  await ensureMigrated();
  const row = await db.workflows.get(id);
  return row?.data ?? null;
}

export async function saveWorkflow(doc: WorkflowDocument): Promise<void> {
  await ensureMigrated();
  try {
    await db.workflows.put(toRow(doc));
    broadcastIndexChanged();
  } catch (err) {
    console.warn('[workflow] saveWorkflow fail', err);
  }
}

export async function deleteWorkflow(id: string): Promise<void> {
  await ensureMigrated();
  try {
    await db.workflows.delete(id);
    broadcastIndexChanged();
    broadcastWorkflowDeleted(id);
  } catch (err) {
    console.warn('[workflow] deleteWorkflow fail', err);
  }
}

/* ─── Cross-tab sync (BroadcastChannel) ─────────────────────────────── */

let _channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (_channel) return _channel;
  _channel = new BroadcastChannel(CHANNEL_NAME);
  return _channel;
}

type BroadcastMsg =
  | { type: 'index-changed'; origin: string }
  | { type: 'workflow-deleted'; id: string; origin: string };

const ORIGIN_ID = Math.random().toString(36).slice(2, 10);

function broadcastIndexChanged(): void {
  const ch = getChannel();
  if (!ch) return;
  try {
    ch.postMessage({ type: 'index-changed', origin: ORIGIN_ID } satisfies BroadcastMsg);
  } catch {
    /* ignore — channel might be closed */
  }
}

function broadcastWorkflowDeleted(id: string): void {
  const ch = getChannel();
  if (!ch) return;
  try {
    ch.postMessage({
      type: 'workflow-deleted',
      id,
      origin: ORIGIN_ID,
    } satisfies BroadcastMsg);
  } catch {
    /* ignore */
  }
}

/**
 * Lắng nghe thay đổi index từ tab khác. Returns unsubscribe.
 *
 * Lưu ý: tab tự gây ra thay đổi cũng nhận message của chính nó qua
 * BroadcastChannel — filter theo `ORIGIN_ID` để KHÔNG trigger callback trong
 * tab origin (giống behavior cũ của `storage` event).
 */
export function subscribeToIndex(callback: () => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  function onMessage(evt: MessageEvent<BroadcastMsg>) {
    if (!evt.data || evt.data.type !== 'index-changed') return;
    if (evt.data.origin === ORIGIN_ID) return; // self
    callback();
  }
  ch.addEventListener('message', onMessage);
  return () => ch.removeEventListener('message', onMessage);
}

/**
 * Lắng nghe workflow bị xoá. Editor popup window dùng để tự đóng tab khi
 * workflow đang mở bị user xoá từ sidebar list (UX: editor không nên show
 * stale doc + auto-save sẽ resurrect doc đã xoá).
 *
 * KHÔNG filter self-origin: tab editor PHẢI đóng kể cả khi user xoá ngay từ
 * editor (handleClose → deleteWorkflow → tab tự đóng).
 */
export function subscribeToWorkflowDeleted(
  callback: (id: string) => void,
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  function onMessage(evt: MessageEvent<BroadcastMsg>) {
    if (!evt.data || evt.data.type !== 'workflow-deleted') return;
    callback(evt.data.id);
  }
  ch.addEventListener('message', onMessage);
  return () => ch.removeEventListener('message', onMessage);
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function toRow(doc: WorkflowDocument): WorkflowRow {
  return {
    id: doc.id,
    name: doc.name,
    project_id: doc.project_id,
    updated_at: doc.updated_at,
    created_at: doc.created_at,
    node_count: doc.nodes.length,
    sync_state: doc.sync_state,
    data: doc,
  };
}

function rowToEntry(row: WorkflowRow): WorkflowListEntry {
  return {
    id: row.id,
    name: row.name,
    updated_at: row.updated_at,
    node_count: row.node_count,
    sync_state: row.sync_state,
  };
}
