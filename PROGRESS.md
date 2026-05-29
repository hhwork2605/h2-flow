# PROGRESS.md — h2-flow rebuild tracker

Mục đích: nơi DUY NHẤT để biết đang ở Phase nào, đã làm gì, sắp làm gì. Mỗi session mới đọc file này TRƯỚC khi viết code.

> **Nguyên tắc cập nhật**: sau khi hoàn thành 1 task có ý nghĩa (không phải mỗi file), update mục `Last updated`, tick checkbox tương ứng, và viết 1 dòng vào **Decision log** nếu có quyết định không hiển nhiên.

---

## Snapshot

| Field | Value |
|---|---|
| **Last updated** | 2026-05-29 |
| **Current phase** | **Phase 3 — Workflow editor + engine ✅ DONE** (16/16 chunks) — chuyển sang Phase 4 |
| **Critical bug fix** | **P3.15 stale .js artifact resolution priority** — User báo các action vẫn không chạy sau khi wire. Root cause: `tsconfig.json` thiếu `noEmit:true` → `tsc` cũ đã sinh 123 file `.js` cạnh các `.ts/.tsx`. Vite default `resolve.extensions` đặt `.js` TRƯỚC `.tsx` → mọi import không-extension load .js stale (compile lúc 11:33) thay vì .tsx mới (11:58+). Fix: (1) xoá toàn bộ 123 `.js` có counterpart `.ts/.tsx`; (2) thêm `"noEmit": true` vào tsconfig; (3) override `vite.config.ts resolve.extensions = ['.tsx', '.ts', '.mjs', '.js', '.jsx', '.json']` chống tương lai; (4) clear `tsconfig.tsbuildinfo` + `node_modules/.vite` cache. Build verify: sidebar 57.83KB (giảm 44KB vs trước — vì .js cũ duplicate code), workflow-editor 184.85KB gzip (thực sự chứa NodeSettingsModal + NodeContextMenu + executor updates). |
| **Last completed** | **Verify infrastructure (Rule 3 + 5)** (task #101-102): User hỏi cách tránh bug "build pass nhưng feature chết" như drag không chạy + .js stale lọt lưới. Setup 2 lớp defense: (1) **Acceptance criteria template trong CLAUDE.md** — mỗi task PHẢI có khối "Done = ALL true" với bullet hành động cụ thể (vd: "click giữ + di chuột → node theo chuột không snap back") thay vì phrasing chung chung "drag works". Bug `!c.dragging` đã LỘ ngay tại bullet đầu nếu acceptance criteria được viết TRƯỚC code. (2) **Playwright e2e setup** — `playwright.config.ts` auto-spawn Vite dev server, `tests/e2e/workflow-editor.spec.ts` cover 14 critical paths (sanity, palette drop, per-kind body presence, drag regression P3.17, action toolbar 5 buttons, duplicate/delete buttons, right-click context menu, settings modal open + edit, Ctrl+D + Delete shortcuts). Pattern: `beforeEach` clear `indexedDB` + `localStorage` qua `page.addInitScript()` cho isolated state. Click ở header position (80,12) thay vì center vì body có inputs với `stopPropagation`. Selector qua `[aria-label="..."]` direct thay vì `getByRole({name})` vì side toolbar có aria-label trùng (vd "Cài đặt"). Kết quả: **14/14 pass trong 13s**. CLAUDE.md mới có "trước khi commit feature mới chạy `npm run typecheck && npm run build && npm run test:e2e`". |
| **Previous** | **P3.17 Fix node drag** — `onNodesChange` bỏ guard `!c.dragging` để controlled mode hoạt động đúng. |
| **Previous** | **P3.16 Per-kind node body renderer** (task #99): User báo "các node giống nhau y hệt". Đối chiếu `reference-ext/src/workflow/NodeTemplates.js` — bản gốc có 11 layout khác nhau. Tạo `NodeBodies.tsx` dispatcher + `NODE_SIZE` map. Distinct UIs cho 14 kinds: ratio-aware preview cho provider gens, inline textarea cho prompt, radial dot pattern cho angles, segmented controls cho download/multi, inline `<input>` cho delay/branch, v.v. Inline controls dùng `nodrag` class + `stopPropagation` để không trigger node drag. |
| **Last completed** | **P3.14 Hoàn thiện thao tác node theo reference-ext** (task #97): User báo các action node chưa chạy. Đối chiếu `reference-ext/src/workflow/DiagramCanvas.js _showNodeContextMenu` + `NodeTemplates.js df-hover-toolbar` — bản gốc có 7 actions (Run/Reset/Download/Settings/Branch/Copy prompt/Duplicate/Delete) share dispatcher giữa hover toolbar + right-click context menu. Wire bản TS: (1) **Settings** — `NodeSettingsModal` Radix Dialog với form params (boolean→switch, number→input, multiline string `prompt/text/expression/template`→textarea) + enable/disable toggle + Xoá node button; mở qua event `h2flow:open-node-settings`; (2) **Run single node** — `runSingleNodeMock(id)` chạy 1 node độc lập qua `executeNode()` mock; (3) **Branch** — `branchFromNode(sourceId, targetKind='prompt')` tạo node mới offset (+320,0) + auto-wire edge nếu compatible; (4) **Enable toggle** trong header + footer settings button đã wire (kèm `onPointerDown stopPropagation` để không drag); (5) **Right-click context menu** — `NodeContextMenu` 6 items (Chạy node / Bật-tắt node / Cài đặt / Tạo nhánh / Nhân bản Ctrl+D / Xoá Del), auto-adjust position khi vượt viewport, đóng qua outside-click / Escape / paneClick; (6) Executor full-run skip node có `data.disabled=true`. Store thêm `toggleNodeEnabled` + `branchFromNode`. WorkflowNodeData thêm field `disabled?`. Build pass: sidebar 102.15KB, workflow-editor 179.55KB gzip (toàn bộ thêm <2KB nhờ tree-shake Radix Dialog đã import sẵn). |
| **Next action** | **Phase 4 — Multi-provider + SSE** (8-10d): 1) Real ChatGPT/Grok/Gemini DOM adapter (content scripts mỗi domain — `chat.openai.com`, `grok.com`, `gemini.google.com`); 2) Real Flow tile bridge (`content/flow.ts` + `slate-bridge.ts` MAIN world); 3) SseClient + SseBroadcastManager → NotificationBell live + Workflow run progress; 4) Wire executor → ProviderRegistry thay vì picsum mock; 5) Add reason='quota' cho AddEdgeResult khi nối paid-provider × free user. Tham khảo `reference-ext/src/core/{ChatGPTSession,GrokSession,GeminiSession,SseClient,SseBroadcastManager}.js`. |
| **Blocker** | Không còn cho dev. Real DOM bridge + auto-download + Chat AI + screen capture cần extension + Phase 4-6 work. |

---

## Phase tracker

| # | Phase | Status | Estimate | Notes |
|---|---|---|---|---|
| 0 | Scaffold | ✅ Done | 3-5d | Build pass, sidebar 19.61KB gzip, chờ user verify trong browser |
| 1 | Auth + Public infra | ✅ Done | 5-7d | All 6 chunks. Build pass: sidebar 47.63KB + vendor 74.69KB gzip. Mock backend covers test flow. |
| 2 | Generate tab + Flow provider | ✅ Done | 8-10d | Chunks 1-6 + 2.7 UI parity + Claude Design refactor + gap close. Build: sidebar 105.58KB gzip. Deferred for later phases: real Flow DOM bridge (P4), real auto-download (P4), real Chat AI (P4), real screen capture (P6), MentionHelper (P6). |
| 3 | Workflow editor + engine | ✅ Done | 12-15d | 14/14 chunks: 14 NodeTemplates + Zustand store (undo/redo 50 snapshots, runtime status, duplicate, AddEdgeResult discriminated) + DiagramCanvas + BaseNode TobyFlow-style + EditorToolbar + EditorSideToolbar + NodePalettePopover + CanvasBottomBar + WorkflowEditor + WorkflowTab list + **Dexie persistence v3** + popup tab mode + BroadcastChannel cross-tab sync + pointer-based drag-drop + WorkflowExecutor mock (topo sort + per-node simulation + cancel) + Toast system + connection rejection toasts + Ctrl+D duplicate. Bundle: workflow-editor 179.55KB gzip. |
| 4 | Multi-provider + SSE | 🟡 Starting | 8-10d | P4.1 ChatGPT adapter trước, then Grok/Gemini/Flow bridge/SSE. Verify mỗi chunk: Rule 3 acceptance + Playwright e2e. |
| 5 | Billing + Telegram | 🔒 Blocked by P4 | 8-10d | |
| 6 | Polish + remaining tabs | 🔒 Blocked by P5 | 8-10d | |

Legend: ✅ Done · 🟡 In progress · ⏳ Next · 🔒 Blocked · ⚠️ Has issues

---

## Phase 0 — Scaffold ✅

