# 08 — Platform: Settings, i18n, Theme, Offline, Logs, Shortcuts, SSE

Bao gồm: Settings sync 2-tier (local + server), i18n bootstrap & loading-i18n, Theme switching (dark/light/auto), Offline detection + overlay, Logging (ring buffer + export), Keyboard shortcuts, SSE client (connection + retry + leader election).

> Nguồn: `reference-ext/src/core/I18n.js`, `loading-i18n.js`, `clone-detected-i18n.js`, `src/core/SystemConfig.js`, `BackendSync.js`, `ConfigVersionPoller.js`, `ServerHealthCheck.js`, `src/settings/StorageSettings.js`, `src/core/SseClient.js`, `SseBroadcastManager.js`, `src/core/LocalStorage.js`, `src/core/LocationCache.js`, `manifest.json` (commands), `app.js` (bootstrap).

---

## A. Settings sync 2-tier

### A1. Settings storage layers ✅

- **Tier 1 — `chrome.storage.local.af_settings`:** local-first, instant read, persist across SW restart.
- **Tier 2 — Server `/settings`:** authoritative cho multi-device sync.
- Settings phân loại:
  - **User-controlled:** theme, language, downloadFolder, autoDownload, telegramDefaults, inputTimeout, randomDelay.
  - **Server-controlled (lazy hydration):** defaultImageModel, defaultVideoModel, telegramFlowModel (lấy từ ModelRegistry, không hard-code).

### A2. Read settings ✅

- **Trigger:** App init.
- **Steps:**
  1. Đọc local `af_settings` (instant).
  2. Render UI ngay với local values.
  3. Background: `GET /settings` → merge server > local cho user-controlled keys, sau đó hydrate server-controlled keys.
  4. Persist merge result lại local.
- **Case lỗi:**
  - **Server fail:** dùng local, retry sau 60s.
  - **User mới (no local + no server):** dùng defaults từ `MOCK_DEFAULT_SETTINGS` (mock) / `/default-settings`.

### A3. Write settings ✅

- **Trigger:** User đổi setting trong UI.
- **Steps:**
  1. Optimistic update Zustand + local persist.
  2. Debounce 1s → `PUT /settings` body `{ partial }`.
  3. Other tabs nhận `chrome.storage.onChanged` → sync state.
  4. Other devices nhận SSE event `auth:settings_updated` → reload.
- **Case lỗi:**
  - **Server validate fail (422):** rollback local + show inline error.
  - **Quota write rate-limit (429):** queue retry exponential.
  - **Network offline:** local OK, server retry khi online lại (xem `BackendSync`).

### A4. Owner cache validation ✅

- **Trigger:** Bất kỳ lần read settings.
- **Steps:** check `af_settings._ownerId === current user.id`. Khác → discard local + reload từ server.
- **Case lỗi:** Cross-user contamination (user A logout → user B login chung browser) → owner validation đảm bảo không leak settings.

### A5. Pending resync sau token expire ✅

- Xem `01-auth.md` A6. Snapshot trước logout → restore khi login lại.

### A6. Lazy hydration model defaults 📋

- **Trigger:** UI render dropdown cần default model (Gen / Telegram / Workflow).
- **Steps:** Đọc `af_settings.defaultImageModel`; nếu null → fetch `ModelRegistry.getDefault('image')` (3-retry exponential backoff 1s/2s/4s).
- **Case lỗi:** ModelRegistry chưa load → fallback `MOCK_MODELS` first `is_default=true`, sau đó refetch background.

### A7. Deep comparison khi save 📋

- **Trigger:** Save settings.
- **Steps:** Deep-compare snapshot trước/sau để xác định thay đổi thật (`Object.keys.length` không đủ — fail sau fresh install persist defaults).
- **Case lỗi:** No real change → skip PUT để tiết kiệm bandwidth.

---

## B. i18n bootstrap

### B1. Pre-React loading i18n 📋

- **Trigger:** HTML load (sidebar.html / settings.html) trước khi React boot.
- **Steps:**
  1. `loading-i18n.ts` script đọc `chrome.storage.local.af_locale` (async ~100ms).
  2. Mini-i18n render text overlay loading theo locale (vi/en).
  3. Default render English nếu storage chưa có → update khi callback fire.
