# 03 — Generate Tab, Providers & Capture

Bao gồm: Gen tab (single/multi prompt, settings), Reference images upload (drag-drop/paste/@mention), Screen Capture, Snippets/MyPrompts, ChatAI enhance, 4 Provider adapters (Flow/ChatGPT/Grok/Gemini), PromptQueue, TileMonitor + TileResolver, History tab, ProviderTabLock.

> **Layout reference:** Claude Design (2026-05-29) — 1 cột `max-w-[860px]` căn giữa, hero italic "Hãy tạo một thứ gì đó đẹp", coral (light) / violet (dark). Spec đầy đủ ở [`docs/05-ui-spec.md §2`](../05-ui-spec.md) + design system [`features/00-design-system.md`](00-design-system.md). Token mới đã apply trong `src/index.css` + `tailwind.config.ts`.

> Nguồn: `reference-ext/src/prompts/GenTab.js`, `MyPromptsTab.js`, `snippets/SnippetsPanel.js`, `core/providers/*`, `ChatGPTSession.js`, `GrokSession.js`, `GeminiSession.js`, `content.js`, `chat-content-*.js`, `slate-bridge.js`, `chat/ChatAIModal.js`, `core/PromptQueue.js`, `MentionParser.js`, `ImmediateUploader.js`, `FileUploader.js`, `capture/ScreenCapture.js`, `history/HistoryTab.js`, `core/TileMonitor.js`, `TileResolver.js`, `TileCache.js`, `ProviderTabLock.js`.

---

## A. Prompt Area

### A1. Nhập prompt single mode ✅

- **Trigger:** User gõ vào textarea Gen tab.
- **Steps:**
  1. Cập nhật `useGenerateStore.prompt` (debounce 50ms render).
  2. Parse `@ref_name` → highlight token có trong `ImageNameRegistry`; chưa có → grey + tooltip "Chưa tìm thấy".
  3. Counter `1 prompt → N output(s)` với N = `quantity`.
- **Case lỗi:**
  - **Empty prompt + click Generate:** disable nút Generate (state-level), không gọi API.
  - **Prompt > `max_prompt_length` (4000):** truncate + toast warning.

### A2. Multi-Prompt mode ✅

- **Trigger:** Toggle "Multi-Prompt" trong toolbar.
- **Steps:**
  1. Đổi placeholder → "Enter one prompt per line…", textarea cao hơn.
  2. Counter cập nhật real-time `N prompts → N×quantity output(s)`.
  3. Khi submit: split by `\n`, filter empty, mỗi line = 1 item trong PromptQueue.
- **Case lỗi:**
  - **N×quantity > daily quota:** preflight check FeatureGate quota → hiện cảnh báo "Sẽ vượt quota, chỉ chạy được X prompts đầu".
  - **Tất cả lines empty (chỉ whitespace):** disable Generate.

### A3. Toolbar buttons ✅

- **Library:** mở Prompts tab (P3+ filter snippet picker inline).
- **Chat AI:** mở ChatAIModal (xem D2). Hiện coming-soon placeholder cho đến P4.
- **Import .txt:** browse file → load text vào prompt textarea (multi-line tự bật multi-mode nếu ≥2 lines).
- **Save:** mở dialog lưu vào MyPrompts (xem E1). Coming-soon đến P6.

### A4. Settings panel ✅

- **Trigger:** User đổi Model / Aspect / Quantity / Style / Media type / Resolution / Auto-download / Folder / Run mode.
- **Steps:**
  1. Mỗi field debounce 200ms → ghi vào `useGenerateStore`.
  2. Khi đổi `provider` (radio Flow/ChatGPT/...): reset `model` về default model của provider mới (lấy từ ModelRegistry).
  3. Persist settings vào `chrome.storage.local.af_settings.generate.*` để session sau khôi phục.
- **Case lỗi:**
  - **Provider chưa enable (FeatureGate fail):** radio disabled + tooltip "Cần gói Pro".
  - **Quantity > `max_quantity` của provider** (Flow=4, ChatGPT=1...): clamp lại, toast.

---

## B. Reference Images

### B1. Add ảnh bằng button picker ✅

- **Trigger:** User click "Add" trong refImages section.
- **Steps:**
  1. `<input type=file accept="image/*" multiple>` mở file dialog.
  2. Mỗi file: validate `image/*`, size ≤ 10MB, đếm + check `max_ref_images` (10).
  3. Tạo blob preview qua `BlobUrlManager.acquire(imageId)` → render thumbnail.
  4. Lưu vào `ImageStore.put({ id, blob, kind: 'reference' })` (Dexie).
  5. Đăng ký `ImageNameRegistry.register(name, imageId)` để @mention dùng được.
  6. Trigger `ImmediateUploader.upload(imageId)` (xem B3).
