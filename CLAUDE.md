# CLAUDE.md — Rules cho AI coding agent (Claude Code / Cursor / v0 / Bolt…)

Dự án này **rebuild lại TobyFlow 1.1.5** trên stack hiện đại (Vite + React 18 + TS + Tailwind, theo `docs/03-tech-stack.md`).

## TRƯỚC TIÊN — đọc PROGRESS.md

**Mỗi session mới**, đọc [`PROGRESS.md`](PROGRESS.md) NGAY trước khi viết code. File đó là nguồn duy nhất nói:
- Đang ở Phase nào, đã làm gì, sắp làm gì (mục **Snapshot**)
- Các quyết định đã chốt (mục **Decision log**) — đừng hỏi lại
- Known issues còn treo (mục **Known issues**)

**Sau mỗi task có ý nghĩa**, cập nhật `PROGRESS.md`:
- Tick checkbox task vừa xong
- Update **Last updated**, **Current phase**, **Next action** trong mục Snapshot
- Thêm dòng vào **Decision log** nếu có quyết định không hiển nhiên
- Thêm vào **Known issues** nếu phát hiện vấn đề chưa fix

Không cần update mỗi file/mỗi edit — chỉ khi đóng 1 task có ý nghĩa (vd: xong P1.1 RequestSigner, xong P1 toàn phase, fix xong 1 blocker).

## RULE — Verify feature thật sự chạy, KHÔNG chỉ dựa vào build pass

**`npx tsc --noEmit && npx vite build` chỉ bắt syntax + type. KHÔNG bắt được behavior bugs** như: event handler không fire, controlled state mismatch, library API hiểu sai, stale artifact load nhầm, CSS pointer-events block, race condition.

### Trước khi tick checkbox PROGRESS.md, PHẢI làm 4 bước:

1. **Build & type check** — `npx tsc --noEmit` sạch, `npx vite build` pass.
2. **Manual smoke test trong browser** — `npm run dev:web` (hoặc reload extension), thực sự click / drag / gõ tính năng vừa code. Console DevTools không có error đỏ.
3. **Visual diff** — UI khớp với spec/screenshot (nếu có). Reload page → state persist đúng.
4. **Liệt kê acceptance criteria dạng bullet** trong commit message hoặc PROGRESS entry. Mỗi bullet phải là 1 hành động cụ thể user có thể kiểm chứng (vd: "kéo node → node theo chuột", KHÔNG phải "drag works").

### Anti-pattern đã gặp — đừng lặp lại

| Bug | Triệu chứng | Bài học |
|---|---|---|
| `.js` stale ưu tiên `.tsx` | Build pass nhưng UI không phản hồi action mới wire | Sau khi đổi `.tsx`, BẮT BUỘC reload browser + click thử button vừa thêm. Nếu silent fail → check `find src -name "*.js"` |
| `onNodesChange` bỏ frame `dragging:true` | Build pass nhưng kéo node snap back | Khi dùng prop của library lạ (React Flow controlled mode), đọc docs section đó + thử kéo thử ngay |
| Action toolbar button không fire | Click không có effect, không có log | Phải mở DevTools, click thử, xem console log + Zustand state trong React DevTools |

### Acceptance criteria — VIẾT TRƯỚC khi code, không sau

Mỗi task có ý nghĩa (1 chunk Pn.m hoặc 1 bug fix lớn) PHẢI có khối **"Done =
ALL true"** trong PROGRESS.md hoặc trong PR description, ghi TRƯỚC khi bắt
đầu code. Mỗi bullet là 1 hành động cụ thể user có thể kiểm chứng — KHÔNG
được dùng phrasing chung chung như "drag works" / "feature complete" /
"polished UX".

**Template:**

```md
### Pn.m — <task title>
**Done = ALL true:**
- [ ] <action cụ thể 1, kiểm chứng được trong browser>
- [ ] <action cụ thể 2>
- [ ] <persist / reload check nếu có state>
- [ ] <không break flow cũ — vd: drag không trigger duplicate>
- [ ] Build pass: `npx tsc --noEmit && npx vite build`
- [ ] Manual smoke test pass (`npm run dev:web` + click thử tất cả bullet trên)
- [ ] (Optional) e2e test xanh: `npm run test:e2e -- <spec>`
```

**Ví dụ tốt** (Rule "kéo node" mà session vừa rồi miss):

