# 12 — Implementation Roadmap

Chia làm **6 phase**, mỗi phase 1–3 tuần (tuỳ tốc độ). Mỗi phase ship được tính năng dùng được, không phải "Big Bang".

---

## Phase 0 — Scaffold (3-5 ngày)

### Mục tiêu
Có 1 extension Chrome chạy được, sidebar mở được, hot-reload OK.

### Tasks
- [ ] `npm create vite@latest` template react-ts
- [ ] Add `@crxjs/vite-plugin`
- [ ] Setup `manifest.config.ts` với `side_panel`, basic permissions
- [ ] Tạo `sidebar.html`, `workflow-editor.html`, `angles-editor.html`, `effects-editor.html`, `settings.html`
- [ ] Setup Tailwind + design tokens từ `05-ui-spec.md`
- [ ] Setup ESLint + Prettier + tsconfig strict
- [ ] Setup TanStack Query Provider, Zustand store skeleton, Dexie DB skeleton
- [ ] Setup React Router (cho navigation giữa tab) hoặc state-based routing
- [ ] Theme provider (light/dark/auto)
- [ ] Skeleton tab bar 6 tabs với empty content
- [ ] Background script skeleton với `apiRequest` proxy handler
- [ ] Load extension in `chrome://extensions/`, verify Side Panel hoạt động

### Acceptance criteria
- `npm run dev` → load unpacked → sidebar mở được, tab switch OK
- `npm run build` → tạo `dist/` ready để publish
- Save 1 file → HMR fire trong sidebar

### Vibe-coding prompt (tham khảo `13-vibe-coding-prompts.md` mục P0)

---

## Phase 1 — Auth + Public infra (1 tuần)

### Mục tiêu
User login/register được, anti-clone hoạt động, public configs load OK.

### Tasks
- [ ] `src/api/client.ts` (ky instance + retry + sign hooks)
- [ ] `src/api/request-signer.ts` (HMAC-SHA256 với js-sha256)
- [ ] `src/api/endpoints/auth.ts` (login, register, refresh, me, google)
- [ ] `src/features/auth/store/auth.store.ts` (Zustand + persist `af_auth`)
- [ ] `src/features/auth/hooks/useAuth.ts`
- [ ] Login modal + Register modal UI (theo `05-ui-spec.md`)
- [ ] Google OAuth flow với content script `oauth-bridge.ts`
- [ ] Header với user avatar + dropdown
- [ ] Logout flow
- [ ] Public config bootstrap:
  - `GET /default-settings` → set locale
  - `GET /system-settings/public` → load limits
  - `GET /entitlements` (anonymous) → render Free badge
- [ ] Anti-clone: RequestSigner, EXTENSION_NOT_AUTHORIZED handler, CloneDetectedOverlay
- [ ] Self-heal probe trong background script
- [ ] Offline detection + OfflineOverlay
- [ ] i18next setup với HTTP backend

### Acceptance criteria
- Register → email gửi đi (backend mock OK)
- Login email/password → token saved → user info hiển thị
- Google login → flow redirect OK
- Logout → state cleared
- Network offline → overlay xuất hiện, retry button works
- Backend reject ext_id → clone overlay xuất hiện, sau khi admin add whitelist → tự ẩn

### Vibe-coding prompts: P1.1, P1.2, P1.3

---

## Phase 2 — Tab 1 Generate với 1 provider (1.5 tuần)

### Mục tiêu
User chạy được 1 batch generate trên Google Flow với ref images + auto-download.

### Tasks
- [ ] `src/providers/AIProviderAdapter.ts` (abstract base)
- [ ] `src/providers/FlowAdapter.ts` (full impl)
- [ ] `src/providers/ProviderRegistry.ts` + ProviderTabLock
- [ ] Content script `content/flow.ts` + `content/slate-bridge.ts`
- [ ] `src/core/ModelRegistry.ts` (load /provider-models)
- [ ] `src/core/ProviderConfigManager.ts` (load /providers/dom-selectors)
- [ ] `src/core/FeatureGate.ts` + `useFeatureGate` hook
- [ ] `src/core/ExecutionGate.ts` (request/complete/cancel + Denied dialog)
- [ ] `src/core/ExecutionLock.ts` (local lock)
- [ ] `src/features/generate/components/GenTab.tsx` (full UI theo `05-ui-spec.md`)
  - PromptArea (multi-prompt support)
  - ProviderSelector (chỉ Flow giai đoạn này)
  - ModelSelector
  - RatioSelector
  - RefImagePicker + drag-drop + paste
  - MentionHelper
  - RunControls (Start/Pause/Stop, parallel/sequential)
- [ ] `src/storage/stores/ImageStore.ts` (3-tier blob)
- [ ] `src/storage/stores/MediaRegistry.ts` (thumbnail + file_name maps)
- [ ] `src/storage/stores/BlobUrlManager.ts`
- [ ] Auto-download flow: `chrome.downloads.download` qua background
- [ ] Settings 2-tier sync (TIER 1 LIVE + TIER 2 RESPECTFUL)
- [ ] FlowSession.tileResolve qua `/flow/tile-resolve`

