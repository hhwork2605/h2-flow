# 13 — Vibe-Coding Prompts

Bộ template prompt để feed vào AI coding agent (Cursor / Claude Code / v0 / Lovable / Bolt). Mỗi prompt **self-contained**: copy-paste vào agent kèm references file `.md` cụ thể.

---

## Quy tắc dùng

1. **Mở agent → paste prompt → kèm `@docs/XX-...md` reference**
2. Trước khi paste, fill các `[PLACEHOLDER]` trong prompt
3. Review output, không accept blindly
4. Commit theo từng prompt (1 prompt = 1 commit)

---

## P0 — Scaffold

### P0.1 — Initialize Vite + React + TS + CRX

```
Bạn là senior frontend engineer. Tôi cần scaffold 1 Chrome Extension Manifest V3 dùng:
- Vite + @crxjs/vite-plugin v2
- React 18 + TypeScript 5 strict mode
- Tailwind 3 với design tokens custom
- Zustand 4, TanStack Query 5, Dexie 4, ky, i18next, Zod

Tham khảo @docs/03-tech-stack.md cho version cụ thể và lý do.
Tham khảo @docs/04-project-structure.md cho folder layout.

Tasks:
1. Tạo package.json với tất cả deps + scripts (dev, build, test, lint, typecheck)
2. vite.config.ts với CRXJS plugin, multiple HTML entry (sidebar, workflow-editor, angles-editor, effects-editor, settings)
3. manifest.config.ts đầy đủ permissions, content_scripts, side_panel
4. tsconfig.json strict mode, paths @/* alias
5. tailwind.config.ts với colors từ @docs/05-ui-spec.md mục "Color palette"
6. ESLint + Prettier config
7. Skeleton sidebar.html + src/pages/sidebar/main.tsx render `<h1>Toby Flow</h1>`
8. Background script skeleton src/background/index.ts với apiRequest message handler stub

Output: full file contents, không skip phần nào. Tôi sẽ copy-paste vào project.
```

### P0.2 — Theme Provider + dark mode

```
Tạo `src/ui/theme/ThemeProvider.tsx`, `useTheme.ts`, và logic apply class 'dark' vào <html>.

Requirements:
- 3 modes: 'light' | 'dark' | 'auto'
- Persist trong chrome.storage.local key 'af_theme'
- Auto mode follow `prefers-color-scheme`
- Tailwind darkMode: 'class'
- Hook trả về: theme, setTheme, effectiveTheme ('light' | 'dark')

Tham khảo @docs/11-features-spec.md mục 19 cho specs.
```

---

## P1 — Auth + Infrastructure

### P1.1 — API client với HMAC signing

```
Tạo `src/api/client.ts` với ky instance, và `src/api/request-signer.ts` để build HMAC headers.

Requirements:
- Base URL từ env `VITE_API_BASE_URL` (default https://your-backend.example.com/api/v1)
- Hook beforeRequest: inject Bearer token từ Zustand auth.store + HMAC signing headers
- Hook afterResponse: handle 401 (try refresh), 403 EXTENSION_NOT_AUTHORIZED (set af_clone_detected flag), 429 (backoff), 5xx (retry max 2)
- Retry config: max 3 cho network, 2 cho 5xx, không retry cho 4xx (trừ 401/429)
- Timeout 30s default, 60s cho upload
- Logger middleware mask sensitive fields (token, password, email)

RequestSigner:
- Static method headers(method, path, body) → Promise<{X-Ext-Id, X-Ext-Sig, X-Ext-Ts}>
- Dùng js-sha256 HMAC-SHA256
- Secret embedded trong bundle (mock for dev, env var for prod)

Tham khảo:
- @docs/08-api-contract.md mục "Request signing"
- @docs/08-api-contract.md mục "Conventions" cho response envelope

Output: 2 file đầy đủ TypeScript code + 1 file test Vitest.
```

### P1.2 — Auth store + hooks

