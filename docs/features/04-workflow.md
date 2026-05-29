# 04 — Workflow Editor, Engine & Templates

Bao gồm: Workflow editor (drag-drop, undo/redo, ports), Executor engine (topological run + heartbeat lock), Node types (Generate/Download/Edit/Telegram/Branch/Angles/Effects), List & CRUD, Templates browse/use/save, Share + History, Queue panel (pipeline).

> Nguồn: `reference-ext/src/core/WorkflowExecutor.js`, `src/workflow/WorkflowEditor.js`, `WorkflowList.js`, `WorkflowTab.js`, `NodeTemplates.js`, `DiagramCanvas.js`, `WorkflowHistory.js`, `WorkflowMediaModal.js`, `ShareWorkflowModal.js`, `SharedWorkflowOverlay.js`, `SaveTemplateModal.js`, `WorkflowTemplateList.js`, `templates/TemplatesTab.js`, `queue/QueuePanel.js`, `shared/ProjectHelper.js`, `WorkflowExportHelper.js`.

> Rebuild note: bản gốc dùng Drawflow + vanilla JS. h2-flow dự kiến dùng React Flow + Zustand (xem `docs/09-workflow-engine.md`). API & DOM bridge nghiệp vụ giữ nguyên hành vi.

---

## A. Workflow Editor

### A1. Mở editor 📋

- **Trigger:** Click card workflow trong list, hoặc "New workflow", hoặc Template "Use".
- **Steps:**
  1. Route `/workflow/:id` mở DiagramCanvas component.
  2. Load workflow từ Dexie (local-first); nếu chưa có → fetch `GET /workflows/{id}` → cache Dexie.
  3. Init React Flow store với `nodes[]`, `edges[]`, `viewport`.
  4. Init history snapshot (max 50 snapshot, mỗi snapshot ~10-100KB).
- **Case lỗi:**
  - **Workflow corrupt JSON:** show error + button "Mở dạng read-only" để export rồi tạo mới.
  - **Workflow của user khác (forbidden):** fetch 403 → redirect List + toast.

### A2. Drag node từ palette ✅ (P3)

- **Trigger:** Drag node template từ sidebar palette vào canvas.
- **Steps:**
  1. Tạo node mới với default params từ `NodeTemplates[type]`.
  2. Auto-position cạnh node được select (offset 280px right), hoặc center viewport.
  3. Emit `editor:node_added` → push undo snapshot (debounce 400ms để combo "drag + edit title" thành 1 snapshot).
- **Case lỗi:**
  - **Drop ngoài canvas:** ignore, không tạo node.
  - **Quá `max_workflow_nodes` (50):** chặn add + toast "Đã đạt giới hạn 50 nodes".

### A3. Kết nối port ✅ (P3)

- **Trigger:** Drag từ output port → input port.
- **Steps:**
  1. Validate compatibility theo bảng `PORT_COMPAT`: text↔text, image↔image, image↔frame (coerce), video↔video, any↔ALL.
  2. Hợp lệ → create edge, color theo source type (`text=#9177e1`, `image=#3b82f6`, `video=#a855f7`, `frame=#14b8a6`, `any=#71717a`).
  3. Không hợp lệ → red X cursor, không tạo edge.
- **Case lỗi:**
  - **Cycle:** check topological → nếu tạo cycle → reject + toast "Không cho phép vòng lặp".
  - **Multi-input ràng buộc:** node chỉ chấp nhận 1 input port type X → từ chối input thứ 2.

### A4. Edit node properties ✅ (P3)

- **Trigger:** Click node → open right panel.
- **Steps:** Render form theo schema `NodeTemplates[type].fields`. Debounce 400ms ghi → push history snapshot.
- **Case lỗi:** Validation fail (vd: ratio empty) → field red, node có badge ❗ trên canvas.

### A5. Save workflow ✅ (P3 local)