### Acceptance criteria
- User type 5 prompts → click Generate → mỗi prompt gửi sang Flow tab → tiles xuất hiện → auto-download → file save trong folder `Downloads/<workflow>/<date>/<prompt>/`
- Ref images: pick + paste + drag-drop → đưa vào Flow upload qua tRPC → file_name returned
- Quota exhausted → denied dialog với upgrade CTA
- Stop → in-flight prompt finish nhưng không submit thêm

### Vibe-coding prompts: P2.1, P2.2, P2.3, P2.4

---

## Phase 3 — Workflow Editor + Engine (2 tuần)

### Mục tiêu
User dựng và chạy workflow đa node, đa provider được (cùng provider Flow trước).

### Tasks
- [ ] `src/features/workflow/components/WorkflowTab.tsx` (list view)
- [ ] `src/features/workflow/components/editor/` (popup window):
  - `DiagramCanvas.tsx` (React Flow wrapper)
  - `NodePalette.tsx` (drag from palette to canvas)
  - `NodeInspector.tsx` (right panel form)
  - Custom nodes cho 14 loại trong `src/features/workflow/components/editor/nodes/`
- [ ] React Flow custom edge với port type colors + flowing animation
- [ ] `src/features/workflow/engine/WorkflowExecutor.ts`
- [ ] `src/features/workflow/engine/topological-sort.ts`
- [ ] `src/features/workflow/engine/running-flag.ts` (Web Locks + heartbeat + auto-clear stale)
- [ ] Node runners (`src/features/workflow/engine/node-runners/`):
  - generate (delegate to FlowAdapter)
  - prompt (với enhance gọi ChatGPT/Gemini)
  - text, image (static)
  - delay
  - download (delegate DownloadHelper)
  - condition (eval safe expression)
  - merge
  - output, note
- [ ] Save workflow → POST `/workflows`
- [ ] Load workflow → GET `/workflows/{id}`
- [ ] Cross-context broadcast event qua chrome.runtime + BroadcastChannel
- [ ] Node phase events → UI animation (sending/generating/downloading)
- [ ] Workflow editor popup window (`workflow-editor.html`)

### Acceptance criteria
- Drag 3 nodes (prompt → generate → download) → connect → save → run
- 1 workflow chạy, mở popup riêng → click Run ở sidebar → popup hiện "đã có workflow khác chạy"
- Reload sidebar giữa workflow đang chạy → resume hoặc clear stale lock đúng
- Phase animation chuyển sending → generating → downloading mượt
- Node fail → status red + error message tooltip
- Export workflow JSON → re-import OK

### Vibe-coding prompts: P3.1, P3.2, P3.3, P3.4

---

## Phase 4 — Multi-provider + Realtime + Tab 2 Multi-Task (1.5 tuần)

### Mục tiêu
ChatGPT + Grok hoạt động, bridge sang Flow OK, SSE realtime hoạt động.

### Tasks
- [ ] `src/providers/ChatGPTAdapter.ts`
- [ ] `src/providers/GrokAdapter.ts`
- [ ] Content scripts `content/chatgpt.ts`, `content/grok.ts`
- [ ] Cloudflare challenge handling (Grok) — toast persistent + escalate 30s
- [ ] Cross-provider bridge: ChatGPT/Grok output → upload Flow → bền UUID
- [ ] `src/realtime/SseClient.ts` (3 transport: SSE / Mercure / Polling)
- [ ] `src/realtime/SseBroadcastManager.ts` (leader-follower election)
- [ ] SSE event handlers (notification, plan_activated, quota_*, config_updated, ...)
- [ ] `src/core/ConfigVersionPoller.ts`
- [ ] `src/features/multi-task/` full
  - TaskList với cards expandable
  - TaskModal create/edit
  - Run all / stop all
- [ ] Multi-provider selector trong GenTab + Workflow node Inspector
- [ ] FeatureGate cho per-provider feature flag

### Acceptance criteria
- ChatGPT login → submit prompt → image xuất hiện → cached blob
- Grok submit → Cloudflare challenge → toast + countdown → user verify → resolved → continue
- ChatGPT output node → connect tới Flow node → tự upload → Flow chạy với ref OK
- SSE: backend push notification → bell badge +1
- 2 sidebar mở cùng lúc → chỉ 1 SSE connection thật (kiểm tra DevTools Network)
- Free user: polling 30s, paid user: Mercure connect OK

### Vibe-coding prompts: P4.1, P4.2, P4.3

---

## Phase 5 — Billing + Quota + Telegram (1.5 tuần)

### Mục tiêu
User upgrade plan qua VietQR được, Telegram bot gửi kết quả OK.

### Tasks
- [ ] `src/features/billing/components/UpgradeModal.tsx`
- [ ] Plan picker UI với cards (theo `05-ui-spec.md`)
- [ ] Order creation flow:
  - POST `/orders` → VietQR URL + bank info
  - Sticky footer payment buttons với slide-up animation
- [ ] Order status polling + SSE `plan_activated` handler
- [ ] Plan badge update Free → Pro real-time
- [ ] `src/features/billing/components/TipCoffeeModal.tsx`
  - Quick amount buttons
  - QR + bank info fetch