- **Case lỗi:**
  - **Quá `max_ref_images`:** chặn upload thêm, toast "Tối đa 10 ảnh tham chiếu".
  - **File không phải image:** skip + toast riêng từng file.
  - **Dexie quota exceeded:** chạy cleanupExpired → retry; vẫn fail → toast "Bộ nhớ đầy, hãy xoá ảnh cũ".

### B2. Add ảnh bằng drag-drop / paste ✅

- **Trigger:** Drop file vào dropzone hoặc `Ctrl+V` trong promptArea/refImage section.
- **Steps:**
  1. Listen `paste` event → đọc `clipboardData.items[*]` → lọc `kind=='file' && type.startsWith('image/')`.
  2. Convert sang File → flow giống B1.
  3. Drag: handle `dragenter/dragover/drop` với feedback border highlight.
- **Case lỗi:**
  - **Paste rỗng (chỉ text):** ignore, không trigger.
  - **Drop nhiều file lớn cùng lúc:** queue compress sequentially để khỏi block UI.

### B3. ImmediateUploader → Flow tab ✅ (mock); 📋 (real)

- **Trigger:** Sau khi blob lưu local.
- **Steps:**
  1. Check provider hiện tại == `flow`?
  2. Check Flow tab active (`chrome.tabs.query({ url: 'https://labs.google/fx/*' })`).
  3. Active → `MessageBridge.uploadFilesToFlow({ blob, name })` → content script paste vào Flow editor → nhận lại `tile_id`, `file_name`.
  4. Cache vào `TileCache` + `PendingUploadStore`.
- **Case lỗi:**
  - **Flow tab inactive:** lưu lightweight pending (metadata only) trong `PendingUploadStore`; khi user mở Flow tab → `FileUploader.reuploadMissingFiles()` retry tự động.
  - **UPLOAD_BLOCKED (policy):** Flow từ chối ảnh → mark image `state=rejected`, hiện badge đỏ trên thumbnail.
  - **Timeout 30s:** retry 1 lần, fail → mark `state=upload_failed`, user có thể retry manual.

### B4. Search/Filter refImages ✅

- **Trigger:** User nhập vào search box hoặc đổi filter pill (All/Recent/Large).
- **Steps:** debounce 200ms, filter Map in-memory theo `name.includes(query)` + filter pill (Recent = top 5 mới nhất, Large = >2MB).
- **Case lỗi:** không có match → render empty hint.

### B5. Remove refImage ✅

- **Trigger:** Click X trên thumbnail.
- **Steps:** `BlobUrlManager.release()` → `ImageStore.delete()` → `ImageNameRegistry.unregister()`. Nếu image đã có `tile_id` trên Flow, KHÔNG xoá tile bên Flow (giữ để retry).

---

## C. Screen Capture

### C1. Capture region ✅ (P6)

- **Trigger:** Click "Screen capture" trong refImages.
- **Steps:**
  1. Request `chrome.permissions.request({ permissions: ['activeTab'], origins: ['<all_urls>'] })` lần đầu.
  2. `chrome.tabs.query({ active: true, currentWindow: true })` → tab target.
  3. Inject content script `capture-overlay.ts` vào tab → render crosshair + selection box.
  4. User drag select → ESC để cancel.
  5. Auto-confirm khi release → `chrome.tabs.captureVisibleTab` → PNG dataURL.
  6. Crop dataURL bằng canvas theo selection rect → File.
  7. Tiếp tục flow B1 (add to refImages) + auto-name `capture_<timestamp>`.
- **Case lỗi:**
  - **Permission denied:** show dialog hướng dẫn bật quyền + nút "Mở settings".
  - **Tab gốc bị close trong lúc drag:** content script orphan → khi capture trả về, sidebar nhận `CAPTURE_FAILED`.
  - **Image quá lớn (canvas blob fail):** giảm quality JPEG xuống 0.7 + retry; vẫn fail → toast.

---

## D. Snippets, MyPrompts, ChatAI

### D1. Snippet insert ✅ (P5)

- **Trigger:** User click 1 snippet trong panel.
- **Steps:**
  1. Parse content tìm `{{placeholder}}`.
  2. Nếu có → modal nhập values; submit → render text với substitution.
  3. Insert vào prompt area at cursor position (giữ undo history). Nếu multi-prompt → append như 1 line mới.
  4. PATCH `/prompts/{id}` → `use_count++` (best-effort, không block).
- **Case lỗi:**
  - **Snippet chứa @ref chưa có:** vẫn insert, user thấy grey token, tự thêm ảnh sau.
  - **Quota `prompt_templates_enabled` off:** disable panel, hiện CTA upgrade.