- **Trigger:** `Ctrl+S` hoặc auto-save mỗi 2s sau edit.
- **Steps:**
  1. Local-first: ghi Dexie `workflows[id]` ngay → emit `storage:workflow_saved`.
  2. Debounce 2s → `PUT /workflows/{id}` body `{ name, project_id, nodes, edges, viewport }`.
  3. UI status badge: `unsaved` → `saving` → `synced` ✓.
- **Case lỗi:**
  - **Server timeout:** retry 3 lần exponential; vẫn fail → badge `error` + nút manual retry.
  - **Conflict 409 (đã có version mới hơn):** show diff dialog "Server có thay đổi, ghi đè hay merge?".

### A6. Undo / Redo ✅ (P3)

- **Trigger:** `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`.
- **Steps:** Pop snapshot từ history stack → replace React Flow state; push current vào redo stack.
- **Case lỗi:**
  - **Quá 50 snapshots:** drop oldest, giữ tối đa.
  - **Restore state không khớp (corrupt snapshot):** skip + log warn, không break editor.

### A7. Run workflow từ editor ✅ (P3)

- **Trigger:** Click ▶ Run button.
- **Steps:** save trước (force) → `ExecutionGate.request({ action: 'workflow_run', count: 1 })` → WorkflowExecutor.start.
- **Case lỗi:**
  - **Unsaved changes failing save:** dialog "Lưu nháp local rồi tiếp tục?".
  - **ExecutionGate denied:** modal quota (xem doc 02 B1).

---

## B. WorkflowExecutor Engine

### B1. Run pipeline ✅ (mock); 📋 (real)