```
Tạo `src/features/auth/store/auth.store.ts` (Zustand) và `src/features/auth/hooks/useAuth.ts`.

Types: tham khảo @docs/06-data-models.md mục 1 (User, AuthSession, LoginPayload, RegisterPayload).

Store state:
- user, token, isAuthenticated, isLoading, error
- Actions: login(payload), register(payload), logout, refresh, fetchMe, setSession(session)
- Persist `af_auth` qua chrome.storage.local middleware (custom storage adapter)
- Listen chrome.storage.onChanged để sync logout từ tab khác

Hooks:
- useAuth() returns { user, isAuthenticated, login, register, logout, ... }
- useAuthRestore() restore session on mount với fetchMe verify
- useGoogleOAuth() flow:
  1. GET /auth/google/url
  2. chrome.tabs.create với url
  3. Wait for chrome.runtime message 'auth:google-callback' từ oauth-bridge content script
  4. Save session

API endpoints: tham khảo @docs/08-api-contract.md mục 2.

Tham khảo:
- @docs/11-features-spec.md mục 1 cho flow đăng nhập Google
- @docs/07-storage-schema.md cho chrome.storage keys

Output: full TS code + tests.
```

### P1.3 — Login/Register modal UI

```
Tạo `src/features/auth/components/LoginModal.tsx`, `RegisterModal.tsx`, `ForgotPasswordModal.tsx`.

Design spec: @docs/05-ui-spec.md mục 9 "Login Modal".

Requirements:
- Sử dụng @radix-ui/react-dialog cho overlay + portal
- React Hook Form + Zod schema validation
- 2 sub-view trong cùng modal (login / register) toggle bottom
- Field: email, password (login); email, name, password, confirm password (register)
- Google login button (đỏ Google brand, gọi useGoogleOAuth)
- Forgot password link → open ForgotPasswordModal
- Error display: red banner trong modal
- Loading state: button spinner
- i18n: dùng useTranslation, key 'auth.email', 'auth.password', 'auth.login', 'auth.register', 'auth.googleLogin', 'auth.forgotPassword'
- Theme: Tailwind, dark mode safe
- Accessibility: focus first input, ESC close, ARIA labels

Output: 3 component files + Zod schemas.
```

### P1.4 — Anti-clone + Self-heal probe

```
Tạo:
- `src/shared/overlays/CloneDetectedOverlay.tsx` (full-screen z-100 overlay với shield icon, link Chrome Web Store)
- `src/background/anti-clone-probe.ts` (poll /extension/authorized mỗi 60s khi af_clone_detected=true)
- `src/i18n/clone-detected-i18n.ts` (mini i18n cho overlay trước khi i18next load — tham khảo @docs/01-product-overview.md mục 11 cho "Clone-detected")

Logic:
1. API client interceptor catch 403 EXTENSION_NOT_AUTHORIZED → setStorage('af_clone_detected', true)
2. Sidebar mount → check af_clone_detected → render overlay nếu true
3. Background SW khi `af_clone_detected = true` → start probe interval
4. Probe success (200 OK /extension/authorized) → clear flag + stop probe + hide overlay

Tham khảo @docs/11-features-spec.md mục 4.

Output: 3 file đầy đủ.
```

---

## P2 — Tab 1 Generate

### P2.1 — FlowAdapter + content script

```
Implement `src/providers/FlowAdapter.ts` + content scripts cho Google Flow.

Spec đầy đủ: @docs/10-providers-spec.md mục 2.

Files cần tạo:
1. `src/providers/AIProviderAdapter.ts` (abstract base) — copy interface từ @docs/10 mục 1
2. `src/providers/FlowAdapter.ts` (extend, override ensureReady, submit, uploadRef)
3. `src/providers/ProviderRegistry.ts` (singleton registry)
4. `src/providers/ProviderTabLock.ts` (mutex tab)
5. `src/providers/sessions/FlowSession.ts` (POST /flow/tile-resolve)
6. `src/content/flow.ts` (content script isolated world)
7. `src/content/slate-bridge.ts` (MAIN world, type vào Slate editor)

FlowAdapter.submit logic:
- emitPhase('sending') qua eventBus
- chrome.tabs.sendMessage → content script
- content script: type prompt, upload refs, click generate
- emitPhase('generating')
- TileMonitor watch DOM, extract file_name từ ?name= hoặc ?input= URL param
- emitPhase('downloading')
- FlowSession.fetchTileDetails → thumbnails + provider_urls
- Return SubmitResult

DOM selectors: load từ ProviderConfigManager (GET /providers/dom-selectors).
Reference: @docs/02-architecture.md mục 9 "Config-as-Data".

Output: full TypeScript, comment giải thích từng critical block.
```