- **Case lỗi:** Storage fail → giữ English; không break.

### B2. Resolve locale ✅

- **Priority chain:**
  1. URL param `?lng=vi` (chủ yếu cho test).
  2. `af_locale` (user pick từ Language Selector).
  3. `af_settings.language` (server-controlled default từ user profile).
  4. `MOCK_DEFAULT_SETTINGS.default_locale` (admin default).
  5. `navigator.language.slice(0, 2)` nếu ∈ `['vi', 'en']`.
  6. Fallback `'vi'`.
- **Case lỗi:** Tất cả fail → 'vi'.

### B3. Load translations ✅

- **Trigger:** Sau resolve locale.
- **Steps:**
  1. Đọc cache `af_i18n_cache_<locale>` (TTL 5 phút).
  2. Hợp lệ → set translations, init i18next.
  3. Background: `GET /i18n/{locale}` → merge flat-keys (dot-notation) thành nested object → update cache.
- **Case lỗi:**
  - **Timeout 8s:** dùng cache (kể cả stale); báo log warn.
  - **Empty response:** fallback static JSON `src/i18n/locales/<lng>.json`.

### B4. Switch locale runtime ✅

- **Trigger:** User click Language Selector.
- **Steps:**
  1. `setLocale(lng)` → save `af_locale` + emit `i18n:changing`.
  2. Load translations mới (xem B3).
  3. `i18next.changeLanguage(lng)` → re-render toàn UI.
  4. Emit `i18n:changed`.
- **Case lỗi:** Load fail → revert về locale cũ + toast "Không tải được {locale}, dùng tạm {fallback}".

### B5. Server version bump ✅

- **Trigger:** SSE event `config_versions_bumped` payload `{ i18n: { vi: 5, en: 5, ... } }`.
- **Steps:** So với version cache; mismatch → re-fetch locale hiện tại; các locale khác refresh lazy khi switch.

### B6. Translation key fallback ✅

- **Trigger:** `t('key.missing')`.
- **Steps:** i18next default fallback Lng 'vi' → nếu vẫn miss → trả `undefined` (KHÔNG raw key) để caller xử lý.
- **Case lỗi:** Production bug → debug log 1 lần/key/session.

---

## C. Theme (dark/light/auto)

> **2026-05-29 update:** brand đổi sang **coral (light) / violet (dark)** theo Claude Design handoff. Chi tiết tokens xem [`features/00-design-system.md`](00-design-system.md). Light KHÔNG còn là just "tone neutral" — là **warm cream `#f1ede4`** với accent coral; dark là near-black `#0c0c10` với accent violet (≡ `node.generate`).

### C1. Apply theme ✅

- **Trigger:** App init, user toggle.
- **Steps:**
  1. Đọc `af_theme: 'light'|'dark'|'auto'`.
  2. `auto` → effective = `prefers-color-scheme` media query.
  3. `document.documentElement.classList.toggle('dark', effective === 'dark')`.
  4. CSS vars trong `src/index.css` swap toàn bộ palette (`--background`, `--primary`, `--card`, …). Component KHÔNG cần re-render — re-paint browser-level.
- **Case lỗi:** Storage corrupt → default 'auto'.

### C2. Listen system preference ✅

- **Trigger:** `prefers-color-scheme` change.
- **Steps:** Re-evaluate effective nếu `theme === 'auto'`; emit `theme:changed`.
- **Case lỗi:** Browser cũ không support `matchMedia.addListener` → poll mỗi 30s (rare).

### C3. Per-popup theme inheritance 📋

- Settings/Angles/Effects popups đọc `af_theme` cùng key → đồng bộ tự động.

---

## D. Offline detection

### D1. Online/offline events ✅

- **Trigger:** `window.online` / `window.offline`.
- **Steps:** set `useAppStore.online = bool`; nếu offline → render `<OfflineOverlay />`.
- **Case lỗi:** Browser false-positive (offline event nhưng có mạng) → kết hợp ServerHealthCheck (D2).