- **Trigger:** User click Run / Telegram command / Multi-task entry.
- **Steps:**
  1. Topological sort nodes (Kahn's algorithm); detect cycle → throw.
  2. ExecutionLock acquire owner=`workflow`.
  3. Heartbeat lock: mỗi 30s ping `POST /executions/{id}/heartbeat` để giữ lock prod.
  4. Run nodes theo order:
     - Trigger node → load context (prompt input từ user).
     - Compute node (Branch/Condition) → set branch state.
     - I/O node (Generate/Download/Telegram) → call adapter tương ứng.
  5. Emit `workflow:node_started`, `workflow:node_completed`, `workflow:node_failed` cho UI cập nhật.
  6. ExecutionGate complete khi kết thúc.
- **Case lỗi:**
  - **Node fail + `retry_on_fail` quota:** retry node tối đa 2 lần backoff 5s, 15s.
  - **Heartbeat fail 3 lần liên tiếp:** server auto-release lock → client detect → mark workflow CANCELLED.
  - **User stop midway:** abort tất cả node đang chạy, mark `CANCELLED`, vẫn lưu partial results vào history.

### B2. Persist execution log 📋

- Mỗi node end → `POST /workflows/{id}/runs/{runId}/nodes` body `{ node_id, status, duration_ms, output_summary }`.
- Lưu Dexie local làm cache → user offline vẫn xem được history gần đây.

---

## C. Node types

### C1. Generate node (Flow / ChatGPT / Grok / Gemini) 📋

- **Action:** Submit prompt cho 1 provider, output là `tile_id[]` + blob references.
- **Steps:** Tương tự `03-generate.md` E1 nhưng owner=`workflow`.
- **Case lỗi:** Provider tab close → mark node FAILED; downstream Download node nhận empty input → skip + warning.

### C2. Download node 📋

- **Action:** Download mọi image từ input port vào folder local.
- **Steps:**
  1. Serial queue (Flow context menu không cho phép parallel).
  2. Mark `_inProgressTileIds.add(id)` TRƯỚC khi download (race-free).
  3. Timeout = 45s/file (10s wait media ready + 5s open menu + 30s download).
  4. Lưu Folder template `{downloadFolder}/{Date}/{ProjectName}/{File}`.
- **Case lỗi:**
  - **Folder không tồn tại:** fallback Downloads root + log warn.
  - **Timeout:** mark file FAILED, tiếp file kế (không break node).
  - **Disk full (chrome.downloads error):** abort node + toast.

### C3. Edit node (Angles / Effects pipeline) 📋

- **Action:** Apply Angle preset hoặc Effect lên image input.
- **Steps:** Open processing pipeline (background, không popup) → đợi job ID từ server → poll status → emit success.
- **Case lỗi:** SSE event `provider:api_config_updated` → reload params; nếu effect bị remove → skip + warning.

### C4. Telegram node 📋

- **Action:** Gửi image+caption tới Telegram chat của user.
- **Steps:** check `user.telegram_chat_id` link chưa? chưa → mark FAILED `TELEGRAM_NOT_LINKED`; rồi → `POST /telegram/send-workflow-images` body `{ file_ids, caption, mode }`.
- **Case lỗi:** Telegram bot rate-limit (1 msg/3s) → queue retry trong bot service; client nhận `delayed` status, ok.

### C5. Branch / Condition node 📋

- **Action:** Routing dựa expression boolean trên input.
- **Steps:** Eval expression sandbox (vd: `count(input) > 5`) → set output port `true` hoặc `false` active.
- **Case lỗi:** Expression invalid → node validation đỏ; runtime gặp → throw FAILED.

### C6. Telegram receive / Multi-task entry 📋 (P5+)

- **Action:** Trigger workflow từ Telegram command hoặc Multi-task batch.
- Tham khảo doc 06 + 07.

---

## D. Port system

### D1. Strict typed ports ✅ (P3)

- 5 types: `text`, `image`, `video`, `frame`, `any`. Mỗi type có icon + color (xem A3).
- Compatibility matrix theo `PORT_COMPAT`. UI render badge type trên port circle.
- **Case lỗi:** Legacy workflow (chưa có port type info) → assume `any`, không break.

---

## E. Workflow List & CRUD

### E1. List view ✅ (P3)

- **Trigger:** Mở Workflow tab.
- **Steps:**
  1. `GET /workflows?project_id=<x>&page=1` (paginate 20).
  2. Render cards: name, last_run_at, status badge, project label, action buttons (Run/Edit/Duplicate/Delete/Share).
  3. Search box debounce 300ms → server query nếu length > 2.
- **Case lỗi:** Empty list → CTA "Tạo workflow mới" hoặc "Browse Templates".

### E2. Create / Duplicate ✅ (P3)

- **Trigger:** "+ New" hoặc card menu → Duplicate.
- **Steps:** `POST /workflows` body `{ name, project_id, source_id? }`; new → empty canvas; duplicate → clone nodes+edges, name "Copy of X".

### E3. Delete ✅ (P3)

- **Trigger:** Card menu → Delete.
- **Steps:**
  1. Confirm dialog.
  2. Optimistic remove khỏi list state + Dexie.
  3. `DELETE /workflows/{id}` → toast success.
- **Case lỗi:**
  - **API fail:** rollback optimistic, restore card, toast error.
  - **Đang chạy:** confirm "Workflow đang chạy. Dừng và xoá?" — yes → stop trước, sau đó delete.

### E4. Share (P5+) 📋

- **Trigger:** Card menu → "Share to user".
- **Steps:** Modal nhập email + note (≤500 ký tự) → `POST /workflows/{id}/share` body `{ to_email, note }` → email từ server.
- **Case lỗi:** Email invalid → inline error đỏ; user không tồn tại → server fallback gửi invite email.

### E5. Shared workflow accept (P5+) 📋

- Sender share → receiver mở app → `SharedWorkflowOverlay` show: preview workflow + nút "Add to my workflows" / "Reject".
- Accept → clone workflow vào project user → toast.

### E6. Workflow run/stop từ List ✅ (P3)

- Run = `ExecutionGate.request` + Executor.
- Stop = abort + complete `cancelled`.
- Cooldown 5s sau run complete → suppress duplicate reload events (chống API spam Phase 6 reference fix).

---

## F. Workflow History

### F1. List runs 📋

- **Trigger:** Mở "History" trong workflow detail.
- **Steps:** `GET /workflows/{id}/runs?page=1` → list cards: started_at, status, duration, generated count.
- **Case lỗi:** No runs → empty state.

### F2. Replay run 📋

- **Trigger:** Click "Replay" trên run card.
- **Steps:** Load snapshot inputs run cũ → start workflow mới với cùng inputs.

### F3. View media run 📋

- **Trigger:** Click thumbnail run.
- **Steps:** `WorkflowMediaModal` show grid images output. Action: Download all, Add to album.
- **Case lỗi:** Image expired (server cleanup TTL) → fallback placeholder.

---

## G. Templates

### G1. Browse templates 📋

- **Trigger:** Templates tab trong Workflow.
- **Steps:**
  1. `GET /templates?category=<x>` → grid cards (thumbnail + name + description + "Official" badge nếu admin-curated).
  2. Filter category + search + sort (popular / new / featured).
- **Case lỗi:** Empty → fallback show official templates only.

### G2. Use template 📋

- **Trigger:** Click "Use" trên card.
- **Steps:** Clone template → `POST /workflows` source_id=template_id → mở editor; rename mặc định "Copy of {Template name}".
- **Case lỗi:** Template chứa node type extension không hỗ trợ (vd: backend cũ) → migrate node → skip nếu không map được, vẫn import phần còn lại + toast.

### G3. Save current workflow as template 📋

- **Trigger:** Workflow editor → menu "Save as template".
- **Steps:** `SaveTemplateModal` modal nhập name + description + category + thumbnail; `POST /templates` body `{ name, description, category, workflow_data, thumbnail_url? }`.
- **Case lỗi:** Quota `workflow_templates_enabled` off → block, hiện upgrade. Name trùng → confirm overwrite hay rename.

---

## H. Queue Panel (Pipeline)

### H1. Queue workflows 📋 (P4+)

- **Trigger:** User click "Run All" trên list, hoặc add workflow vào queue thủ công.
- **Steps:**
  1. Queue items lưu Zustand + persist Dexie `pipeline_queue`.
  2. EventBus `queue:changed` → re-render panel.
  3. Run sequential: pop top → execute → pop next.
- **Case lỗi:**
  - **Pause:** flag `paused = true`, current item complete xong thì dừng.
  - **Stop + clear:** abort current + clear all items.
  - **Reorder (drag):** chỉ cho phép reorder items chưa start.

### H2. Persist across sidebar close 📋

- Queue lưu Dexie + `chrome.storage.session` (replay events khi reopen).
- Background SW restart: replay events từ session storage → resume.

---

## I. Project switcher

### I1. Switch project ✅ (skeleton P2.7)

- **Trigger:** Click ProjectIndicator dropdown.
- **Steps:** set `_filterProjectId` ngay → re-render list, async `loadWorkflows()` cho project mới. Filter null = show all.
- **Case lỗi:** Race switch A→B→C nhanh → state cuối thắng (TanStack Query dedupe).

### I2. Create project ✅ (skeleton)

- **Trigger:** "Create new project" trong dropdown.
- **Steps:** input name → `POST /projects` body `{ name }` → select project mới.
- **Case lỗi:** Name trùng → server append `(2)` hoặc inline error.

---

## J. Storage keys & events

| Key | Mục đích |
|---|---|
| `workflows[id]` Dexie | Local-first workflow data |
| `workflow_history.<id>` | Snapshot undo (in-memory chính, mirror Dexie tối đa N) |
| `pipeline_queue` Dexie | Queue persist across sessions |
| `af_workflow_execution_cooldown` | Cờ 5s sau run để dedupe API spam |

| Event | Khi nào |
|---|---|
| `storage:workflow_saved` | save workflow (chứa `wfId` để single-update) |
| `workflow:node_started` / `node_completed` / `node_failed` | runtime |
| `workflow:run_completed` | full run done |
| `queue:changed` / `queue:started` / `queue:paused` / `queue:completed` | queue panel |
| `template:applied` | sau khi Use template |