### P2.2 — ExecutionGate + FeatureGate

```
Implement:
1. `src/core/ExecutionGate.ts` — server-authoritative quota gate
2. `src/core/FeatureGate.ts` — local entitlements cache
3. `src/core/ExecutionLock.ts` — local single-runner lock
4. `src/core/errors/QuotaErrorHandler.ts` — categorize errors

ExecutionGate spec: @docs/09-workflow-engine.md mục 5 + @docs/08-api-contract.md mục 4.

Requirements:
- Static methods: request(action, count, metadata), complete(token, status), cancel(token)
- 5s timeout cho server call (AbortController)
- Active tokens map cho cleanup khi window unload
- showDeniedDialog(gate, label): hiện CustomDialog với upgrade CTA

FeatureGate spec: @docs/11-features-spec.md mục 2.

Requirements:
- Singleton class với entitlements cache 30s
- refresh() từ GET /entitlements (anonymous OK)
- canUse(feature): boolean
- getQuota(action): QuotaInfo | null
- record* methods cho local stat
- _incrementDailyStat helper với date-based reset

Listen SSE events: 'plan_activated', 'quota_warning', 'quota_exhausted' → refresh() / show toast.

Output: 4 file + 1 file test.
```

### P2.3 — GenTab UI

```
Implement Tab 1 Generate UI đầy đủ theo @docs/05-ui-spec.md mục 2.

Folder: `src/features/generate/`

Components:
- GenTab.tsx (container)
- PromptArea.tsx (textarea với multi-prompt support, @mention helper, syntax hint)
- ProviderSelector.tsx (chips: Flow, ChatGPT (lock icon), Grok (lock icon))
- ModelSelector.tsx (dropdown từ ModelRegistry filtered by provider)
- RatioSelector.tsx (chips: 16:9, 1:1, 9:16, 4:3, 3:4)
- QuantitySlider.tsx (1-4)
- VideoControls.tsx (duration, resolution — chỉ hiện khi genType=Video)
- RefImagePicker.tsx (grid thumbnails 60x60, drag-drop, paste, click +Add)
- MentionHelper.tsx (chips các ref name, click insert)
- AutoDownloadToggle.tsx
- RunControls.tsx (Start/Pause/Stop + parallel/sequential mode)

State: `src/features/generate/store/generate.store.ts` (Zustand)
- prompts: string[]
- provider, model, ratio, quantity, mediaType
- refImages: { fileId, fileName, thumbnail }[]
- runMode: 'parallel' | 'sequential'
- autoDownload, downloadResolution
- isRunning, currentIndex, totalCount

Hook: `useGeneration.ts` orchestrate run:
- For each prompt: call ExecutionGate.request → ProviderAdapter.submit → ExecutionGate.complete → download
- Emit eventBus tracker_update sau mỗi prompt
- Stop logic: set stopFlag = true, đợi current finish

Settings sync: 2-tier theo @docs/07-storage-schema.md mục "Settings Sync".

Output: tất cả component files + store + hook + test cho hook.
```

### P2.4 — IndexedDB stores (Image, Album, BlobUrl)