### D2. Save current as MyPrompt ✅ (P6)

- **Trigger:** Click "Save" trong toolbar.
- **Steps:** validate name + content; check `snippets_max` quota (FeatureGate); `POST /prompts`; refresh MyPrompts list.
- **Case lỗi:**
  - **Anonymous:** modal "Đăng nhập để lưu prompt".
  - **Quota exceeded:** upgrade dialog với count `{current}/{max}`.
  - **Title trùng:** confirm "Đã có 'X', tạo bản sao?" — server append `(2)`.

### D3. ChatAI enhance modal 📋 (P4)

- **Trigger:** Click "Chat AI" toolbar.
- **Steps:**
  1. Mở modal, render dialogue history (memory in-modal).
  2. User gõ instruction → POST `/chat/enhance` body `{ prompt, instruction, context_history }` → response stream.
  3. Modal render streaming, button "Apply" thay/append vào textarea Gen.
- **Case lỗi:**
  - **`chatgpt` provider chưa link/login:** modal show "Mở ChatGPT để dùng tính năng này" + nút mở tab.
  - **Stream interrupted:** show partial + nút retry.
  - **Rate-limit từ ChatGPT:** "ChatGPT đã hết lượt, chờ vài phút".

---

## E. PromptQueue (job orchestration)

### E1. Submit job ✅ (mock pipeline)

- **Trigger:** Click Generate (sau khi `ExecutionGate.request` thành công).
- **Steps:**
  1. Build `Job { id, owner: 'prompts', items: QueueItem[] }`. Mỗi line → 1 item.
  2. ExecutionLock acquire (xem doc 02).
  3. Push job vào queue, `_sortQueue()` theo priority (manual > telegram > workflow).
  4. EditorExecutor lấy item kế:
     - Switch provider tab nếu cần (ProviderTabLock).
     - Inject prompt vào DOM provider qua content script.
     - Click submit DOM → chờ TileMonitor báo "tiles ready".
  5. Mode `parallel`: dispatch toàn bộ items song song (cap tại `max_parallel` = 8 với Flow).
  6. Mode `sequential`: chờ item N done mới run N+1.
- **Happy path:** Mỗi item trả về `tile_ids[]` → ImageStore lưu blob → render thumbnail trong Results.
- **Case lỗi:**
  - **Lock conflict (workflow đang chạy):** dialog "Đang có workflow chạy, dừng để chạy gen?" → user quyết.
  - **Provider tab close mid-run:** detect bằng `chrome.tabs.onRemoved` → mark item FAILED, tiếp các item kế.
  - **User click Stop:** `_stoppedJobs.add(jobId)` → abort TileMonitor, ExecutionGate complete `cancelled`, release lock.

### E2. Per-item state machine

`QUEUED → SUBMITTING → MONITORING → DOWNLOADING (auto-DL) → COMPLETED | FAILED | CANCELLED`

Mỗi transition emit `queue:item_state` → Footer + Results UI cập nhật.

---

## F. Provider Adapters

### F1. FlowAdapter — Google Flow ✅ (mock); 📋 (real)

- **Trigger:** `provider === 'flow'`.
- **Steps:**
  1. `ensureReady()`: tab labs.google active, editor div mounted.
  2. Paste prompt vào `div[contenteditable]` qua `slate-bridge.ts` (preserve Slate state).
  3. Set settings DOM: model dropdown, ratio, quantity, ref images attached.
  4. Click `button[aria-label='Generate']`.
  5. TileMonitor watch `[data-tile-id]` mới xuất hiện.
  6. Mỗi tile: fetch media URL qua tRPC `getMediaUrlRedirect` → blob → cache.
- **Case lỗi:**
  - **DOM selector miss (Flow update UI):** EditorExecutor fallback Tier-2 → reload tab + retry.
  - **Rate-limit từ Flow (visible UI badge):** detect badge, mark all pending FAILED, toast "Flow rate-limit, thử lại sau X phút".
  - **Content blocked:** detect modal "Content violates policy" → mark item FAILED, log policy error.

### F2. ChatGPTAdapter — ChatGPT ✅ (mock); 📋

- **Trigger:** `provider === 'chatgpt'`.
- **Steps:**
  1. `ensureReady()`: tab chatgpt.com login? — chưa login → throw `PROVIDER_NOT_AUTHENTICATED`.
  2. Paste prompt vào `div[contenteditable]` + click `[data-testid='send-button']`.
  3. Wait `img.generated-image` xuất hiện trong message cuối.
