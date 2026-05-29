# 06 — Multi-Task, Angles & Effects

Bao gồm: Multi-task tab (batch jobs, sequential/parallel), Angles editor popup (camera orbit + presets), Effects editor popup (filter library + intensity slider).

> Nguồn: `reference-ext/src/multi-task/MultiTaskTab.js`, `TaskList.js`, `TaskModal.js`, `src/angles/AngleEditor.js`, `AngleExecution.js`, `src/effects/EffectsEditor.js`, `EffectsExecution.js`, `effects-editor.css`, `reference-ext/angles-editor*.{js,html}`, `effects-editor*.{js,html}`, `workflow-editor.html`, `workflow-template-editor.html`.

> Rebuild note: bản gốc Angles/Effects mở qua `chrome.windows.create` popup HTML riêng. h2-flow giữ pattern này vì cần canvas size + tránh chiếm sidebar; nhưng wrap React + chia sẻ shared store qua `chrome.runtime.sendMessage`.

---

## A. Multi-Task Tab

### A1. List tasks 📋 (P4)

- **Trigger:** Mở tab "Tasks".
- **Steps:**
  1. `GET /tasks?status=active&page=1` (paginate 20).
  2. Render rows: name, prompts count, model, ratio, status (queued/running/paused/completed/failed), progress bar, action buttons.
  3. Filter: status pill (Active / Completed / Failed), search name.
- **Case lỗi:**
  - **Empty:** CTA "Tạo task batch đầu tiên".
  - **Server fail:** fallback Dexie cache local + offline banner.

### A2. Create task 📋

- **Trigger:** "+ New Task" → mở TaskModal.
- **Steps:**
  1. Modal nhập: name, prompts list (textarea hoặc import .txt), provider, model, ratio, quantity, run_mode (sequential/parallel), schedule (now / cron / delayed).
  2. Validate: ≥1 prompt, quota check FeatureGate `task_run`.
  3. `POST /tasks` body `{ name, prompts, model, ratio, quantity, run_mode, schedule_at? }`.
  4. Nếu `schedule_at = now` → start ngay; else → queued chờ scheduler.
- **Case lỗi:**
  - **Quota exceeded:** disable Submit + show "Cần upgrade để tạo task batch".
  - **Prompts > giới hạn (vd: 100 prompts/task):** truncate + toast.
  - **Schedule trong quá khứ:** UI inline error.

### A3. Run / Pause / Stop task 📋

- **Trigger:** Action button trên row.
- **Steps:**
  - **Run:** `ExecutionGate.request({ action: 'task_run', count: prompts.length })` → PromptQueue submit batch owner=`tasks`.
  - **Pause:** flag `paused`, items đang chạy hoàn thành rồi dừng.
  - **Stop:** abort tất cả pending + complete `cancelled`.
- **Case lỗi:**
  - **Lock conflict (Gen đang chạy):** dialog "Dừng gen hiện tại để chạy task?"
  - **Mid-run server lỗi:** mark task `failed`, lưu partial output + nút Resume.

### A4. View task details 📋

- **Trigger:** Click row.
- **Steps:** TaskModal detail view: progress per prompt, output thumbnails, log entries, action retry-failed-only.
- **Case lỗi:** Output deleted (TTL) → placeholder, vẫn giữ prompt + metadata.

### A5. Retry failed prompts 📋

- **Trigger:** Click "Retry failed (X)" trong detail.
- **Steps:** Re-submit chỉ những prompts có `item.status === 'failed'`.
- **Case lỗi:** Tất cả đã success → button disable.

### A6. Delete task 📋

- **Trigger:** Row menu → Delete.
- **Steps:** Confirm → `DELETE /tasks/{id}` (cascade delete prompts + outputs).
- **Case lỗi:** Task đang chạy → confirm "Dừng và xoá?" trước.

### A7. Schedule / Cron 📋 (P5+)

- **Action:** Cho phép task lặp lại daily/weekly hoặc chạy 1 lần tương lai.
- **Steps:** `schedule: { type: 'once'|'daily'|'weekly', at: ISO time, tz }` → server scheduler enqueue.
- **Case lỗi:** Server scheduler outage → task pending → SSE event `scheduler_resumed` → backfill.

---

## B. Angles Editor (popup window)

Mở qua `chrome.windows.create({ url: 'angles-editor.html', type: 'popup', width: 1100, height: 720 })`. Sidebar gửi context qua URL params + `chrome.runtime.sendMessage`.

### B1. Mở Angles editor 📋

- **Trigger:** Click "Angles" trong GenTab settings, hoặc node Angles trong workflow editor.
- **Steps:**
  1. Sidebar/Workflow editor save `af_angles_session = { source_image_id, return_target }` vào `chrome.storage.session`.
  2. `chrome.windows.create` mở popup → React app boot → đọc session.
  3. Load preset list `GET /angle-presets?category=*`.
  4. Render 3D orbit canvas + reference image + preset grid (thumbnail + name).
- **Case lỗi:**
  - **`source_image_id` không tồn tại trong ImageStore:** show empty state "Hãy add ảnh tham chiếu trước".
  - **Preset API fail:** fallback hard-coded preset "Portrait Re-angle" + toast offline.