```
Implement storage layer.

Schema: @docs/07-storage-schema.md mục 1 (IndexedDB).

Files:
- src/storage/db.ts (Dexie instance, version 4)
- src/storage/stores/ImageStore.ts
- src/storage/stores/AlbumStore.ts
- src/storage/stores/PendingUploadStore.ts
- src/storage/stores/ThumbnailCache.ts
- src/storage/stores/BlobUrlManager.ts
- src/storage/cleanup-cron.ts

ImageStore requirements:
- addToAlbum(albumId, imageData)
- get(imageId)
- delete(imageId)
- Auto-compute 3 tiers: thumbnail (50KB, JPEG), medium (1200px WebP @0.85), original
- Lưu blob vào image_blobs table với key=`${id}__${tier}`

BlobUrlManager:
- create(key, blob): tracked URL, revoke trước nếu key existed
- revoke(key)
- cleanupStale(maxAgeMs)
- revokeAll() called on beforeunload

Migration v3→v4 add thumbnail_cache store.

Tham khảo @docs/06-data-models.md mục 5 (AlbumImage, ImageBlob types).

Output: full TypeScript + integration test với fake-indexeddb.
```

---

## P3 — Workflow Editor + Engine

### P3.1 — Workflow types + Zod schemas

```
Tạo `src/types/workflow.types.ts`, `src/types/node.types.ts`, `src/api/schemas/workflow.schema.ts`.

Types đầy đủ: @docs/06-data-models.md mục 3.

Workflow interface với 14 node types (generate, chatgpt, grok, prompt, text, image, transform, condition, merge, delay, download, telegram, note, output).
Port type system: text/image/video/frame/any với PORT_COMPAT matrix.

Zod schemas: validate workflow trước khi save (POST/PUT).

Output: 2 type file + 1 schema file.
```

### P3.2 — React Flow custom canvas

```
Implement workflow editor canvas dùng React Flow 11.

Spec UI: @docs/05-ui-spec.md mục 3 "Workflow Editor".

Files:
- src/features/workflow/components/editor/DiagramCanvas.tsx (React Flow wrapper)
- src/features/workflow/components/editor/NodePalette.tsx (left sidebar drag source)
- src/features/workflow/components/editor/NodeInspector.tsx (right sidebar form)
- src/features/workflow/components/editor/nodes/ (14 custom node components)
- src/features/workflow/components/editor/edges/TypedEdge.tsx (custom edge với port type color + flowing animation)

Custom node requirements:
- Top floating provider pill cho generate/chatgpt/grok
- Header: icon + name (editable inline với contentEditable)
- Body: 1-2 line summary
- Footer: status dot + duration
- Handles (ports): circle 12x12 với color + icon letter (T/I/V/F/*)
- Multi state: idle, selected, running (pulse), phase (sending/generating/downloading), completed (green), failed (red), disabled (40% opacity)

Edge animation khi node running: dashed flowing line.

isValidConnection callback: check PORT_COMPAT matrix.

Save workflow throttle 2s debounce → PUT /workflows/{id}.

Output: 16+ file (1 canvas + 1 palette + 1 inspector + 14 node + 1 edge + tests).
```

### P3.3 — WorkflowExecutor engine

```
Implement core executor.

Spec đầy đủ: @docs/09-workflow-engine.md.

Files:
- src/features/workflow/engine/WorkflowExecutor.ts (class với run, executeSingleNode, stop methods)
- src/features/workflow/engine/topological-sort.ts (Kahn's algorithm, cycle detection)
- src/features/workflow/engine/running-flag.ts (Web Locks API + chrome.storage + heartbeat)
- src/features/workflow/engine/port-compat.ts (PORT_TYPES + PORT_COMPAT matrix)
- src/features/workflow/engine/cross-provider-bridge.ts (ChatGPT/Grok output → upload Flow)
- src/features/workflow/engine/resolve-inputs.ts (gather upstream node outputs)
- src/features/workflow/engine/node-runners/*.runner.ts (14 runners theo @docs/09 mục 2)

Key logic:
1. claimRunningFlag với Web Locks `ifAvailable: true`
2. Heartbeat mỗi 60s, TTL 5 min, auto-clear stale
3. ExecutionGate.request promptCount = count of generate/chatgpt/grok nodes
4. Topological sort, skip disabled nodes + note
5. Per-node:
   - emitPhase events
   - call runner
   - persist result vào node (result_file_ids, result_thumbnails, result_file_names, result_provider_urls, result_text)
   - PATCH /workflows/{id}/nodes/{node_id}
   - eventBus + broadcastEvent
6. Stop: eventBus.once('execution:stop_requested') → break loop
7. Cleanup: complete gate, clear flag, release lock

Broadcast cross-context qua chrome.runtime.sendMessage để popup editor nhận update.

Output: 10+ file đầy đủ + integration test cho main flow.
```