```md
### P3.17 — Fix node drag (controlled mode)
**Done = ALL true:**
- [ ] Click + giữ chuột trên node body + di chuột → node theo chuột real-time, KHÔNG snap back
- [ ] Thả chuột → node đứng yên ở vị trí mới
- [ ] Reload page (F5) → node vẫn ở vị trí mới (persist Dexie)
- [ ] Click vào nút trong action toolbar / footer cog → KHÔNG trigger drag
- [ ] Click vào textarea prompt / input branch / number delay → KHÔNG trigger drag
```

**Ví dụ xấu** (đừng viết kiểu này):

```md
### P3.17 — Fix node drag
**Done:**
- [ ] Drag works
- [ ] UI polished
- [ ] No regression
```

Phrasing chung chung không bắt được bug — "drag works" có thể đúng theo nghĩa "click không crash" mà vẫn fail nghĩa "node thực sự di chuyển".

### E2E test cho critical paths — Playwright

Mỗi feature critical (drag/drop, action toolbar, settings modal, executor run,
keyboard shortcut) PHẢI có 1 Playwright spec trong `tests/e2e/`. Khi sửa
feature, chạy `npm run test:e2e -- <spec>` TRƯỚC khi tick task.

- Config: [playwright.config.ts](playwright.config.ts) — auto-spawn dev
  server, baseURL `http://localhost:5173`, Chromium only.
- Specs: [tests/e2e/workflow-editor.spec.ts](tests/e2e/workflow-editor.spec.ts) —
  13 tests covering P3.4 (palette drop), P3.14 (action toolbar + context menu +
  settings modal), P3.16 (per-kind body), P3.17 (drag), keyboard shortcuts.
- Pattern: mỗi test `beforeEach` clear `indexedDB.deleteDatabase('h2-flow')`
  + `localStorage.clear()` qua `page.addInitScript()` → isolated.
- Khi spawn node: dispatch `CustomEvent('h2flow:drop', {detail:{kind,x,y}})`
  qua `page.evaluate()` — bypass palette UI cho test focused vào canvas.

**Trước khi commit feature mới**:
```bash
npm run typecheck      # tsc --noEmit
npm run build          # vite build (catches manifest issues)
npm run test:e2e       # browser smoke automated
```

Khi 1 e2e test fail, đọc tên test (vd "P3.17 regression") → lookup chunk
tương ứng trong PROGRESS.md để hiểu invariant.

**Lưu ý**: e2e không thay thế manual smoke test khi đang code 1 feature mới
(chưa có test cho nó). Manual luôn là rule đầu, e2e là regression net.

### Khi NGHI NGỜ một thay đổi không có hiệu lực

Đừng đoán — chạy 1 trong các check sau:
- Thêm `console.log('[feature-name]', state)` tạm vào handler, click, xem log.
- Mở `dist/assets/<chunk>-<hash>.js` grep tên hàm vừa thêm — nếu không có, build không pick up code mới.
- `git status` xem có file `.js` artifact đi kèm `.tsx` không.
- `find src -name "*.js" -newer tsconfig.json` — bắt file `.js` sinh sai thời điểm.

## Nguồn tham chiếu (PHẢI BIẾT)

Repo có 2 nguồn thông tin, dùng đúng vai trò của từng nguồn:

| Thư mục | Vai trò | Khi nào dùng |
|---|---|---|
| `docs/` | **Spec rebuild** — kiến trúc, UI, data model, API, roadmap mới | Đây là nguồn **chính thống** cho thiết kế phiên bản mới |
| `reference-ext/` | **Mã nguồn TobyFlow 1.1.5 bản gốc** (Vanilla JS, Manifest V3, unpacked) | Đây là **ground truth về nghiệp vụ** khi `docs/` chưa đủ chi tiết |

## RULE — Khi gen code, nếu nghiệp vụ chưa rõ → đọc `reference-ext/`

Khi đang implement một feature/module và **gặp 1 trong các tình huống**:

- `docs/` mô tả high-level nhưng thiếu chi tiết về thuật toán, edge case, thứ tự bước, format payload, selector DOM, timing/delay, retry policy, error code mapping…
- Tên class/hàm/event trong `docs/` không khớp với code đã có (vì docs đôi khi dùng tên React-friendly trong khi bản gốc dùng tên khác)
- Phải đoán giữa nhiều cách implement và muốn biết **bản gốc làm thế nào**

→ **PHẢI** đọc file tương ứng trong `reference-ext/` trước khi viết code, KHÔNG tự bịa.

### Quy tắc mapping nhanh `docs/` ↔ `reference-ext/`