### D2. Server health probe ✅

- **Trigger:** App init + manual retry button.
- **Steps:** `GET /health` (5s timeout, cache 30s). 200 → online. Timeout/network → offline.
- **Case lỗi:**
  - **Server down nhưng có mạng:** vẫn show offline overlay với message "Máy chủ đang gián đoạn".
  - **CORS error:** fallback `chrome.runtime.sendMessage` → background fetch.

### D3. SSE auto-reconnect khi online ✅

- **Trigger:** `online` event sau khi offline.
- **Steps:** SseClient init → connect lại; ConfigVersionPoller poll ngay 1 lần để bắt missed events.

---

## E. Logging

### E1. Log sinks ✅ (skeleton)

- **Trigger:** Mọi log call `logger.info|warn|error|debug`.
- **Steps:**
  1. Format `[HH:MM:SS.mmm] [LEVEL] [Module] message`.
  2. Sinks:
     - Console (dev mode hoặc level ≥ warn).
     - Ring buffer `af_logs` chrome.storage (max 200).
     - In-memory cho Logs tab UI.
- **Case lỗi:** Storage write fail → log to console + tiếp tục.

### E2. Logs tab UI ✅ (skeleton)

- **Trigger:** Mở tab "Logs".
- **Steps:** Render virtualized list (newest top), filter level, search text.
- **Case lỗi:** Empty → "Chưa có log nào".

### E3. Export logs 📋

- **Trigger:** Click "Export .txt".
- **Steps:** Serialize buffer → trigger `chrome.downloads.download` blob `logs-{date}.txt`.
- **Case lỗi:** Browser block download → fallback open new tab `data:text/plain`.

### E4. Sensitive data masking ✅

- **Steps:**
  - Token: replace với `***<last4>`.
  - Email: keep first char + `***@domain`.
  - Password: never log.
  - Prompt: log chỉ 60 ký tự đầu (debug mode log full).
- **Case lỗi:** Regex miss → fallback opt-out flag user setting.

---

## F. Keyboard Shortcuts

| Combo | Action | Scope |
|---|---|---|
| `Alt+G` | Open Gen tab | Global (chrome.commands) |
| `Alt+S` | Toggle sidebar | Global |
| `Ctrl+S` | Save workflow | Workflow editor |
| `Ctrl+Z` / `Ctrl+Y` | Undo/Redo | Editor |
| `Esc` | Close modal | App |
| `Ctrl+Enter` | Submit prompt | GenTab |
| `Ctrl+/` | Open snippets | GenTab |
| `Delete` | Remove selected node | Editor |
| `Space` (hold) | Pan canvas | Editor |
| `Ctrl+A` | Select all nodes | Editor |
| `Ctrl+D` | Duplicate selected | Editor |

### F1. Registration 📋

- **Trigger:** App boot.
- **Steps:** chrome.commands trong manifest (Alt+G, Alt+S); React hook `useHotkey` cho phần còn lại.
- **Case lỗi:** Combo trùng với extension khác → Chrome notify user; fallback shortcut khác.

### F2. Conflict & Customize 📋 (P6+)