### P3.4 — Workflow list + Save Template

```
Implement Tab 3 Workflow.

Spec UI: @docs/05-ui-spec.md mục 3.

Files:
- src/features/workflow/components/WorkflowTab.tsx (container)
- src/features/workflow/components/WorkflowList.tsx (grid 2-col cards)
- src/features/workflow/components/WorkflowCard.tsx (card với Run/Edit/Duplicate/More actions)
- src/features/workflow/components/SaveTemplateModal.tsx
- src/features/workflow/components/ShareWorkflowModal.tsx
- src/features/workflow/components/WorkflowHistory.tsx (drawer list runs)

Hooks:
- useWorkflows() → useQuery /workflows
- useWorkflowExecution() → wrap WorkflowExecutor
- useWorkflowMutations() → useMutation (create, update, delete, duplicate, share)

Workflow editor popup window:
- Click Edit trên card → chrome.windows.create với url workflow-editor.html?wf_id=xxx
- Window 1400x900, resizable
- workflow-editor page render `<WorkflowEditorPage workflowId={...} />`

Output: 6 component + 3 hook + WorkflowEditorPage entry.
```

---

## P4 — Multi-provider + Realtime

### P4.1 — ChatGPTAdapter + GrokAdapter

```
Implement 2 adapter còn lại.

Spec: @docs/10-providers-spec.md mục 3, 4.

Files:
- src/providers/ChatGPTAdapter.ts
- src/providers/GrokAdapter.ts
- src/providers/sessions/ChatGPTSession.ts
- src/providers/sessions/GrokSession.ts
- src/content/chatgpt.ts (content script)
- src/content/grok.ts (content script)

ChatGPT critical:
- Synthetic file_id = sha256(prompt + Date.now())
- Fetch CDN URL → blob → cache vào ImageStore TRƯỚC khi token expires
- delete_after_gen: gọi DELETE conversation API
- Login check qua cookie

Grok critical:
- Cloudflare challenge loop:
  - Watch DOM cho [data-cloudflare-challenge] hoặc text "Verify you are human"
  - Detect → emit chrome.runtime.sendMessage({ action: 'cloudflare:challenge', phase: 'detected', elapsedSec: 0, provider: 'grok' })
  - Poll mỗi 2s, increment elapsedSec
  - 30s → escalate phase: 'waiting' urgent
  - Resolved → phase: 'resolved'
  - 90s → phase: 'timeout', fail node
- Image vs video mode toggle

Register vào ProviderRegistry trong bootstrap.

Output: 6 file đầy đủ + UI handler cho cloudflare:challenge message (in app.tsx).
```

### P4.2 — SSE Client 3-transport