- **Case lỗi:**
  - **Chưa subscribe Plus:** badge "Upgrade to Plus" → mark FAILED + show user.
  - **Text-only response (no image):** fallback marker — vẫn lưu text như metadata, mark item PARTIAL.

### F3. GrokAdapter / GeminiAdapter — tương tự

- Selectors trong `MOCK_PROVIDER_DOM_SELECTORS`.
- Khác biệt: Gemini có ratio image-vs-video toggle, Grok có 2 mode (image/video) khác nhau.

---

## G. TileMonitor + TileResolver

### G1. Baseline + claim ✅ (mock)

- **Trigger:** Item vào trạng thái `MONITORING`.
- **Steps:**
  1. Cache `baselineTileIds = current DOM tile IDs` ngay trước submit.
  2. Poll DOM mỗi 300ms (hoặc MutationObserver) → diff với baseline.
  3. Mỗi tile mới: claim cho item gần nhất theo `_submitOrder`, dedup qua `_claimedTileIds` set.
  4. Watch status từng tile: pending / generating / success / failed.
  5. Resolve URL qua `TileResolver.fetchMediaUrl(tileId)` → blob.
- **Case lỗi:**
  - **Timeout 300s:** mark FAILED + log "Không phát hiện tiles mới".
  - **Tab throttle (Chrome inactive):** không nhận update → fallback Tier-2 reload + resubmit.
  - **Partial failure:** một số tile success, một số failed → success → COMPLETED partial; failed → click_retry trong DOM (Tier-1) → vẫn fail → Tier-2 resubmit.

### G2. Retry strategy (FAR-1 → FAR-5 từ reference) 📋

| Tier | Khi nào | Action |
|---|---|---|
| Tier-1 | Tile failed có nút "Retry" trong DOM | Click retry button |
| Tier-2 | Tier-1 hết retry hoặc Tab throttled | Resubmit item từ đầu (reload tab nếu cần) |
| Backoff | Failed liên tiếp ≥ 3 | Exponential 5→10→20s, max 60s |

---

## H. ProviderTabLock

### H1. Serialize provider switching 📋

- **Trigger:** Job mixed provider (vd: workflow có Flow + ChatGPT nodes).
- **Steps:**
  1. `acquire(provider)` → chuyển focus tab provider → sleep 300ms để Radix/React render.
  2. Sau khi node xong → release → provider khác acquire.
- **Case lỗi:**
  - **User switch tab manual:** `ensureActiveSilent()` re-activate.
  - **Tab close:** sendMessage fail soft → mark job error, release lock, tiếp job kế.

---

## I. Results display ✅ (mock)

- **Trigger:** Mỗi tile claim/complete.
- **Steps:** Grid 2 cột, mỗi card show thumbnail + actions (Download / Save to Album / Add to History / Copy URL).
- **Case lỗi:**
  - **Blob URL expired (BlobUrlManager release sớm):** lazy reacquire khi card mount, hoặc fallback icon placeholder.
  - **Quá nhiều results (>50):** virtualize list (react-window) để giữ FPS.

---

## J. History tab

### J1. List & filter ✅ (mock); 📋 (real)

- **Trigger:** Mở tab History.
- **Steps:**
  1. `GET /history?page=1&size=20` (cache TanStack Query 5 min).
  2. Render cards thumbnail + prompt preview + provider + project + time.
  3. Filter: favorite toggle, project filter, search text (client-side trong page hiện tại; server filter nếu query dài).
- **Case lỗi:**
  - **Empty (chưa có history):** illustration + nút "Bắt đầu Generate".
  - **Pagination fail:** fallback page cache hiện tại + warning toast.

### J2. Re-run from history 📋

- **Trigger:** Click "Re-run" trên card.
- **Steps:** load settings cũ vào Gen tab (prompt, model, ratio, refImages reference) → switch tab Gen → highlight nút Generate.
- **Case lỗi:** RefImages cũ đã bị xoá khỏi ImageStore → toast "1 ảnh tham chiếu không còn, hãy thêm lại."

### J3. Favorite/Delete history 📋

- Toggle favorite (`PATCH /history/{id}`), delete (`DELETE /history/{id}`).

---

## K. Storage keys & events

| Key | Mục đích |
|---|---|
| `af_settings.generate.*` | Persist Gen tab settings |
| `af_pending_uploads` | Lightweight pending uploads chờ Flow tab |
| `af_generate_recent_prompts` | Top 10 recent prompts (dropdown gợi ý) |

| Event | Khi nào |
|---|---|
| `queue:item_state` | item transition state |
| `queue:job_complete` | toàn bộ items done |
| `capture:complete` | screen capture xong |
| `provider:tab_unavailable` | tab provider không sẵn sàng |