- Settings → Keyboard → cho user remap (chrome://extensions/shortcuts cho global, app settings cho local).

---

## G. SSE Client

### G1. Connect ✅ (P4+)

- **Trigger:** App boot + `auth:login`.
- **Steps:**
  1. SseBroadcastManager elect leader (1 tab/sidebar duy nhất hold SSE connection).
  2. Leader: `EventSource('/sse')` với signed headers; followers nhận events qua BroadcastChannel.
  3. Heartbeat timeout 45s — không nhận message trong 45s → close + reconnect.
- **Case lỗi:**
  - **Connect fail:** exponential backoff 2→4→8→30s (cap).
  - **Auth 401:** trigger refresh token, reconnect.
  - **Clone detected:** không connect, ưu tiên overlay.

### G2. Reconnect strategy ✅

- **Trigger:** Connection drop.
- **Steps:**
  1. Backoff exponential cap 30s.
  2. Flapping protection: nếu fail 3 lần trong 10s → pause 30s.
  3. Phase 2: thử Mercure Hub với JWT (cache 2h); fallback poll nếu 401.
- **Case lỗi:** Persistent fail → downgrade polling `/notifications`, `/announcement`, `/config/versions` mỗi 30s.

### G3. Leader election (multi-tab) 📋

- **Trigger:** Multiple sidebars open.
- **Steps:**
  1. SseBroadcastManager dùng `chrome.storage.local.af_sse_leader = { tabId, expires_at }` + heartbeat 5s.
  2. Leader gửi events qua BroadcastChannel → followers consume.
  3. Leader chết (no heartbeat 10s) → first follower nhảy lên leader.
- **Case lỗi:** Race election → lock qua `Math.random + timestamp` → tab có ID nhỏ hơn thắng.

### G4. Events demultiplex ✅

| Event type | Handler |
|---|---|
| `config_versions_bumped` | ConfigVersionPoller refresh modules |
| `featuregate:refresh` | FeatureGate.refresh() |
| `notification` | NotificationManager.push |
| `announcement_changed` | AnnouncementManager.refresh |
| `quota_warning` | toast cảnh báo |
| `auth:settings_updated` | SettingsStore reload |
| `telegram:command/cancel/stop` | TelegramExecutor |
| `provider:api_config_updated` / `provider:models_updated` | ProviderConfigManager + ModelRegistry refresh |
| `plan_activated` / `order_paid` | UpgradeModal close, FeatureGate.refresh |
| `referral_rewarded` | toast + refresh |
| `tip_received` | toast |

### G5. Lifecycle close 📋

- Logout / app close → `POST /sse/end-session` best-effort, close connection.
- **Case lỗi:** API fail → connection sẽ tự cleanup server-side sau timeout.

---

## H. ConfigVersionPoller (fallback khi SSE drop)

### H1. Poll versions 📋

- **Trigger:** App boot + interval (30 phút khi SSE ok, 5 phút khi SSE down).
- **Steps:**
  1. `GET /config/versions` → `{ system_settings: X, providers: Y, i18n: { vi: Z, en: ... }, user_entitlements: W }`.
  2. Diff với cache `af_config_versions`.
  3. Mismatch per module → call respective refresh: `SystemConfig._updateFromVersion`, `ProviderConfigManager.refresh`, `I18n._updateFromVersion`, `FeatureGate.refresh`.
- **Case lỗi:**
  - **First init:** fetch để set baseline, KHÔNG refresh ngay (avoid cold-start storm).
  - **Endpoint 404 (backend phase cũ):** disable polling, log warn once.
  - **Network fail:** giữ versions cũ, retry next tick.

### H2. SSE-triggered instant check 📋

- **Trigger:** SSE event `config_versions_bumped`.
- **Steps:** bỏ qua interval, gọi H1 ngay.

---

## I. Storage keys index

| Key | Layer | Mục đích |
|---|---|---|
| `af_settings` | chrome.storage.local | User+server settings merge |
| `af_settings_pending_resync` | chrome.storage.local | Restore sau token expire |
| `af_locale` | chrome.storage.local | User language pick |
| `af_i18n_cache_<locale>` | chrome.storage.local | Translation cache |
| `af_theme` | chrome.storage.local | light/dark/auto |
| `af_config_versions` | chrome.storage.local | Module versions cache |
| `af_logs` | chrome.storage.local | Ring buffer logs |
| `af_sse_leader` | chrome.storage.local | Leader election |
| `af_health_cache` | memory + storage | 30s ServerHealthCheck |

## J. Global events emit

| Event | Khi nào |
|---|---|
| `app:bootstrapped` | sau khi i18n + settings + entitlements load lần đầu |
| `i18n:changing` / `i18n:changed` | locale switch |
| `theme:changed` | apply theme |
| `online` / `offline` | network state |
| `health:offline` / `health:online` | server probe |
| `sse:connected` / `sse:disconnected` | SSE lifecycle |
| `sse:leader_elected` | tab thành leader |
| `config:versions_bumped` | poll detect mismatch |
| `logger:flush` | export logs |