```
Implement realtime layer.

Spec: @docs/02-architecture.md mục 5 + @docs/08-api-contract.md mục 20.

Files:
- src/realtime/SseClient.ts (singleton class)
- src/realtime/SseBroadcastManager.ts (leader-follower election qua BroadcastChannel)
- src/realtime/MercureClient.ts (Mercure EventSource)
- src/realtime/PollingClient.ts (setInterval 30s GET /events/poll)
- src/realtime/event-handlers.ts (map server event type → action)

SseClient state machine:
- Modes: 'sse' | 'polling' | 'mercure'
- Transport selection: paid → try Mercure → fallback legacy SSE → fallback polling
- Reconnect backoff: 5s → 10s → 20s → 40s → 60s, max 10 retries
- Heartbeat from server (any event) updates last_event_at
- Dedup ring buffer 50 IDs

SseBroadcastManager:
- channel = new BroadcastChannel('tobyflow-sse')
- Election: timestamp + tabId, lowest wins
- Leader creates EventSource, broadcasts events
- Follower listens channel, doesn't create connection
- Heartbeat 5s, follower timeout → re-election

Event types: @docs/06-data-models.md mục 9 (SseEventType).

Event handlers:
- notification → bell badge + toast
- plan_activated → FeatureGate.refresh + plan badge update + close upgrade modal
- quota_warning → toast
- quota_exhausted → toast critical
- config_updated → re-fetch relevant config (ModelRegistry, ProviderConfigManager, etc.)
- force_logout → AuthManager.logout + show reason modal
- force_reload_extension → chrome.runtime.reload()
- announcement → AnnouncementModal.show

Output: 5 file đầy đủ + integration test mock EventSource.
```

### P4.3 — Multi-Task tab

```
Implement Tab 2.

Spec UI: @docs/05-ui-spec.md mục 4.

Files:
- src/features/multi-task/components/MultiTaskTab.tsx
- src/features/multi-task/components/TaskList.tsx
- src/features/multi-task/components/TaskCard.tsx (expandable)
- src/features/multi-task/components/TaskModal.tsx (create/edit)
- src/features/multi-task/hooks/useTasks.ts
- src/features/multi-task/store/tasks.store.ts (Zustand persist chrome.storage)

Logic:
- Task = nhóm prompts với config riêng
- Run task: gọi ProviderAdapter cho từng prompt
- Run All: ExecutionGate.request totalPromptCount → loop tasks sequentially hoặc parallel
- Stop All: emit 'tasks:stop_all'
- Per-task progress: { current, total }
- Per-prompt status: pending/running/completed/failed

Types: @docs/06-data-models.md mục 6.

Output: 4 component + 1 hook + 1 store.
```

---

## P5 — Billing + Telegram

### P5.1 — Upgrade modal + VietQR

```
Implement plan upgrade flow.

Spec UI: @docs/05-ui-spec.md mục 9 "Upgrade Modal".

Files:
- src/features/billing/components/UpgradeModal.tsx
- src/features/billing/components/PlanCard.tsx
- src/features/billing/components/PaymentView.tsx (QR + bank info + countdown)
- src/features/billing/hooks/usePlans.ts (fetch /plans)
- src/features/billing/hooks/useOrder.ts (create + poll status)
- src/shared/PlanContentRenderer.tsx

Flow:
1. usePlans() → cards với features comparison
2. User pick → useOrder.create({ plan_key, duration_days, currency, payment_method: 'vietqr' })
3. PaymentView display QR + bank info + transfer_content
4. Countdown timer dựa expires_at
5. SSE event 'plan_activated' → close modal, refresh FeatureGate
6. Manual "I've paid" button: poll GET /orders/{id} mỗi 5s

Sticky footer slide-up animation lần đầu open.

Output: 3 component + 2 hook + animation CSS keyframes.
```

### P5.2 — Tip Coffee + Referral

```
Implement Tip Coffee modal và Referral section.

Spec UI: @docs/05-ui-spec.md mục 9 "Tip Coffee Modal" + @docs/11-features-spec.md mục 11, 12.

Files:
- src/features/billing/components/TipCoffeeModal.tsx
- src/features/billing/components/ReferralSection.tsx
- src/features/billing/hooks/useTip.ts
- src/features/billing/hooks/useReferral.ts

Tip flow:
1. Click amount → POST /tip body {amount, currency}
2. Display QR + bank info
3. (Optional) listen SSE 'tip:received' → thank you toast

Referral:
1. useReferral().code → GET /referral/code (cache 1h)
2. useReferral().stats → GET /referral/stats (poll 5 min)
3. Copy button (navigator.clipboard.writeText)
4. Share button (Web Share API hoặc fallback copy URL)

Output: 2 component + 2 hook.
```

### P5.3 — Telegram link + node runner