Roadmap: [docs/12 §Phase 0](docs/12-implementation-roadmap.md). Prompt: [docs/13 §P0](docs/13-vibe-coding-prompts.md).

### Tasks
- [x] `npm create vite@latest` template react-ts (deps install OK, 635 packages)
- [x] Add `@crxjs/vite-plugin` ([vite.config.ts](vite.config.ts))
- [x] Setup `manifest.config.ts` với `side_panel`, basic permissions ([manifest.config.ts](manifest.config.ts))
- [x] 5 HTML entries ở root ([sidebar.html](sidebar.html), [workflow-editor.html](workflow-editor.html), [angles-editor.html](angles-editor.html), [effects-editor.html](effects-editor.html), [settings.html](settings.html))
- [x] Tailwind 3 + design tokens (light/dark CSS vars) ([tailwind.config.ts](tailwind.config.ts), [src/index.css](src/index.css))
- [x] ESLint + Prettier + tsconfig strict ([.eslintrc.cjs](.eslintrc.cjs), [.prettierrc.json](.prettierrc.json), [tsconfig.json](tsconfig.json))
- [x] TanStack Query Provider ([src/api/queryClient.ts](src/api/queryClient.ts))
- [x] Zustand store skeleton ([src/store/app.store.ts](src/store/app.store.ts))
- [x] Dexie DB skeleton ([src/storage/db.ts](src/storage/db.ts))
- [x] State-based routing (Zustand activeTab, persist `af_active_sidebar_tab`)
- [x] Theme provider (light/dark/auto, persist `af_theme`) ([src/ui/theme/ThemeProvider.tsx](src/ui/theme/ThemeProvider.tsx))
- [x] Skeleton tab bar 6 tabs ([src/pages/sidebar/TabRouter.tsx](src/pages/sidebar/TabRouter.tsx) + [tabs/](src/pages/sidebar/tabs/))
- [x] Background script skeleton với `apiRequest` proxy handler ([src/background/index.ts](src/background/index.ts))
- [ ] Load extension in `chrome://extensions/`, verify Side Panel hoạt động — **WAIT FOR USER**

### Verification checklist (chưa làm)
- [ ] User load `dist/` vào `chrome://extensions/` (Developer mode → Load unpacked) → side panel mở được
- [ ] Tab switch giữa 6 tab OK, active tab persist sau reload
- [ ] Theme toggle (light → dark → auto) hoạt động + persist
- [ ] `npm run dev` → HMR fire khi save file `.tsx`

### Output
- Build: sidebar 19.61KB gzip, vendor chunk 46.40KB gzip (budget 200KB — đỡ rất nhiều)
- Output structure: `dist/{manifest.json, service-worker-loader.js, 5x .html, assets/, icons/}`

---

## Phase 1 — Auth + Public infra 🟡

Roadmap: [docs/12 §Phase 1](docs/12-implementation-roadmap.md). Prompts: [docs/13 §P1.1, P1.2, P1.3](docs/13-vibe-coding-prompts.md).

### Chunk 1 — API foundation ✅
- [x] `src/types/user.types.ts` — User / AuthSession / LoginPayload / RegisterPayload
- [x] `src/types/api.types.ts` — ApiEnvelope (success/failure), ApiErrorCode
- [x] `src/types/messages.types.ts` — full `apiRequest` shape (method, endpoint, data, token, headers, apiBaseUrl)
- [x] `src/api/errors.ts` — `ApiError` class + `networkError()` + `backgroundUnavailable()`
- [x] `src/api/config.ts` — `getApiBaseUrl()` + per-user override (`apiBaseUrl` saved in `af_auth`)
- [x] `src/api/client.ts` — `request()` + `requestRaw()` (sends `apiRequest` via `chrome.runtime.sendMessage`)
- [x] `src/background/enrollment.ts` — read `toby_client_enrollment` from chrome.storage + dev fallback (`VITE_EXT_ID` + `VITE_EXT_SECRET`)
- [x] `src/background/request-signer.ts` — HMAC-SHA256 hex per reference-ext contract (NOT docs/08)
- [x] `src/background/api-proxy.ts` — full apiRequest handler: builds URL, adds Bearer + HMAC headers, parses envelope, maps HTTP status → ApiErrorCode
- [x] `src/background/index.ts` — wire dispatch + `auth:changed` message

### Chunk 2 — Auth store + endpoints ✅
- [x] `src/api/endpoints/auth.ts` — login, register, refresh, fetchMe, logout, googleAuthUrl, forgotPassword, resendVerificationPublic
- [x] `src/features/auth/store/auth.store.ts` — Zustand. Persist `af_auth`. Cross-context sync via `chrome.storage.onChanged`. Internal flags (sessionInvalid / loggingOut / refreshing) mirror reference-ext AuthManager
- [x] `src/features/auth/services/AuthService.ts` — orchestration (login / register / logout / refresh single-flight / restoreSession with one-shot refresh-retry on 401)
- [x] `src/features/auth/hooks/useAuth.ts` — sidebar hook
- [x] `src/features/auth/hooks/useAuthBootstrap.ts` — hydrate + verify on mount

### Chunk 3 — Login/Register UI ✅
- [x] `src/ui/components/Button.tsx` — variants (primary/secondary/ghost/danger), sizes (sm/md/lg)
- [x] `src/ui/components/Input.tsx` — labelled input with error state
- [x] `src/ui/components/Dialog.tsx` — Radix Dialog wrapper, fade+scale 200ms (per docs/05 §9)
- [x] `src/features/auth/components/LoginModal.tsx` — email/password + Google OAuth button + switch to register
- [x] `src/features/auth/components/RegisterModal.tsx` — name/email/password/confirm + email-verification-required hint
- [x] `src/features/auth/components/AuthHeaderControl.tsx` — sign-in button (unauth) / avatar dropdown with logout (auth)
- [x] Wired in [TabRouter](src/pages/sidebar/TabRouter.tsx) header + `useAuthBootstrap({ verifyOnMount: true })` in [App](src/pages/sidebar/App.tsx)

### Chunk 4 — i18n setup (4 locales) ✅
- [x] `src/i18n/locales/{vi,en,th,ja}.json` — local fallback (common, header, tabs, auth, offline, cloneDetected, language namespaces)
- [x] `src/i18n/config.ts` — i18next init + persist `af_locale` to chrome.storage + cross-context sync
- [x] `src/i18n/I18nProvider.tsx` — async wrapper, blocks render until init resolves
- [x] `src/i18n/LanguageSelector.tsx` — globe icon dropdown with 4 flags + check mark
- [x] Wired into all 5 pages (sidebar, workflow-editor, angles-editor, effects-editor, settings)
- [x] Replaced hardcoded strings in TabRouter, LoginModal, RegisterModal, AuthHeaderControl

### Chunk 5 — Public config bootstrap ✅
- [x] `src/types/system.types.ts` — SystemSettings, DefaultSettings, FeatureFlag, QuotaInfo, Entitlements
- [x] `src/core/useSystemConfig.ts` — `useSystemConfig()` + `useDefaultSettings()` (TanStack Query, 1h stale)
- [x] `src/core/useEntitlements.ts` — `useEntitlements()` + `useFeatureFlag(key)` (TanStack Query, 30s stale, keyed by token so login auto-refetches)
- [x] `src/core/useBootstrapPublicConfig.ts` — warms cache on sidebar mount with all 3 queries
- [x] Wired into sidebar `App.tsx` (BootstrapShell)

### Chunk 6a — Offline overlay ✅
- [x] `src/shared/overlays/OfflineOverlay.tsx` — listens `navigator.onLine` + window 'online'/'offline' events. Blocking full-screen with retry button.

### Chunk 6b — Anti-clone overlay + self-heal probe ✅
- [x] `src/core/cloneDetection.ts` — `getCloneDetected()` / `setCloneDetected()` / `useCloneDetected()` hook (subscribes to `af_clone_detected` flag)
- [x] `src/shared/overlays/CloneDetectedOverlay.tsx` — z-clone-overlay blocking screen with "Open Chrome Web Store" CTA
- [x] `src/api/client.ts` — intercepts 403 EXTENSION_NOT_AUTHORIZED → setCloneDetected(true)
- [x] `src/background/self-heal.ts` — registers chrome.alarms `af_clone_self_heal` every 1 minute. When flag is set, polls `/extension/authorized`; on 200, clears flag.
- [x] `src/shared/overlays/RootOverlays.tsx` — bundles both overlays
- [x] Mounted in all 5 pages