- [ ] Referral section trong user dropdown
  - Code display + copy
  - Share button (Web Share API)
  - Stats display
- [ ] Telegram link flow:
  - Settings → Telegram link
  - POST `/telegram/link-init` → bot username + code
  - SSE event `telegram:linked` → update UI
- [ ] Telegram node runner trong workflow:
  - POST `/telegram/send-workflow-images`
- [ ] Notify on complete setting → POST `/telegram/notify-completion`
- [ ] Webhook settings page
- [ ] FeatureGate per quota action (workflow_run, generate, chatgpt_run, grok_run)
- [ ] Daily stats local (UI counter, sync với server qua UsageSync)

### Acceptance criteria
- Click Upgrade → pick Pro → VietQR shown → simulated payment in backend → plan activated (SSE event) → modal close, badge update Pro
- Tip Coffee → QR + bank info → user "đã chuyển" → toast
- Telegram link → user gõ /start trong bot → linked → status update
- Workflow node telegram run → message + media gửi tới chat user
- Quota cao paid user: chạy 50 workflow OK; free user 11th workflow → denied

### Vibe-coding prompts: P5.1, P5.2, P5.3

---

## Phase 6 — Polish + Remaining tabs + Editors (1.5 tuần)

### Mục tiêu
Mọi tab còn lại + popup editors + polish UX.

### Tasks
- [ ] Tab Photos (grid + filter + full-screen viewer)
- [ ] Tab History (timeline + replay action)
- [ ] Tab Logs (console + export + filter)
- [ ] Albums full CRUD
- [ ] Snippets + UserPrompts tabs
- [ ] Templates browsing + clone
- [ ] Angles Editor popup window
- [ ] Effects Editor popup window
- [ ] Screen Capture overlay + upload flow
- [ ] Project Indicator (Flow project switcher)
- [ ] Changelog modal + badge tracker
- [ ] Announcement modal handler
- [ ] Contact modal (Zalo, Telegram, Facebook, Guide)
- [ ] Language selector modal (4 ngôn ngữ + flag SVG)
- [ ] Dark/light/auto theme toggle
- [ ] Pipeline mode (run multiple workflows sequentially)
- [ ] Smart tooltips
- [ ] Skeleton loading states
- [ ] Empty states với illustration
- [ ] Toast notifications (4 types)
- [ ] Keyboard shortcuts handler
- [ ] Accessibility audit (focus visible, ARIA labels, contrast)
- [ ] E2E test với Playwright (login → run workflow → download)
- [ ] Bundle size optimization (code split, lazy import editors)
- [ ] Production build + manifest version bump
- [ ] Privacy policy + terms link
- [ ] Chrome Web Store listing assets (screenshots, promo tile)

### Acceptance criteria
- Tất cả 6 tab có content + filter + actions hoạt động
- 4 ngôn ngữ switch tức thời, no flicker
- Theme toggle dark/light mượt
- Angles Editor: pick preset → apply về node OK
- Screen Capture: drag region → upload → image_id available
- E2E test pass: full flow login → workflow → download
- Bundle < 200KB sidebar gzipped
- Lighthouse / a11y > 90

### Vibe-coding prompts: P6.1, P6.2, P6.3, P6.4

---

## Phase 7+ (Post-MVP, optional)

- Marketplace public workflow template
- A/B test framework
- Plugin system (user dev custom node)
- AI agent suggest workflow từ prompt
- Stripe / PayPal cho international
- Mobile companion app
- Desktop standalone (Tauri/Electron wrap)
- Webhook out (Zapier-style)
- API public cho integration

---

## Cross-cutting concerns (luôn duy trì)

### Test coverage target
- Unit (services, helpers): > 70%
- Integration (engine, executor): > 50%
- E2E (golden paths): top 5 flows

### Performance budgets
- Sidebar boot < 1s
- Node render < 16ms (60fps editor)
- IndexedDB query < 100ms cho 1000 records

### Security
- Mọi user input qua Zod
- HTML render → React (auto-escape)
- chrome.storage chứa secret? → no, chỉ token (JWT short-lived)
- CSP strict (default Manifest V3 đã enforce)

### Observability
- `console.error` mọi catch
- Sentry SDK (optional) cho production
- POST `/analytics/selector-failure` cho DOM miss

---

## Time estimate (1 dev full-time)

| Phase | Estimate |
|---|---|
| P0 Scaffold | 3-5 ngày |
| P1 Auth + Public | 5-7 ngày |
| P2 Gen Tab + Flow | 8-10 ngày |
| P3 Workflow + Engine | 12-15 ngày |
| P4 Multi-provider + SSE | 8-10 ngày |
| P5 Billing + Telegram | 8-10 ngày |
| P6 Polish + Editors | 8-10 ngày |
| **Total** | **~52-67 ngày** |

Với AI coding agent (Cursor/Claude Code) + vibe-coding prompts: rút xuống **35-45 ngày**.
Với team 2-3 dev parallel: **3-4 tuần**.