```
Implement Telegram integration.

Spec: @docs/11-features-spec.md mục 9.

Files:
- src/features/settings/components/TelegramLinkCard.tsx (settings page)
- src/features/workflow/engine/node-runners/telegram.runner.ts
- src/api/endpoints/telegram.ts

Link flow:
1. POST /telegram/link-init → { bot_username, link_code }
2. Display: "Mở @TobyFlowBot trên Telegram, gõ /start {link_code}"
3. SSE event 'telegram:linked' → update UI

Node runner:
- POST /telegram/send-workflow-images body { file_ids, caption, mode }
- Caption template support {prompt}, {provider}, {workflow}

Notify on complete setting:
- Listen 'execution:completed' → if setting on → POST /telegram/notify-completion

Output: 2 component + 1 runner + 1 endpoint file.
```

---

## P6 — Polish + Remaining

### P6.1 — Photos + History + Logs tabs

```
Implement 3 tab còn lại.

Spec UI: @docs/05-ui-spec.md mục 5, 6, 7.

Photos:
- Grid 2-3 col responsive
- Infinite scroll (useInfiniteQuery)
- Filter bar: date, provider, album, search
- Click → full-screen viewer modal (Lightbox style)

History:
- List view grouped by date
- Replay action → populate GenTab với prompt + refs gốc
- Filter by source (gen_tab/multi_task/workflow)

Logs:
- Console-like monospace UI
- Auto-scroll toggle
- Filter level
- Search box
- Export → download .txt
- Read from chrome.storage 'af_logs' ring buffer

Output: 3 folder feature đầy đủ (components + hooks + store).
```

### P6.2 — Angles & Effects Editor (popup)

```
Implement 2 popup window editor.

Spec: @docs/11-features-spec.md mục 14, 15.

Angles Editor:
- entry: angles-editor.html
- Load presets từ GET /angle-presets
- Grid cards với thumbnail + name
- Click preview animation
- "Apply" → postMessage về opener (sidebar/popup workflow editor)

Effects Editor: tương tự cho /effect-presets.

Open from GenTab/Inspector: chrome.windows.create({ url, type: 'popup', width: 900, height: 700 })

Output: 2 page + components + opener mechanism.
```

### P6.3 — Screen Capture

```
Implement screen capture flow.

Spec: @docs/11-features-spec.md mục 5.

Files:
- src/features/capture/components/CaptureOverlay.tsx (injected into active tab)
- src/features/capture/services/ScreenCaptureService.ts
- src/background/screen-capture-handler.ts

Flow:
1. User click 🎨 button → chrome.tabs.query active → inject CaptureOverlay
2. Overlay: crosshair + dim background + click-drag rectangle
3. User release → chrome.tabs.captureVisibleTab → PNG dataURL
4. Crop to selected region (canvas)
5. POST /capture/upload multipart → { image_id, thumbnail_url }
6. emit 'capture:complete' với image_id
7. Auto-add vào current context (GenTab ref hoặc workflow node inspector)

ESC cancel.

Output: 3 file đầy đủ.
```

### P6.4 — Misc polish

```
Implement polish features:

1. Project Indicator (Flow project switcher) — @docs/05-ui-spec.md mục 1
2. Changelog modal với badge — @docs/11-features-spec.md mục 10
3. Contact modal (Zalo/Telegram/Facebook/Guide) — @docs/05-ui-spec.md mục 9
4. Language modal với 4 flag SVG inline — @docs/05-ui-spec.md mục 9
5. Notification bell + panel — @docs/11-features-spec.md mục 10
6. Toast system (4 types, max 3 stacked) — @docs/05-ui-spec.md mục 10
7. Offline overlay với retry — @docs/11-features-spec.md mục 16
8. Smart tooltips wrapper
9. Empty states cho 6 tab — @docs/05-ui-spec.md mục 11
10. Keyboard shortcuts handler — @docs/11-features-spec.md mục 20

Output: ~15 component file.
```

---

## Templates phụ trợ

### T1 — Generate full module from spec