| Spec trong `docs/` | File tham khảo trong `reference-ext/` |
|---|---|
| Background script, `apiRequest` proxy | `reference-ext/background.js` |
| Sidebar bootstrap, tab switching | `reference-ext/sidebar.html`, `reference-ext/src/app.js` |
| Workflow engine, executor, node runners | `reference-ext/src/core/WorkflowExecutor.js`, `reference-ext/src/workflow/` |
| Workflow editor (Drawflow → React Flow) | `reference-ext/workflow-editor-init.js`, `reference-ext/workflow-editor.html` |
| Provider adapters (Flow/ChatGPT/Grok/Gemini) | `reference-ext/src/core/providers/`, `reference-ext/src/core/ChatGPTSession.js`, `GrokSession.js`, `GeminiSession.js` |
| Content scripts (DOM bridge) | `reference-ext/content.js`, `reference-ext/chat-content-*.js`, `reference-ext/slate-bridge.js` |
| Auth, RequestSigner, anti-clone | `reference-ext/src/core/AuthManager.js`, `RequestSigner.js` |
| FeatureGate / ExecutionGate / quota | `reference-ext/src/core/FeatureGate.js`, `ExecutionGate.js`, `ExecutionLock.js`, `TrialGate.js` |
| Storage (Image/Album/Thumbnail/Media) | `reference-ext/src/core/ImageStore.js`, `AlbumStore.js`, `ThumbnailCache.js`, `MediaRegistry.js`, `BlobUrlManager.js` |
| SSE / Mercure / polling | `reference-ext/src/core/SseClient.js`, `SseBroadcastManager.js` |
| Settings sync 2-tier | `reference-ext/src/core/BackendSync.js`, `SystemConfig.js`, `ConfigVersionPoller.js` |
| Angles / Effects editor | `reference-ext/angles-editor*.js/html`, `reference-ext/effects-editor*.js/html`, `reference-ext/src/angles/`, `reference-ext/src/effects/` |
| Screen Capture | `reference-ext/src/capture/ScreenCapture.js` |
| i18n + 4 ngôn ngữ | `reference-ext/src/core/I18n.js`, `reference-ext/lib/i18n/` (nếu có) |
| Telegram bot integration | `reference-ext/src/core/TelegramExecutor.js` |
| OAuth bridge | `reference-ext/oauth-bridge.js` |
| Settings page UI | `reference-ext/settings-page.js`, `reference-ext/settings.html` |
| Manifest, permissions, entry HTML | `reference-ext/manifest.json` |

(Danh sách trên là gợi ý. Khi không chắc, dùng Grep/Glob tìm symbol tương ứng trong `reference-ext/`.)

## Cách dùng `reference-ext/` (đọc, KHÔNG copy-paste)

1. **Đọc để hiểu nghiệp vụ**: thứ tự xử lý, dữ liệu thực tế, các trường hợp lỗi đã được xử lý.
2. **Tái cài đặt trên stack mới** theo `docs/03-tech-stack.md` (TS strict, React hooks, Zustand, Dexie, TanStack Query…). KHÔNG bê nguyên Vanilla JS / jQuery-style sang.
3. **Bỏ qua** thứ docs đã chủ đích đổi: tên class, cấu trúc folder, framework UI, naming convention (camelCase TS).
4. **Khi có mâu thuẫn** giữa `docs/` và `reference-ext/`:
   - Mâu thuẫn về **kiến trúc / tech stack** → theo `docs/`.
   - Mâu thuẫn về **nghiệp vụ / hành vi** (ví dụ: bao nhiêu retry, delay bao lâu, header gì, payload shape) → theo `reference-ext/` (vì đó là code đã chạy production).
   - Nếu vẫn không chắc → **dừng lại hỏi user**, đừng đoán.

## Khi cite trong code/PR

Khi tham khảo `reference-ext/` để viết code, ghi rõ trong commit message / PR description:

```
Refs reference-ext/src/core/WorkflowExecutor.js: copy logic topological sort + heartbeat lock.
```

Để sau này dễ trace lại nguồn gốc behavior.

## Không được làm

- KHÔNG sửa file trong `reference-ext/` — đây là snapshot read-only của bản gốc.
- KHÔNG copy-paste nguyên file `.js` sang `src/` — phải rewrite TS-strict, React-idiomatic.
- KHÔNG bỏ qua `docs/` rồi clone 1:1 theo `reference-ext/` — đích đến là phiên bản rebuild trên stack mới, không phải bản gốc.