### Chunk 6c — OAuth bridge ✅
- [x] `src/content/oauth-bridge.ts` — reads `token` + `user=base64(json)` from URL → posts `auth:google-callback` message → closes tab
- [x] Background handler `handleGoogleCallback()` — validates payload, writes `af_auth` (sidebar's cross-context sync picks it up)
- [x] Manifest: added content_script entry matching `https://your-backend.example.com/auth/google/success*` with `run_at: document_start`

### Acceptance criteria (Phase 1 toàn bộ)
- ✅ Register → email verified user (mock auto-login) → token saved → user info hiển thị
- ✅ Login email/password → token saved → header dropdown với avatar + name
- 🟡 Google login → flow redirect mở tab (mock URL — không hoạt động end-to-end vì cần real backend OAuth)
- ✅ Logout → state cleared, header trở về "Đăng nhập"
- ✅ Network offline → OfflineOverlay (full-screen blocking, retry button)
- ✅ Backend reject ext_id → CloneDetectedOverlay (auto-clears via background probe khi backend re-authorize)
- ✅ 4 locale switch tức thì (header globe icon)

### Acceptance criteria
- Register → email gửi đi (backend mock OK)
- Login email/password → token saved → user info hiển thị
- Google login → flow redirect OK
- Logout → state cleared
- Network offline → overlay xuất hiện, retry button works
- Backend reject ext_id → clone overlay xuất hiện

### Reference cần đọc khi gặp nghiệp vụ chưa rõ (theo [CLAUDE.md](CLAUDE.md))
- `reference-ext/src/core/AuthManager.js` — auth flow logic
- `reference-ext/src/core/RequestSigner.js` — HMAC header format
- `reference-ext/oauth-bridge.js` — Google OAuth content script
- `reference-ext/src/core/I18n.js` + `reference-ext/loading-i18n.js` — i18n bootstrap
- `reference-ext/src/core/SystemConfig.js` — public config load

---

## Phase 2 — Generate tab + Flow provider 🟡

Roadmap: [docs/12 §Phase 2](docs/12-implementation-roadmap.md). Prompts: [docs/13 §P2.1-P2.4](docs/13-vibe-coding-prompts.md).

### Chunk 2.1 — Core infra ✅
- [x] `src/types/provider.types.ts`, `src/types/execution.types.ts`
- [x] `src/core/useModelRegistry.ts` — `useAllModels()`, `useModels(provider, mediaType)`, `useDefaultModel()`
- [x] `src/core/useProviderConfig.ts` — `useProviders()`, `useProviderApiConfigs()`, `useProviderDomSelectors()`
- [x] `src/core/ExecutionGate.ts` — service with request/complete/cancel/cancelAll + idempotency + `useExecutionGate` wrapper that invalidates entitlements cache
- [x] `src/core/ExecutionLock.ts` — local single-runner lock (tryAcquire/release/forceRelease)
- [x] `src/core/useFeatureGate.ts` — high-level API: `canUse(feature)`, `quotaRemaining(action)`, `quotaLimit`, `reasonFor`, `isPaid`
- [x] Mock routes: `GET /providers`, `GET /provider-models`, `GET /providers/api-configs`, `GET /providers/dom-selectors`, `POST /execution/{request,complete,cancel}` với quota enforcement (in-memory used counter, refund on cancel)
- [x] Enriched `/entitlements` mock: thêm reference-ext convention keys (`gen_enabled`, `flow_enabled`, `chatgpt_enabled`, `workflows_enabled`, …)

### Chunk 2.2 — Provider adapter pattern ✅
- [x] `src/providers/AIProviderAdapter.ts` — abstract base với `submitPrompt()` + `ensureTab()`
- [x] `src/providers/ProviderTabLock.ts` — Map<provider, tabId>
- [x] `src/providers/FlowAdapter.ts` — `ensureTab()` tìm/mở labs.google/fx, `submitPrompt()` fall back to mock (picsum.photos placeholder) khi không có tab thật
- [x] `src/providers/ProviderRegistry.ts` — singleton registry (Phase 4 sẽ register ChatGPT/Grok/Gemini)

### Chunk 2.3 — Generate UI skeleton ✅
- [x] `src/features/generate/store/generate.store.ts` — Zustand: prompts, provider, mediaType, model, ratio, quantity, runMode, runs, cancelHandle + `parsePrompts()` helper
- [x] `src/ui/components/Select.tsx` — Radix-based dropdown với badge support
- [x] `src/features/generate/components/`:
  - `PromptArea.tsx` — multi-line textarea, live prompt count
  - `ProviderSelector.tsx` — pill bar, locked options for paid providers
  - `ModelSelector.tsx` — filtered theo provider × mediaType, auto-pick default
  - `MediaTypeToggle.tsx` — image/video toggle
  - `RatioSelector.tsx` — 5 preset ratios (16:9, 1:1, 9:16, 4:3, 3:4)
  - `QuantitySelector.tsx` — 1-4
  - `RunControls.tsx` — sticky bottom, sequential/parallel toggle, quota hint, Start/Stop button
  - `GenTab.tsx` — full layout
- [x] Replaced `GenerateTab` placeholder
- [x] i18n keys `generate.*` cho vi/en/th/ja

### Chunk 2.4 — Mock generation pipeline + live status ✅
- [x] `src/features/generate/hooks/useGeneration.ts` — `start()` flow: parse prompts → ExecutionLock.tryAcquire → ExecutionGate.request → loop adapter.submitPrompt (sequential/parallel) → ExecutionGate.complete. `stop()` aborts run + calls cancel.
- [x] `src/features/generate/components/ResultTilesGrid.tsx` — per-prompt card với status icon + tile thumbnails
- [x] Quota enforcement working end-to-end: free user (5 chatgpt_run/day) sẽ thấy QUOTA_EXCEEDED khi vượt; pro user (200/day) thoải mái

### Chunk 2.5 — Storage foundation (Dexie) ✅
- [x] [src/storage/db.ts](src/storage/db.ts) — bumped to v2 schema (drop Phase 0 stubs, add `image_blobs` (3-tier), `album_images`, `albums`). TTL defaults exported (`BLOB_TTL`).
- [x] [src/storage/stores/ImageStore.ts](src/storage/stores/ImageStore.ts) — `put / get / getBlob / delete / cleanupExpired / stats` per-tier with `${imageId}__${tier}` keying
- [x] [src/storage/stores/BlobUrlManager.ts](src/storage/stores/BlobUrlManager.ts) — refcounted `URL.createObjectURL` lifecycle + `beforeunload` revoke safety net

### Chunk 2.6 — RefImagePicker ✅
- [x] [generate.store.ts](src/features/generate/store/generate.store.ts) — `refImages` slice + `addRefImage / removeRefImage / clearRefImages`
- [x] [useRefImages](src/features/generate/hooks/useRefImages.ts) — wraps add/remove with ImageStore.put + BlobUrlManager.acquire (and the reverse on remove). Uses `createImageBitmap` for width/height detection.
- [x] [RefImagePicker.tsx](src/features/generate/components/RefImagePicker.tsx) — drag-drop overlay + Ctrl+V paste handler (window-level) + file input + thumbnail grid + per-image remove button. Enforces `max_ref_images` from SystemConfig (default 10). Hidden when `ref_images` feature flag is off.
- [x] Wired into GenTab between Provider section and ResultTilesGrid
- [x] useGeneration now passes `refFileIds: refImages.map(r => r.id)` to adapter.submitPrompt
- [x] i18n keys `refImages.*` cho 4 ngôn ngữ

### Chunk 2.7 — UI parity với TobyFlow screenshot ✅
**2.7a — Tab bar icons + 2 tab mới:**
- [x] [SIDEBAR_TABS](src/store/app.store.ts) order theo screenshot: Gen → Workflow → Prompts → Tasks → Photos → Snippets → History → Logs
- [x] Icon mapping (Sparkles/Workflow/MessageSquare/ListChecks/Image/Cloud/History/Terminal) trong [TabRouter](src/pages/sidebar/TabRouter.tsx)
- [x] [PromptsTab](src/pages/sidebar/tabs/PromptsTab.tsx) + [SnippetsTab](src/pages/sidebar/tabs/SnippetsTab.tsx) placeholders
- [x] i18n keys mới cho 4 locale (tabs.prompts, tabs.snippets, tabs.generate=Gen, tabs.multiTask=Tasks)

**2.7b — Header polish:**
- [x] [PlanBadge.tsx](src/features/auth/components/PlanBadge.tsx) — FREE/TRIAL/PRO/TEAM pill từ useEntitlements, gradient on Pro
- [x] [NotificationBell.tsx](src/features/notifications/NotificationBell.tsx) — Bell icon + badge dot + dropdown empty state (Phase 4 SSE wire-up)
- [x] [StatusDot.tsx](src/features/auth/components/StatusDot.tsx) — Green/red/gray dot bound to navigator.onLine + auth state
- [x] [PromptsPanelButton.tsx](src/features/auth/components/PromptsPanelButton.tsx) — FileText icon shortcut → switches to Prompts tab
- [x] i18n: notifications.{label,empty,phaseHint}, header.openPrompts

**2.7c — Project Indicator row:**
- [x] [project.store.ts](src/features/projects/project.store.ts) — Zustand: projects, currentProjectId, setCurrent / create / delete + hydrate from chrome.storage
- [x] [ProjectIndicator.tsx](src/features/projects/ProjectIndicator.tsx) — 32px row, current project dropdown + "+" inline create + per-item delete
- [x] Wired between header (top:48) and tab bar (top:80) in TabRouter
- [x] i18n: projects.{switchHeader, namePlaceholder, empty, create}

**2.7d — Gen tab gaps:**
- [x] Multi-Prompt toggle in [PromptArea](src/features/generate/components/PromptArea.tsx) + count format "N prompt → M output(s)"
- [x] [PromptToolbar.tsx](src/features/generate/components/PromptToolbar.tsx) — Library (→ Prompts tab) + Chat AI (placeholder alert) + Import .txt (real file reader) + Save prompt (placeholder)
- [x] [StyleSelector.tsx](src/features/generate/components/StyleSelector.tsx) — 6 mock presets (Tắt/Natural/Cinematic/Anime/Realistic/Stylized) with moon icon
- [x] [QuantitySelector.tsx](src/features/generate/components/QuantitySelector.tsx) refactored to **-/+ stepper** with provider max_quantity cap + hard cap 12
- [x] [AutoDownloadRow.tsx](src/features/generate/components/AutoDownloadRow.tsx) — toggle + folder input + 1K/2K/4K dropdown (4K gated by `auto_download_4k` feature)
- [x] [RefImagePicker.tsx](src/features/generate/components/RefImagePicker.tsx) — added search input + "Tất cả/Mới nhất/Ảnh lớn" filter dropdown + floating Camera capture button (placeholder)
- [x] "Cài đặt" section header với Settings2 icon in [GenTab](src/features/generate/components/GenTab.tsx)
- [x] Store extended: multiPrompt, downloadFolder, downloadResolution, stylePreset
- [x] i18n: generate.{promptShort, outputShort, multiPromptToggle, settingsSection, styleLabel, autoDownload, folderPlaceholder, resolutionLabel, toolbar.*}, refImages.{capture, captureComingSoon, emptyHint, searchPlaceholder, filterLabel, filterAll, filterRecent, filterLarge}

**2.7e — Footer bar + Generate gradient:**
- [x] [SidebarFooter.tsx](src/pages/sidebar/SidebarFooter.tsx) — 32px sticky bottom across all tabs: Upgrade button (gradient, hidden for paid), Download status pill, Retry status pill, daily quota counter (warn when ≤5 left), batch counter, refs counter
- [x] [RunControls.tsx](src/features/generate/components/RunControls.tsx) — gradient `from-emerald-400 via-amber-300 via-orange-400 to-rose-400` Generate button with optional prompt count badge
- [x] i18n: footer.{download, retry}

### Still deferred
- [ ] **MentionHelper** — `@ref1` syntax in prompts (docs/05 §2)
- [ ] **Real Flow DOM bridge** — content/flow.ts + slate-bridge.ts wire-up. Will consume `useProviderDomSelectors()` data. Test target: labs.google/fx — requires extension installed.
- [ ] **FlowSession.tileResolve** — POST /flow/tile-resolve để map file_name → tile_id. Mock route chưa thêm.
- [ ] **Settings 2-tier sync** (TIER 1 LIVE + TIER 2 RESPECTFUL)
- [ ] **Real auto-download** — UI present (toggle, folder, resolution), but the chrome.downloads.download wire-up still pending (need extension context).
- [ ] **Per-prompt video frames** (chỉ hiện khi mediaType=video)
- [ ] **Real Chat AI enhance** — toolbar button is placeholder; Phase 4 wires ChatGPT/Gemini enhance prompt flow
- [ ] **Real screen capture** — toolbar Camera button placeholder; Phase 6 ships full screen-capture overlay → /capture/upload
- [ ] **Save prompt to library** — toolbar bookmark placeholder; Phase 6 wires real /prompts POST + Prompts tab content
- [ ] **Ref image upload to provider** — Flow expects refs uploaded via tRPC and references by `file_name` UUID. Mock path skips this. Real Flow integration will require background upload + uploaded_cache table.
- [ ] **Real SSE notifications** — bell has badge but no real push; Phase 4 wires real-time delivery
- [ ] **Project list from server** — Phase 2.7 uses mock fixtures. When `/flow/projects` endpoint exists, swap useProjectStore source to TanStack Query.

### Acceptance criteria (Phase 2 toàn bộ — current state)
- 🟡 User type 5 prompts → click Generate → mỗi prompt gửi sang Flow tab — **mock only** (picsum placeholder; real DOM bridge defer)
- ✅ Ref images: pick (file input) + paste (Ctrl+V) + drag-drop. Persist Dexie. Upload-to-Flow defer.
- ✅ Quota exhausted → run cards show error message — denied dialog là Phase 5
- ✅ Stop → in-flight prompt finish nhưng không submit thêm (sequential mode)
- ❌ Auto-download — **chưa làm** (cần ImageStore + chrome.downloads in extension)

---

## Phase 3 — Workflow editor + engine 🔒

(Detail copy khi vào phase.)

---

## Phase 4 — Multi-provider + SSE 🟡

Roadmap: [docs/12 §Phase 4](docs/12-implementation-roadmap.md). Reference: `reference-ext/src/core/{ChatGPTSession,GrokSession,GeminiSession,SseClient,SseBroadcastManager}.js` + `chat-content-{chatgpt,grok,gemini}.js` + `content.js` + `slate-bridge.js`.

### Chunks

| # | Chunk | Estimate | Reference-ext |
|---|---|---|---|
| P4.1 | ChatGPT DOM adapter | 2d | `ChatGPTSession.js` (477) + `chat-content-chatgpt.js` (2900) |
| P4.2 | Grok DOM adapter | 1.5d | `GrokSession.js` + `chat-content-grok.js` |
| P4.3 | Gemini DOM adapter | 1.5d | `GeminiSession.js` + `chat-content-gemini.js` |
| P4.4 | Flow tile bridge real | 2d | `content.js` + `slate-bridge.js` + `FlowSession` |
| P4.5 | SSE client + broadcast | 2d | `SseClient.js` + `SseBroadcastManager.js` |
| P4.6 | Executor → ProviderRegistry | 1d | — |

### P4.1 — ChatGPT DOM adapter

**Done = ALL true:**
- [ ] `src/providers/sessions/ChatGPTSession.ts` — class quản lý 1 tab ChatGPT: `initialize / submitPrompt(text, options) / cancel / dispose`. Mirror logic của `reference-ext/src/core/ChatGPTSession.js`.
- [ ] `src/content/chatgpt.ts` — content script inject vào `https://chat.openai.com/*` + `https://chatgpt.com/*`. Bridge DOM ↔ background qua chrome.runtime messages (`gen:submit`, `gen:result`, `gen:cancel`, `gen:status`).
- [ ] Selectors lấy từ `useProviderDomSelectors()` (mock có sẵn ở P2.1) — KHÔNG hardcode CSS selectors trong code TS.
- [ ] `ChatGPTAdapter` extend `AIProviderAdapter`: `ensureTab()` tìm/mở chat.openai.com tab, `submitPrompt()` postMessage → content script.
- [ ] Đăng ký vào `ProviderRegistry` thay `FlowAdapter` mock.
- [ ] Acceptance manual: mở extension thật, gen 1 prompt qua ChatGPT, ảnh xuất hiện đúng trong Generate tab tile grid.
- [ ] E2E: `tests/e2e/chatgpt-adapter.spec.ts` — mock chat.openai.com tab bằng fixture HTML, verify content script tìm đúng input element + click submit.
- [ ] Edge cases handle (theo reference): rate limit (`RATE_LIMIT`), content blocked (`CONTENT_BLOCKED`), image gen failed (`IMAGE_GEN_FAILED`), network (`NETWORK`).
- [ ] Cancellation: gọi `cancel()` → click ChatGPT Stop button + delete last assistant message + abort signal.
- [ ] Ref images upload (multipart) — defer to P4.1b nếu time-box căng.
- [ ] Build pass: `npm run typecheck && npm run build && npm run test:e2e` xanh.

**Subchunks** (chia nhỏ để verify từng bước):
- [x] **P4.1a — `ChatGPTSession.ts` class skeleton + state machine** ✅ (task #103). Done = ALL true:
  - [x] `src/providers/sessions/chatgpt.types.ts` — types (`ChatGPTRatio`, `ChatGPTSubmitOptions`, `ChatGPTSubmitResult`, `ChatGPTErrorCode`, `ChatGPTBgAction`, `ChatGPTBgResponse`, `ChatGPTBroadcast`, event map) + `CHATGPT_RATIO_TO_ARIA` const + `ChatGPTError` class
  - [x] `src/providers/sessions/ChatGPTSession.ts` — instance class (KHÔNG static singleton như reference) với public API: `ensureReady / activateImageMode / selectRatio / submitPrompt / cancel / dispose / on(event,handler)` + `_peekState()` test introspection
  - [x] State machine: tabId / ready / lastReadyCheck (60s TTL) / imageModeActive / currentRatio / activateFailCount / fallbackPrefixMode (5min window)
  - [x] Chrome API injection qua constructor (`chromeApi?` param) cho testability — không hardcode `globalThis.chrome`
  - [x] Event emitter pattern (Map<event,Set<handler>>) replace `window.eventBus` của reference
  - [x] AbortSignal support trong `submitPrompt` qua Promise.race
  - [x] Background broadcast listener (`tabClosed`, `navigatedBroadcast`) bound 1 lần lazy
  - [x] 17 unit tests pass (vitest 12ms): happy path, cache hit 60s, NO_TAB, NOT_LOGGED_IN + login_required event, silent mode, image mode activation, fallback after 2 fails, ratio auto-activates, submit happy + fallback prefix + abort + empty prompt, lifecycle (cancel no-tab, dispose blocks, listener unsubscribe, tabClosed reset)
  - [x] TS check + vite build pass
- [x] **P4.1b — `content/chatgpt.ts` selector helpers** ✅ (task #104). Done = ALL true:
  - [x] Inject guard `window.__h2flowChatGPTLoaded__` ngừng load 2 lần
  - [x] Cache provider configs từ `chrome.storage.local.h2flow_provider_configs` + TTL 60s + invalidate qua `chrome.storage.onChanged`
  - [x] `getSelectorsForKey(key)` — Server-Only, KHÔNG hardcoded fallback (theo `reference-ext` 2026 decision)
  - [x] `queryWithFallback(key, options)` — try-catch invalid selector, silent option chống spam log khi poll
  - [x] `queryAllWithFallback(key, options)` — collect tất cả match từ 1 selector
  - [x] `waitForElement(key, options)` — poll 200ms, timeout 10s, AbortSignal support
  - [x] `simulateClick(el)` — full pointer+click chain (pointerdown/mousedown/pointerup/mouseup/click) cho React synthetic event
  - [x] `checkAbort(stage)` — sync throw khi abort flag set qua `chrome.storage.local.h2flow_abort_active`
  - [x] Navigate tracking — wrap `history.pushState/replaceState` + `popstate` → emit `chatgpt:navigated` lên background
  - [x] Message handler skeleton: `chatgpt:ping`, `chatgpt:checkLogin` (full submit flow → P4.1c)
  - [x] Test-only `__test` API: `reset()`, `setConfigCache()`, `setAbort()` cho injection trong vitest
  - [x] `vitest.config.ts` setup — node default env, jsdom opt-in via docblock
  - [x] 13 unit tests pass (vitest jsdom env 530ms): getSelectorsForKey ×2, queryWithFallback ×3, queryAllWithFallback ×2, waitForElement ×3 (timeout + abort), simulateClick chain, checkAbort ×2
  - [x] TS check + vite build pass (workflow-editor 186.98 KB gzip không đổi vì content script chunked riêng)
- [x] **P4.1c — Submit prompt flow content script** ✅ (task #105). Done = ALL true:
  - [x] `activateImageMode()` handler — click composer plus → wait `create_image_menu_item` menu (3s) → click → verify ratio control hiện ra
  - [x] `selectRatio(ariaLabel)` handler — duyệt `ratio_control` candidates, click button có aria-label khớp
  - [x] `submitPromptFlow(text, timeoutMs)` handler — find composer → baseline existing CDN file_ids → clearEditor → insertText → submitText → waitForNewCdnImages → return imageUrls
  - [x] `cancelFlow()` handler — click `stop_button` nếu found (return `stopped: true/false`)
  - [x] `clearEditor(el)` — Tier 1: execCommand selectAll+delete (skip nếu empty để không phá ProseMirror state); Tier 2 fallback: innerHTML `<p><br class="ProseMirror-trailingBreak"></p>` + InputEvent deleteContent
  - [x] `insertText(el, text)` — Tier 1 ClipboardEvent paste với DataTransfer; Tier 2 execCommand insertText; Tier 3 last resort innerHTML escape; **CRITICAL**: dispatch InputEvent `insertFromPaste` cuối để React ProseMirror onChange sync state
  - [x] `submitText(el)` — Tier 1 KeyboardEvent Enter (keydown+keypress+keyup); Tier 2 click submit button; verify qua editor empty-check
  - [x] `waitForNewCdnImages(baseline, timeoutMs)` — poll 500ms, parse `file_id` từ src regex `/[?&]id=(file_[a-z0-9]+)/i`, skip `.blur-2xl` placeholder; heartbeat 60s: nếu indicator gen tắt > 60s mà chưa có ảnh → `IMAGE_GEN_FAILED`; timeout → `TIMEOUT`
  - [x] Mock backend selectors rich shape: `MOCK_PROVIDER_DOM_SELECTORS.chatgpt.selectors = { prompt_textarea, composer, submit_button, stop_button, login_button, composer_plus_button, create_image_menu_item, ratio_control, cdn_image, generating_indicator }` với array selectors mỗi key
  - [x] TDZ fix: move `bootstrap()` invocation xuống cuối file để `_configCache`/`_abortCache` declared trước khi bootstrap chạy
  - [x] 7 new handler tests pass + 13 helper tests retained = 20/20 content + 17 session = **37 unit tests pass** (vitest 2.2s)
  - [x] TS check + vite build pass
- [x] **P4.1d — Background handler bridge** ✅ (task #106). Done = ALL true:
  - [x] `src/background/chatgpt-bridge.ts` — `handleChatGPTBgMessage(request, api?)` dispatcher với 9 actions
  - [x] `findOrCreateTab` — `chrome.tabs.query({url:'*://chatgpt.com/*'})` → reuse OR `chrome.tabs.create({url:'https://chatgpt.com/'})`. Activate qua `tabs.update` nếu `payload.activate`
  - [x] `ensureActive` — `chrome.tabs.update(tabId, {active:true})` + optional `chrome.windows.update({focused:true})` qua `payload.focusWindow`
  - [x] `injectScript` — verify-by-ping (KHÔNG dùng `chrome.scripting.executeScript` vì content script đã static-registered trong manifest). Ping loop tối đa 8s, retry 400ms. Trả `INJECT_FAILED` nếu timeout
  - [x] Relay handlers (`checkLogin`, `activateImageMode`, `selectRatio`, `submitPrompt`, `cancel`) — forward qua `chrome.tabs.sendMessage(tabId, {action, payload})`, trả `NO_TAB` nếu missing tabId, `NO_RESPONSE` nếu content không respond
  - [x] Inbound handler `chatgpt:navigated` (từ content script) — re-broadcast `chatgpt:navigatedBroadcast` qua `chrome.runtime.sendMessage` để sidebar's ChatGPTSession reset image mode cache
  - [x] `registerChatGPTBridge()` — `chrome.tabs.onRemoved.addListener` → broadcast `chatgpt:tabClosed` lên sidebar. Idempotent (`_registered` flag)
  - [x] Wire vào `background/index.ts`: dispatch all `action.startsWith('chatgpt:')` → `handleChatGPTBgMessage` (prefix-based, không cần thêm vào `ExtensionMessage` union)
  - [x] `ChromeBgSurface` interface injectable cho test — KHÔNG hardcode `globalThis.chrome`
  - [x] 15 unit tests pass: findOrCreateTab (existing/create/NO_TAB/activate) × 4, ensureActive × 2, verifyByPing (success/INJECT_FAILED timeout) × 2, relay (checkLogin/submitPrompt/NO_TAB) × 3, navigated broadcast, onRemoved → tabClosed broadcast, UNKNOWN_ACTION, CHROME_API_UNAVAILABLE
  - [x] Test mock chrome stub: in-memory tabs array với URL pattern matching, queueMicrotask cho async cb, per-tab response handler injection
  - [x] **Total tests: 52/52 pass** (17 session + 20 content + 15 bridge) ~8.6s
  - [x] TS check + vite build pass
- [ ] P4.1e — `ChatGPTAdapter` extends `AIProviderAdapter`, wire vào ProviderRegistry, manual test extension thật

---

## Phase 5 — Billing + Telegram 🔒

(Detail copy khi vào phase.)

---

## Phase 6 — Polish + remaining tabs 🔒

(Detail copy khi vào phase.)

---

## Decision log

Ghi lại các quyết định KHÔNG hiển nhiên — để tránh hỏi lại ở session sau.

| Date | Decision | Why |
|---|---|---|
| 2026-05-28 | Scaffold trực tiếp ở root `F:\Project\h2-flow\`, KHÔNG đẻ subfolder `app/` | Root chỉ có duplicates rỗng (0 byte), `reference-ext/` đã giữ snapshot riêng → root sạch sau cleanup, đúng với [docs/04 §Project Structure](docs/04-project-structure.md) (assume src/ ở root) |
| 2026-05-28 | Project name: `h2-flow` (theo tên folder, không phải `tobyflow-clone` như docs/03 mẫu) | User chọn |
| 2026-05-28 | Manifest icons trỏ `icons/icon-{size}.png` (KHÔNG `public/icons/...` như docs/03 mẫu) | Tránh duplicate ở dist (Vite tự copy `public/` về dist root) |
| 2026-05-28 | tsconfig.json `include: ["src/**/*"]` only — vite/manifest/tailwind config nằm trong tsconfig.node.json | Tránh "TS6305 already built" do double-include khi composite project |
| 2026-05-28 | Tạo [CLAUDE.md](CLAUDE.md) ở root với rule "khi nghiệp vụ chưa rõ → đọc `reference-ext/`" | User yêu cầu; CLAUDE.md auto-load mỗi session |
| 2026-05-28 | Drop `tailwindcss-forms` plugin nếu không cần — tạm giữ trong deps | Sẵn config mẫu docs/03 dùng, có thể remove về sau nếu không dùng form-element styling |
| 2026-05-28 | Vite `rollupOptions.output.entryFileNames` + `chunkFileNames` thay `.` bằng `_` trong chunk name (vd: `flow.ts-...js` → `flow_ts-...js`) | Chrome MV3 reject manifest khi `content_scripts[].js` chứa filename có >1 dấu `.` (lỗi "Could not load javascript ... for script. Could not load manifest"). Fix ở [vite.config.ts](vite.config.ts) |
| 2026-05-28 | **HMAC contract theo `reference-ext`, KHÔNG theo docs/08** | docs/08 viết `X-Ext-Id`/`X-Ext-Sig`/`X-Ext-Ts` + base64 + ms timestamp + message `${method}\n${path}\n${body}\n${ts}`. Production thực ra dùng `X-Client-Id`/`X-Timestamp`/`X-Signature` + hex + seconds + message `${ts}:${METHOD}:${path}:${sha256(body)}` (xem [reference-ext/src/core/RequestSigner.js](reference-ext/src/core/RequestSigner.js)). Theo CLAUDE.md rule "mâu thuẫn nghiệp vụ → theo reference-ext". |
| 2026-05-28 | Secret/client_id lấy từ enrollment (`chrome.storage.local.toby_client_enrollment`); dev fallback dùng `VITE_EXT_ID`+`VITE_EXT_SECRET` từ env | Real enrollment endpoint POST `/enrollment/enroll` chưa implement. Để dev test signing path mà không cần backend, fallback dùng env vars trong `src/background/enrollment.ts`. Khi không có cả 2 → `buildSignatureHeaders()` trả `{}` (calls đi không sign — anonymous endpoints OK; signed endpoints sẽ 401/403 từ backend) |
| 2026-05-28 | Token KHÔNG đọc từ background storage trong apiRequest — sidebar pass token mỗi call | Mirror reference-ext AuthManager: sidebar là single source of truth cho session, background chỉ là dumb proxy. Tránh race condition giữa logout (clear storage) + in-flight call (background đọc storage cũ) |
| 2026-05-28 | 401 refresh-retry xử lý ở sidebar (AuthService.restoreSession) không phải background | Như reference-ext. Cho phép `AuthService.refresh()` single-flight + state quản lý ở 1 chỗ. Background chỉ relay HTTP status |
| 2026-05-28 | `chrome-storage` helper relax type về `unknown`, không enforce JSON shape | StorageValue strict type quá hẹp cho `AuthSession` (interface chứ không index-signature). Đơn giản hóa: caller pass T generic, storage round-trip qua JSON. Vẫn type-safe ở mức call site |
| 2026-05-28 | **Mock backend trong-process** (`src/background/mock/`), KHÔNG dùng MSW | MSW cần register Service Worker riêng → conflict với extension SW (background.js). In-process mock intercept trong `api-proxy.handleApiRequest` đơn giản, type-safe, không thêm dependency. Toggle qua `VITE_USE_MOCK` env var. |
| 2026-05-28 | i18n bundle 4 locale local TRƯỚC, không fetch `/i18n/{locale}` từ server ngay | Tránh blank screen lúc cold boot (server có thể chậm hoặc unavailable). Phase 6 polish sẽ wire HTTP loader để merge server translations sau khi local resources init. Reference: reference-ext có `loading-i18n.js` cũng dùng pattern này. |
| 2026-05-28 | Anti-clone detection ở client (api/client.ts), not background | Tất cả request đi qua background.handleApiRequest, NHƯNG flag set sau response qua chrome.storage. Client (sidebar/popup) gọi `setCloneDetected(true)` qua chrome.storage.local — background listener không cần biết. Đơn giản hơn 1 message round-trip. |
| 2026-05-28 | Self-heal probe gọi `handleApiRequest()` trực tiếp (in-process), không qua `chrome.runtime.sendMessage` | Probe chạy trong background SW context, đã có function in scope. Tránh thừa 1 round-trip message. |
| 2026-05-28 | OfflineOverlay + CloneDetectedOverlay bundle trong RootOverlays mounted ở mọi page (sidebar + 4 popup) | Khi extension bị reject, mọi UI surface phải block — kể cả popup đang mở. Overlays render conditional, no-op khi không cần. |
| 2026-05-28 | Manifest content_script cho oauth-bridge hard-code domain placeholder | CRXJS manifest tĩnh, không thể suy ra từ env tại build time. Phải edit tay khi đổi backend domain — note trong PROGRESS Known issues. |
| 2026-05-28 | Mock module move `src/background/mock/` → `src/api/mock/` + dual dispatch path | User muốn test UI trong browser tab thường (không cần load extension). Sidebar không gọi được `chrome.runtime.sendMessage` ngoài extension → cần dispatch mock thẳng trong page. Move ra `src/api/mock/` để cả background SW lẫn sidebar đều import được. `api/client.ts` thêm `isExtensionContext()` check → fallback. `npm run dev:web` mở `localhost:5173/sidebar.html`. |
| 2026-05-28 | Entitlements mock include BOTH docs/08 keys AND reference-ext convention keys | docs/08 dùng `workflow_run`, `chatgpt`, `grok`, ... reference-ext dùng `gen_enabled`, `chatgpt_enabled`, `workflows_enabled`, ... Mock include cả 2 để mọi caller hoạt động — không phải sửa khi swap. useFeatureGate.canUse(key) chỉ lookup `features[key].enabled`, agnostic theo naming. |
| 2026-05-28 | FlowAdapter Phase 2 mock-only — `submitPrompt()` trả picsum.photos placeholder | Real DOM bridge cần test trên labs.google/fx (extension thật + user mở tab). Phase 2 ship full UI + mock pipeline để verify end-to-end UX trước. Phase 4 hoặc follow-up sẽ wire real `gen:submit`/`gen:result` message với content/flow.ts + slate-bridge.ts. |
| 2026-05-28 | Mock quota enforced với in-memory counter, refund on cancel | `MOCK_QUOTA_USED: Map<action, count>` tracks usage trong SW lifetime. `executionRequest` check used+promptCount ≤ limit → 403 QUOTA_EXCEEDED. `executionCancel` refund. Reset khi background SW restart hoặc dev page reload — đủ cho dev test. Production backend phải có DB-backed quota. |
| 2026-05-28 | Dexie v2 migration drops Phase 0 stub tables (`images`, `thumbnails`) | Phase 0 schema was placeholder. Real schema needs `image_blobs` keyed by `${id}__${tier}`. v2 upgrade drops stubs (no real data lived there). User dev DBs upgrade cleanly trên reload. |
| 2026-05-28 | RefImage stored at `thumbnail` tier (not all 3 tiers) | User-uploaded ref images là source assets — không có tier "medium"/"original" theo provider CDN. Lưu tại `thumbnail` để áp dụng TTL 30d. Khi upload-to-Flow integration land sẽ swap sang `original` tier hoặc move to `pending_uploads`. |
| 2026-05-28 | RefThumb prop named `image` not `ref` | React's special `ref` prop conflicts; using `image` avoids "Function components cannot be given refs" warning + keeps the component plain. |
| 2026-05-28 | UI parity Phase 2.7 — sai khác screenshot vs spec | docs/05 §1 spec 6 tab; TobyFlow screenshot có 8 tab (thêm Prompts + Snippets). Theo screenshot vì user cung cấp = ground truth UI cuối. Spec docs/05 hơi cũ. |
| 2026-05-28 | Multi-Prompt là toggle explicit, không auto-detect newlines | docs/05 §2 vốn auto-detect. Screenshot có toggle riêng → user kiểm soát rõ ràng. `parsePrompts(text, multi)`: multi=false → toàn bộ textarea 1 prompt; multi=true → split newlines. |
| 2026-05-28 | Quantity stepper -/+ thay vì 1-4 pills, hard cap 12 | Screenshot dùng stepper với input số. Cho phép vượt 4 nếu provider hỗ trợ (mock max_quantity từ /providers/api-configs). Hard cap 12 để tránh request bừa khi future provider không cap. |
| 2026-05-28 | StatusDot, NotificationBell, PromptsPanelButton, screen capture, Chat AI — placeholder cho Phase 4+ | UI affordances ready để user thấy đầy đủ surface. Real wire-up khi backend/SSE/content script sẵn sàng. Click vào placeholder cho thấy alert "coming soon" để user biết. |
| 2026-05-28 | Tab bar sticky `top-[80px]` thay vì `top-12` | Header 48px + ProjectIndicator 32px = 80px. Phải override tailwind class arbitrary value. Khi không có ProjectIndicator phải revert về top-12 (Phase 2.7 luôn render). |
| 2026-05-28 | Tài liệu chi tiết feature đi vào `docs/features/` 8 file (không gộp 1 file lớn) | User chọn split-per-feature. Mỗi file `<NN>-<area>.md` chứa action + happy + 2-3 case lỗi chính theo CLAUDE.md rule (cite reference-ext). README index liệt kê + nguyên tắc cite. `docs/11-features-spec.md` giữ làm overview cấp cao, không xoá. |
| 2026-05-29 | **Brand color đổi từ blue `#3186FF` → coral (light) + violet (dark)** theo Claude Design handoff `_Kvo11iy8YaXnTC3jFmhjQ` | User chọn ưu tiên Claude Design link. Violet `#9177e1` trùng `node.generate` đã có → kế thừa, không phá hệ thống diagram. Coral `#de6b4a` chỉ áp light mode. Tokens đặt theo contract shadcn (`--background`, `--primary`, `--card`…) để shadcn/ui component plug-and-play. Bundle gốc lưu `docs/design-handoff/` để tra cứu lịch sử. |
| 2026-05-29 | Giữ **legacy aliases** (`bg-bg-base`, `text-text-1`, `bg-brand-500` …) trỏ về vars mới thay vì refactor 71 file | 218 occurrences across 71 files. Hard rename rủi ro cao trong khi visual end-state đã đúng (cùng giá trị). CSS vars `--bg-base` / `--text-1` / `--brand-500` đều derive từ cùng HSL block. Migrate dần khi sửa file kế tiếp — không bắt buộc. |
| 2026-05-29 | Font display = **Playfair Display** (không Instrument Serif) | Instrument Serif thiếu glyph dấu thanh tiếng Việt ("Gà ̀n" hiển thị tách dấu). Playfair Display có đủ subset Vietnamese, italic đẹp, cùng feel "studio" như prototype. Load qua Google Fonts CDN trong 5 HTML entries (sidebar + 4 popup). |
| 2026-05-29 | **KHÔNG dùng container queries** (`@[480px]:` syntax) ở P2.7 swap, dùng `sm:`/`md:` Tailwind responsive | Plugin `@tailwindcss/container-queries` chưa cài; thêm dep + breakpoint mới làm tăng risk. Sidebar côi-kéo theo viewport (chrome side panel = viewport) nên `sm:` (640) / `md:` (768) breakpoint khớp. Khi cần container-level (vd: Recent grid cols độc lập), sẽ thêm `useContainerWidth` hook ResizeObserver — đã spec ở `00-design-system.md §7`. |
| 2026-05-29 | Tách `PromptCard` (mới) khỏi `PromptArea` + `PromptToolbar` (cũ, giữ lại làm legacy) thay vì sửa tại chỗ | `PromptCard` merge cả 3 khối (Area + Toolbar + Tạo) vào 1 card rounded-xl theo Claude Design. `PromptArea.tsx` + `PromptToolbar.tsx` không còn import ở GenTab — giữ nguyên file để legacy History tab hoặc Multi-task có thể dùng (chưa quyết xoá). |
| 2026-05-29 | Mode toggle (Tuần tự/Song song) chuyển từ RunControls bottom → settings strip inline | Theo screenshot Claude Design. "Chế độ" là cài đặt, không phải action — đặt cạnh Model/Tỉ lệ/Số lượng hợp lý hơn. RunControls còn duy nhất nút Stop khi running, idle → return null. |
| 2026-05-29 | ResultTilesGrid render 4 placeholder gradient cards khi `runs.length === 0` | UX trống quá nếu Recent ẩn hẳn. Gradient violet 4 cards "h2flow-00..03" + "Xem tất cả →" gợi space cho results future. Khi user generate xong → swap về live run cards. |
| 2026-05-29 | **Default theme đổi 'auto' → 'dark'** (theo Claude Design target) | Hero violet `#9177e1` và placeholder gradients violet→pink chỉ "đẹp" trong dark mode. Light coral cũng OK nhưng không phải target. User toggle (đã có nút trong header) vẫn persist như cũ — chỉ first install / storage empty fallback dark. |
| 2026-05-29 | Anti-FOUC inline script trong 5 HTML entries, dùng `localStorage` (sync) thay vì `chrome.storage` (async) | `ThemeProvider` đọc `chrome.storage.local.af_theme` async qua `useEffect` — load xong mới apply class → flash light. Inline script trong `<head>` đọc `localStorage` sync trước React, áp `.dark` ngay. `ThemeProvider` vẫn dùng chrome.storage làm source of truth (cross-context sync); script chỉ là "first paint" hint. Default = dark khi localStorage rỗng. |
| 2026-05-29 | Ẩn scrollbar global (Firefox `scrollbar-width: none` + Chromium `::-webkit-scrollbar`) | Side panel co-kéo + content scroll nhiều chỗ → scrollbar trông xấu. Vẫn scroll được bằng wheel/touch/keyboard. Áp cho html/body/* để phủ luôn textarea/dropzone/tab strip. Class `.scrollbar-none` utility giữ cho future override. |
| 2026-05-29 | Textarea PromptCard dùng `style={{ minHeight: 180 }}` inline + `text-[15px] leading-[1.55]` arbitrary value (KHÔNG dùng custom `text-input` token) | `text-input` custom font-size token có thể bị Tailwind purge edge-case khi đụng built-in selector. Inline style đảm bảo height 180px regardless of CSS conflict (kể cả `@tailwindcss/forms` reset). Tradeoff: ít elegant hơn class semantic, nhưng bulletproof. |
| 2026-05-29 | Advanced row tách thành component `AdvancedRow.tsx` riêng | Trước: chỉ render `AutoDownloadRow` cũ (toggle + folder + dropdown). Sau: card `bg-secondary/30` với filename `/___.png` font-mono + segmented Auto-download Tắt/Bật + segmented Quality 1K/2K/4K. Bỏ Select dropdown → segmented buttons khớp Claude Design. Xoá `AutoDownloadRow.tsx` (orphan). |
| 2026-05-29 | Đóng Phase 2 ✅ — không "follow-up" sang sau | Phase 2 spec từ docs/12 chỉ yêu cầu UI skeleton + mock pipeline. UI parity (P2.7) + Claude Design refactor + gap close là extra cho user demo. Real Flow DOM bridge / auto-download / capture / Chat AI thuộc P4-P6 — không kéo dài Phase 2 nữa. Phase 3 (Workflow editor) bắt đầu sạch sẽ. |
| 2026-05-29 | Dùng `reactflow` v11 (legacy package), KHÔNG migrate sang `@xyflow/react` v12 | `reactflow` đã có trong `package.json` từ Phase 0 scaffold. v12 đã rebrand nhưng API gần như tương thích — chuyển khi cần Pro features. Tránh churn deps khi Phase 3 đang chạy. |
| 2026-05-29 | Snapshot history dùng `structuredClone` thay vì immer | Đơn giản, không thêm middleware. Per-snapshot ~10-100 KB (nodes + edges JSON), tối đa 50 = 5 MB worst case. structuredClone fast hơn JSON.parse(JSON.stringify(...)) và preserve Date/Map nếu sau này dùng. |
| 2026-05-29 | Port type lookup qua DOM `data-port-type` attribute thay vì React state | React Flow `onConnect` callback chỉ cho `Connection {source, sourceHandle, target, targetHandle}` — không có type. Resolve type qua state lookup phải duyệt nodes mỗi lần. DOM query 1-liner: BaseNode set `data-port-type` lên Handle, executor query `[data-id="<node>"] [data-handleid="<port>"]`. Trade-off: phụ thuộc React Flow render xong, nhưng `onConnect` fire SAU render → an toàn. |
| 2026-05-29 | Cycle detection BFS trong store, KHÔNG ở React Flow validation | React Flow `isValidConnection` callback fire liên tục khi drag → BFS mỗi tick = expensive. Để callback chỉ check shape (non-null + khác node), commit time mới chạy BFS trong `addEdge` store action. Trade-off: user vẫn thấy cable "có thể nối" rồi connection reject im lặng — Phase 4 polish thêm toast. |
| 2026-05-29 | NodeInspector + DiagramCanvas share 1 ReactFlowProvider ở WorkflowEditor level | Cả 2 đọc selection / viewport state. Nếu DiagramCanvas tự wrap provider, Inspector nằm ngoài sẽ không thấy state. Move provider lên Editor → 2 child component đồng bộ. |
| 2026-05-29 | Workflow editor là popup window riêng (`chrome.windows.create type='popup'`), KHÔNG render trong sidebar | Sidebar quá hẹp (~480px) cho canvas + palette + inspector. Popup 1280×800 đủ rộng. Sidebar WorkflowTab chỉ làm danh sách + entry point. Fallback `window.open` cho dev:web (browser preview). |
| 2026-05-29 | **Tạm bỏ popup, render editor INLINE trong sidebar WorkflowTab** | User test dev:web mode khó debug khi editor mở tab mới — DevTools tab khác. Inline đơn giản hoá flow. Popup mode để P3.10+ khi build extension thật cần test side panel. |
| 2026-05-29 | **Khôi phục popup window mode + thêm localStorage persistence** | User yêu cầu workflow editor mở tab mới riêng. WorkflowTab list đọc từ `localStorage.af_wf_index`, "+ Workflow mới" → tạo doc + persist → `chrome.windows.create({ type: 'popup' })` (extension) / `window.open` (dev:web) với URL `?wf=<id>`. WorkflowEditorPage đọc id load từ persistence. WorkflowEditor auto-save subscribe Zustand → debounce 1s → `saveWorkflow` localStorage. Cross-tab sync qua `storage` event: tab list refresh khi tab editor save. Dexie migration để P3.10 khi cần >5MB. |
| 2026-05-29 | **Drag-drop bỏ HTML5 dataTransfer, dùng pointer events + CustomEvent** | HTML5 drag fail silently — `dragstart` fire nhưng `dragover`/`drop` không bao giờ trigger (browser cancel drag operation ngay lập tức, không rõ lý do — có thể React Flow internal stopPropagation hoặc CSS interference). Pointer-based: `pointerdown` trên palette set Zustand `draggingKind`, `document.pointermove` cập nhật pos, `document.pointerup` dispatch `CustomEvent('h2flow:drop')`. DiagramCanvas useEffect listen window event, check pointer position trong wrapper bounds, call `screenToFlowPosition` + addNode. Robust hơn nhiều, full JS control, không phụ thuộc browser HTML5 quirks. Side effect: thêm `draggingKind`/`draggingPos` vào store + DragGhost floating component (visual feedback). |
| 2026-05-29 | **Executor mock đọc/ghi trực tiếp qua Zustand, KHÔNG dispatch action queue** | Phương án 1 (action queue) cần thêm dispatcher + reducer middleware. Phương án 2 (executor gọi `store.setNodeStatus` trong loop) tận dụng React subscription sẵn có → mỗi setNodeStatus tự re-render BaseNode tương ứng. Trade-off: executor tightly coupled với store shape, nhưng Phase 3 chỉ có 1 executor → chấp nhận. Khi Phase 4 wire real provider, sẽ inject `ExecutorContext` abstract đứng giữa. |
| 2026-05-29 | **Runtime status (`status`, `errorMessage`, `outputPreview`) KHÔNG push history snapshot** | Mỗi tick executor cập nhật status → push snapshot = stack tràn nhanh + undo lùi cả status changes (vô nghĩa cho user). Tách 2 nhóm: structural mutations (add/remove/move/rename) → push; runtime mutations (`setNodeStatus`, `setNodeOutput`, `resetRunStatuses`) → bypass. `resetRunStatuses` cũng không push để Run lại không hiện thừa trong undo. |
| 2026-05-29 | **`addEdge` đổi từ `boolean` → discriminated `AddEdgeResult`** | Trước: caller chỉ biết "rejected" — không hiện được message rõ. Sau: `{ ok: true, edgeId }` hoặc `{ ok: false, reason: 'incompatible'\|'cycle'\|'duplicate'\|'no-workflow' }`. DiagramCanvas map reason → toast variant + message Vietnamese. Phase 4 thêm reason='quota' khi nối paid-provider mà user free. |
| 2026-05-29 | **Toast dùng global event bus thay vì React context** | Lý do: `showToast()` cần gọi được từ store actions, executor (non-React), và component. Context cần `useToast()` hook → chỉ component dùng được. CustomEvent `h2flow:toast` bắn từ bất kỳ đâu, `<ToastViewport>` subscribe ở root. Đánh đổi: không type-safe khi receiver dispatch sai shape, nhưng helper `showToast/dismissToast` wrap đủ. |
| 2026-05-29 | ~~**Skip P3.10 Dexie migration**~~ → **Đã làm**. User yêu cầu "hoàn thiện hết Phase 3" — close gap. Dexie v3 thêm bảng `workflows` (id, project_id, updated_at, created_at indexed). API persistence chuyển async. Migration localStorage → Dexie chạy 1 lần idempotent (flag `af_wf_migrated_to_dexie`). BroadcastChannel thay `storage` event (storage event chỉ fire khi localStorage key đổi — Dexie không touch localStorage). Bundle size không đổi vì Dexie đã có ở sidebar từ Phase 2 (ImageStore). |
| 2026-05-29 | **BroadcastChannel filter self qua `ORIGIN_ID`** | BroadcastChannel khác với `storage` event ở chỗ: tab origin CŨNG nhận message của chính nó (storage event chỉ fire tab khác). Để giữ behavior cũ (tab origin tự update qua React state, không cần message), thêm random `ORIGIN_ID` per tab, filter `evt.data.origin === ORIGIN_ID` trong subscriber. |
| 2026-05-29 | **Migration chạy lazy ở `ensureMigrated()` chứ KHÔNG ở Dexie `upgrade()` callback** | Dexie upgrade context không có sync access đến `localStorage` reliable. Hơn nữa nếu user mở 2 tab cùng lúc, cả 2 sẽ chạy upgrade → race. Lazy migration ở persistence module với singleton Promise (`migrationPromise`) → tab đầu mở chạy migration, các caller tiếp theo trong cùng tab await Promise đã resolved; tab thứ 2 thấy flag đã set thì no-op. |

---

## Known issues / TODO sau

Những thứ phát hiện nhưng chưa fix (đang scope ngoài current task):

- [ ] **CSP**: `content_security_policy.extension_pages` đang strict `script-src 'self'` — sẽ break Tailwind JIT trong dev mode nếu cần. Verify khi `npm run dev` chạy.
- [ ] **HMR cho MAIN world content script**: CRXJS log warning rằng `src/content/slate-bridge.ts` không support HMR vì `world: MAIN`. Expected — không phải bug.
- [ ] **`@tailwindcss/forms` import**: đã add vào deps + plugin nhưng chưa test. Nếu Phase 1 không cần form custom thì có thể remove.
- [ ] **7 npm vulnerabilities** (5 moderate, 2 high) sau `npm install` — chưa audit. Defer tới Phase 6 polish.
- [ ] **No git repo** — chưa `git init`. User có thể init bất kỳ lúc nào; CLAUDE.md + PROGRESS.md + .gitignore đã sẵn sàng.
- [x] ~~No backend mock~~ → **DONE**. In-process mock backend trong [src/background/mock/](src/background/mock/) — 17 endpoints, full envelope, latency 120-380ms. Toggle qua `VITE_USE_MOCK` (default ON). Docs: [docs/MOCK-API.md](docs/MOCK-API.md).
- [ ] **Real enrollment endpoint chưa implement**: background dev fallback dùng `VITE_EXT_ID`/`VITE_EXT_SECRET`. Production phải POST `/enrollment/enroll` trên install để nhận `{client_id, secret}` từ backend.
- [x] ~~`auth:google-callback` chưa implement~~ → **DONE** (Phase 1 chunk 6c). Content script + background handler ready. Mock không có real Google OAuth nên end-to-end chưa test được.
- [ ] **Manifest content_scripts match cho oauth-bridge** hard-code `https://your-backend.example.com/auth/google/success*`. Khi đổi `VITE_API_BASE_URL` sang real backend, phải update [manifest.config.ts](manifest.config.ts) tay (CRXJS không tự suy ra từ env).
- [ ] **i18n vẫn dùng local resources, chưa fetch `/i18n/{locale}` từ server**. Mock route đã có sẵn (`i18n/vi`, `i18n/en`). Phase 6 polish sẽ thêm server-managed translations.

---

## How to resume in a new session

1. Đọc file này (`PROGRESS.md`) trước tiên.
2. Đọc [CLAUDE.md](CLAUDE.md) — rules cho code generation.
3. Xem mục **Snapshot** ở trên → biết đang ở phase nào + next action.
4. Nếu next action là task cụ thể, mở [docs/13-vibe-coding-prompts.md](docs/13-vibe-coding-prompts.md) tới prompt tương ứng (vd. `P1.1`).
5. Run `npx tsc --noEmit && npx vite build` để confirm baseline còn xanh trước khi bắt đầu code mới.