```
Bạn là senior engineer. Implement module sau theo spec:

REFERENCES (đọc trước khi code):
- @docs/[X]-[name].md mục [Y]
- @docs/06-data-models.md cho types
- @docs/04-project-structure.md cho file layout

REQUIREMENTS:
[paste spec section]

CONSTRAINTS:
- TypeScript strict, no `any`
- File header theo template @docs/04 mục "File header template"
- Use Zustand cho state, TanStack Query cho fetch
- Tailwind cho style, no inline style
- shadcn/ui cho primitives
- i18n keys phải resolved qua useTranslation
- A11y: ARIA labels, keyboard navigation

OUTPUT FORMAT:
1. File path
2. Full file content
3. Brief explanation (max 3 sentences)

Không skip phần nào.
```

### T2 — Refactor old code to new structure

```
Tôi có code TypeScript tham khảo từ @docs/[X].md (mục code samples). Refactor thành:
- Module ES nguyên thuỷ (không attach window.*)
- Functional React thay vì class methods
- Hooks thay vì class init() pattern
- Zustand thay vì static state
- Async/await rõ ràng, không callback nested

Giữ nguyên business logic + comments giải thích quyết định khó hiểu.

Output: code refactored + explanation gì đã thay đổi.
```

### T3 — Generate UI from screen spec

```
Generate React component cho screen sau:

SCREEN: [Tên screen]
SPEC: @docs/05-ui-spec.md mục [X]
STATE/PROPS: [list]
TOKENS: @docs/05-ui-spec.md mục 0 "Design tokens"

Stack:
- React 18, TypeScript
- Tailwind classes (no custom CSS unless absolutely needed)
- shadcn/ui primitives (Button, Dialog, Dropdown, ...)
- Lucide icons
- Dark mode safe (no hard-coded colors)

Behavior: [list interactions]

Acceptance:
- Pixel-perfect theo wireframe trong spec
- Responsive 320–480px (sidebar) hoặc 1024px+ (popup)
- Accessibility: focus trap modal, ARIA, keyboard

Output: full TSX + Storybook story.
```

### T4 — Test generation

```
Generate Vitest tests cho module [path].

Strategy:
- Unit test cho mọi public function/method
- Mock chrome.* via vi.stubGlobal
- Mock fetch via vi.spyOn(global, 'fetch')
- Mock IndexedDB via fake-indexeddb
- Coverage target: > 70% statements

Edge cases bắt buộc test:
- Network error
- Server 4xx/5xx
- Empty input
- Concurrent calls (race condition)
- Auth required path

Output: test file đầy đủ + setup mock helpers nếu cần.
```

---

## Hint vibe-coding hiệu quả

1. **Always reference docs file** — đừng paste lại spec, dùng `@docs/XX.md`
2. **Small batches** — 1 prompt = 1 module, không quá 5 file
3. **Verify after gen** — chạy `npm run typecheck && npm run lint` trước khi commit
4. **Iterate, don't redo** — agent gen sai → reply "fix `X` to `Y`", không paste lại prompt
5. **Pin agent context** — đầu mỗi session paste lại stack info + project structure
6. **Test driven** — gen test file trước, gen code sau (TDD vibe-coding)
7. **Brand-safe** — agent có thể vô tình copy tên "Toby Flow" → search & replace bằng brand của bạn

---

## Checklist trước khi merge mỗi PR

- [ ] `npm run typecheck` pass
- [ ] `npm run lint` pass
- [ ] `npm run test` pass (coverage không giảm)
- [ ] `npm run build` thành công
- [ ] Load unpacked → smoke test feature mới
- [ ] No `console.log` leftover (chỉ `logger.debug`)
- [ ] No `any` mới
- [ ] No hard-coded URL (dùng env hoặc endpoints/*.ts)
- [ ] i18n keys đã add vào server `/i18n/{locale}`
- [ ] Component có ARIA labels
- [ ] Dark mode test OK
- [ ] Bundle size không tăng > 10KB (check `dist/stats.html`)