### B2. Adjust camera (rotate/zoom/pan) 📋

- **Trigger:** Drag canvas / wheel zoom / shift+drag pan.
- **Steps:**
  1. Cập nhật camera state `{ azimuth, elevation, zoom, pan_x, pan_y }`.
  2. Re-render 3D preview với three.js.
  3. Snap về preset gần nhất nếu `Shift` hold.
- **Case lỗi:** GPU/WebGL fail → fallback 2D preview với thumbnail xoay theo CSS transform; show warn.

### B3. Pick preset 📋

- **Trigger:** Click preset card.
- **Steps:** Apply preset params → preview animation chuyển góc; cập nhật state form.
- **Case lỗi:** Preset bị admin remove → fallback default + toast "Preset đã bị gỡ".

### B4. Generate angles 📋

- **Trigger:** Click "Generate" với ≥1 angle config.
- **Steps:**
  1. FeatureGate `angles_enabled` check.
  2. ExecutionGate request `count = số angles`.
  3. Call `POST /angles/generate` body `{ source_image_id, angles: [...] }` hoặc dispatch workflow inline.
  4. Listen SSE event `angle:completed` per angle → update grid result.
- **Case lỗi:**
  - **Quota exceeded:** dialog upgrade.
  - **Generation timeout 60s:** abort, hiện "Generation failed, retry?".
  - **Reference invalid (chứa text thay ảnh):** server reject 422 → toast.

### B5. Apply result về source 📋

- **Trigger:** Click "Save all" hoặc "Save selected".
- **Steps:** `chrome.runtime.sendMessage({ to: return_target, action: 'angles:result', images })` → sidebar/workflow editor nhận → add vào ImageStore + node config.
- **Case lỗi:** Target window đã đóng → fallback save vào History tab + toast "Đã lưu vào History".

### B6. Close editor 📋

- **Steps:** Cleanup three.js + revoke BlobUrls + clear `af_angles_session`.

---

## C. Effects Editor (popup window)

Tương tự Angles nhưng cho image effects (color grading, blur, vintage, transitions video).

### C1. Mở Effects editor 📋

- **Trigger:** Click "Effects" GenTab/workflow node.
- **Steps:**
  1. Mở popup `effects-editor.html` (1100×720).
  2. Load `GET /effects?category=*` → 4 category tabs (Color, Blur, Vintage, Misc).
  3. Render reference + grid effect cards (thumbnail + name + premium badge).
- **Case lỗi:** API fail → fallback local cache `af_effects_cache` (TTL 1h); empty cache → show "Hãy bật mạng".

### C2. Pick effect + intensity 📋

- **Trigger:** Click effect card → intensity slider 0-100% xuất hiện.
- **Steps:**
  1. Apply effect preview client-side (canvas filter) cho image hiện tại.
  2. Real-time update khi user drag slider (debounce render 16ms).
  3. Compose effect chain: cho phép stack ≤3 effects.
- **Case lỗi:**
  - **Effect premium (Pro/Team):** đè lock icon, click → upgrade modal.
  - **Effect không hỗ trợ provider hiện tại:** disable card + tooltip.

### C3. Apply (submit gen) 📋

- **Trigger:** Click "Apply".
- **Steps:** FeatureGate + ExecutionGate; `POST /effects/apply` body `{ source_image_id, effect_chain }`; nhận job_id; SSE listen `effect:completed`.
- **Case lỗi:**
  - **SSE event `provider:models_updated`:** re-render model select, suppress current job nếu effect removed.
  - **Timeout 60s:** mark FAILED + retry button.

### C4. Save / Discard 📋

- Save: gửi result về caller (xem B5).
- Discard: close popup, không lưu gì.

### C5. SSE-driven config refresh 📋

- **Trigger:** SSE event `provider:api_config_updated` hoặc `provider:models_updated` (admin update).
- **Steps:** Re-fetch model list, re-render dropdown; preserve user selection nếu vẫn tồn tại.
- **Case lỗi:** Selected model bị remove → fallback default + toast "Model đã đổi sang X".

---

## D. Shared logic giữa Angles & Effects

### D1. Resizable panels 📋

- Left = result grid, Right = picker/preset grid. User drag divider.
- Persist split ratio vào `af_settings.angles.split` / `af_settings.effects.split`.

### D2. Quota display footer 📋

- Show `getQuota('angles_run').remaining` / `effects_run` cùng nút Upgrade.

### D3. Tab leader election 📋

- Multiple popups mở cùng lúc → leader chỉ gọi 1 lần `GET /presets` để dedupe.

---

## E. Storage & Events

| Key | Mục đích |
|---|---|
| `af_angles_session` | Context chuyển từ sidebar sang popup |
| `af_effects_session` | Tương tự cho effects |
| `af_effects_cache` | Fallback offline effect list |
| `af_settings.angles.*`, `af_settings.effects.*` | UI persisted state (split, last category…) |

| Event | Khi nào |
|---|---|
| `angles:result` | Popup → caller, kết quả gen angles |
| `effects:result` | Popup → caller, kết quả gen effects |
| `task:state_changed` | Task transition |
| `task:scheduled` | Cron tick fire job |
| `provider:models_updated` | Admin update model list (relayed SSE) |
