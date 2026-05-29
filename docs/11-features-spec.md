# 11 — Features Spec

Mỗi feature dưới đây = 1 vertical slice trong `src/features/<name>/`.

---

## 1. Auth

### Flow đăng ký
1. User mở Login modal (chưa có account) → tab Register
2. Nhập email, name, password, confirm password, referral code (optional)
3. POST `/auth/register` → server gửi email verify (optional)
4. Auto login: receive token → save `af_auth` → close modal → emit `auth:login`
5. Trigger `FeatureGate.refresh()` để load entitlements

### Flow đăng nhập email/password
1. POST `/auth/login` body `{email, password}`
2. Headers: `X-Fingerprint: <hash>`
3. Token + user → save `af_auth`
4. Emit `auth:login`

### Flow Google OAuth
```
[User click "Login with Google"]
    │
    ▼
[GET /auth/google/url]  → { auth_url }
    │
    ▼
[chrome.tabs.create({ url: auth_url, active: true })]
    │
    │ Google auth flow
    ▼
[Backend callback]
    │
    │ Redirect → https://your-backend.example.com/auth/google/success?token=<jwt>
    ▼
[Content script `oauth-bridge.ts` chạy trên trang success]
    │
    │ Parse query → chrome.runtime.sendMessage({ action: 'auth:google-callback', token, user })
    ▼
[Background] → save af_auth → close auth tab → broadcast 'auth:login'
    ▼
[Sidebar] react to chrome.storage.onChanged → update UI
```

### Token refresh logic
- Khi `auth/me` trả 401 → try `POST /auth/refresh` 1 lần
- Refresh fail → logout, redirect login modal
- Rate limit (429) → KHÔNG logout, retry sau backoff
- `EXTENSION_NOT_AUTHORIZED` → KHÔNG logout (giữ session, đợi self-heal)

### Logout
- POST `/auth/logout` (best-effort, không block UI)
- POST `/sse/end-session` để dọn server resource
- Remove `af_auth`, `af_entitlements_cache`, `af_referral_code`
- Disconnect SSE
- Emit `auth:logout` → UI reset về anonymous state
- Public entitlements (Free) vẫn fetch để render base UI

### Multi-tab logout sync
Tab A logout → `chrome.storage.onChanged` fire → Tab B detect `af_auth = null` → auto reset state.

---

## 2. Quota & FeatureGate

### Architecture
```
[UI action] → [useFeatureGate.canUse(key)] → quick check
                                           └── if denied, show upgrade modal
[UI action] → [ExecutionGate.request(action, count)] → server call → token
[UI action]                              └── if denied, show denied dialog
                  ↓
            [Actual execute]
                  ↓
[ExecutionGate.complete(token, status)]
```

### FeatureGate
```ts
class FeatureGate {
  private static entitlements: Entitlements | null = null;

  static async refresh(): Promise<void> {
    this.entitlements = await apiClient.get('entitlements').json<Entitlements>();
    await setStorage('af_entitlements_cache', this.entitlements);
    eventBus.emit('featuregate:refreshed', { entitlements: this.entitlements });
  }

  static canUse(feature: string): boolean {
    return !!this.entitlements?.features[feature]?.enabled;
  }

  static getQuota(action: string): QuotaInfo | null {
    return this.entitlements?.quotas[action] || null;
  }

  static recordWorkflowRun() { /* local UI counter only, server tracks via ExecutionGate */ }
  static recordGenRun() { ... }
  static recordChatGPTRun(count: number) { ... }
  static recordGrokRun(count: number) { ... }
  static recordPromptSubmit(count: number, source: string) { ... }

  // GP-7: Local daily stats (display only)
  private static _incrementDailyStat(key: string, delta: number) { ... }
}
```

### ExecutionGate
Đã spec trong `08-api-contract.md` và `09-workflow-engine.md`.

UX khi denied:
```tsx
function showDeniedDialog(gate: ExecutionResponse, label: string) {
  CustomDialog.show({
    title: gate.reason === 'QUOTA_EXCEEDED' ? `${label} — Hết quota hôm nay` : `${label} — Không thể chạy`,
    body: gate.reason === 'QUOTA_EXCEEDED'
      ? `Bạn đã dùng ${gate.used}/${gate.limit} lượt hôm nay. Reset sau ${formatRelative(gate.resets_at)}.`
      : `Lý do: ${gate.reason}`,
    actions: [
      { label: 'Đóng', variant: 'secondary' },
      { label: 'Nâng cấp', variant: 'primary', onClick: () => openUpgradeModal() },
    ],
  });
}
```

### Quota warning realtime
SSE event `quota_warning` khi remaining < 20% → toast nhẹ:
```
⚠️ Còn 5/200 lượt workflow_run hôm nay
```

---

## 3. i18n (4 ngôn ngữ)

### Architecture
- Server-side translations: `GET /i18n/{locale}` trả `{ version, translations: {...} }`
- Cache `af_i18n_cache_<locale>` 5 min
- `ConfigVersionPoller` poll `GET /config/version` → nếu `i18n.<locale>.version` đổi → invalidate cache

### Locale resolution

```ts
async function resolveLocale(): Promise<string> {
  // Priority:
  // 1. User explicit (sidebar language selector) → `af_settings.language`
  // 2. User preference từ server (`auth/me.preferred_locale`)
  // 3. Admin default (`/default-settings.default_locale`)
  // 4. Browser navigator.language
  // 5. Fallback 'vi'

  const settings = await getStorage<AppSettings>('af_settings');
  if (settings?.language) return settings.language;

  const auth = await getStorage<AuthSession>('af_auth');
  if (auth?.user?.preferred_locale) return auth.user.preferred_locale;

  const defaults = await apiClient.get('default-settings').json<{ default_locale: string }>();
  if (defaults.default_locale) return defaults.default_locale;

  const browserLang = navigator.language.slice(0, 2);
  if (['vi','en','th','ja'].includes(browserLang)) return browserLang;

  return 'vi';
}
```

### Bootstrap (trước khi React render)
- `loading-i18n.ts` script chạy đầu tiên (mini-i18n) để render loading overlay theo locale từ `chrome.storage`
- `clone-detected-i18n.ts` cho clone-detected overlay (vì có thể trigger trước khi i18next load)

### i18next setup
```ts
import i18n from 'i18next';
import HttpBackend from 'i18next-http-backend';

await i18n
  .use(HttpBackend)
  .init({
    backend: {
      loadPath: '{{API_BASE_URL}}/api/v1/i18n/{{lng}}',
      parse: (data) => JSON.parse(data).data.translations,
    },
    lng: await resolveLocale(),
    fallbackLng: 'vi',
    interpolation: { escapeValue: false },
  });
```

### Translation keys convention
```
namespace.context.label

Examples:
  header.settings
  header.upgrade
  dialog.confirm
  errors.rateLimit
  node.generateName
  workflow.actions.run
  auth.email
```

---

## 4. Anti-clone protection

### Mechanism
1. Manifest `key` field = RSA public key → unique extension_id derived
2. Backend whitelist `ext_id` (admin manage)
3. Mỗi request quan trọng đính `X-Ext-Id`, `X-Ext-Sig`, `X-Ext-Ts`
4. Backend reject 403 `EXTENSION_NOT_AUTHORIZED` nếu không match

### Client UX
```ts
// API client interceptor
apiClient.afterResponse(async (resp) => {
  if (resp.status === 403) {
    const body = await resp.json();
    if (body.code === 'EXTENSION_NOT_AUTHORIZED') {
      await setStorage('af_clone_detected', true);
      showCloneDetectedOverlay();
      // Background self-heal start
      startSelfHealProbe();
    }
  }
});
```

### Self-heal probe (background script)
```ts
let probeInterval: number;
function startSelfHealProbe() {
  probeInterval = setInterval(async () => {
    try {
      const resp = await fetch(`${API_BASE}/extension/authorized`, {
        headers: buildSignedHeaders('GET', '/api/v1/extension/authorized', '')
      });
      if (resp.ok) {
        await setStorage('af_clone_detected', false);
        hideCloneDetectedOverlay();
        clearInterval(probeInterval);
      }
    } catch {}
  }, 60_000);
}
```

---

## 5. Screen Capture

### Flow
```
[User click 🎨 capture button]
    │
    ▼
[chrome.tabs.query({ active: true, currentWindow: true })]
    │
    ▼
[Inject capture overlay into active tab (content script)]
    │
    ▼
[User drag-select region]
    │
    ▼
[chrome.tabs.captureVisibleTab → PNG dataURL]
    │
    ▼
[Crop to selected region (canvas)]
    │
    ▼
[POST /capture/upload (multipart) → { image_id, thumbnail_url }]
    │
    ▼
[Add to current context (GenTab ref or current node)]
    │
    ▼
[Emit 'capture:complete']
```

### UI
- Toolbar overlay xuất hiện trên trang
- Crosshair cursor
- Drag → rectangle selection
- Press ESC → cancel
- Auto-confirm sau drag release

---

## 6. Album

### CRUD
- `AlbumStore.create(name)` → POST `/albums`
- `AlbumStore.list()` → useQuery `/albums`
- `AlbumStore.addImages(albumId, imageIds)` → POST `/albums/{id}/images`
- `AlbumStore.delete(albumId)` → DELETE

### Image thumbnail tiers
Khi save image vào album:
1. Source: blob từ ImageStore (đã fetch + cache)
2. Compute:
   - Thumbnail: resize max 200px, JPEG quality 0.7 → 50KB target
   - Medium: resize max 1200px, WebP quality 0.85
   - Original: giữ nguyên blob
3. Lưu vào `image_blobs` với 3 entry (key = `${id}__thumbnail`, etc.)

### Browse UI
- Grid layout 2-3 col
- Thumbnail loaded first → swap medium khi hover/zoom
- Click → modal full-screen viewer load original

---

## 7. Snippets & MyPrompts

### Snippet vs UserPrompt vs Addon
- **Addon**: server-curated prompts (admin push)
- **UserPrompt**: user save own prompts
- Cả 2 đều stored `/prompts` với field `is_addon`

### Features
- Tag filtering
- Search by title/content
- `{placeholder}` template — UI gen form khi insert
- `@ref_name` resolved tự động khi insert vào prompt area

### Insert flow
1. User mở Snippets panel ở GenTab
2. Click 1 snippet → check có `{}` placeholder?
   - Yes → modal nhập values
   - No → insert vào prompt area at cursor
3. Track `use_count++` qua PATCH `/prompts/{id}`

---

## 8. Templates (Workflow templates)

### Browse
- Tab Templates trong Workflow → grid cards
- Filter by category
- "Official" badge cho admin-curated
- Click → preview workflow (read-only canvas)
- "Use" → clone về workflow của user, mở editor

### Save as template
- Right-click workflow card → "Save as template"
- Modal: name, description, category, thumbnail
- POST `/templates` body `{ name, description, category, workflow_data: { nodes, edges, canvas } }`

---

## 9. Telegram Integration

### Link account
1. User chưa link → click "Link Telegram" trong settings
2. POST `/telegram/link-init` → `{ bot_username, link_code, expires_at }`
3. UI hiển thị: "Mở @TobyFlowBot trên Telegram, gõ `/start <link_code>`"
4. User làm xong → backend xác nhận → fire SSE event `telegram:linked`
5. UI refresh → "Linked as @username"

### Send result
- Workflow node `telegram` execute → POST `/telegram/send-workflow-images` body `{ file_ids, caption, mode }`
- Backend gọi Telegram bot API → gửi tới chat user đã link

### Notify completion
- Setting "Notify on complete" → khi workflow xong → POST `/telegram/notify-completion`

---

## 10. Notifications & Announcement

### Notification bell (header)
- Badge count = `af_notification_unread_count`
- Click → open panel với list notifications
- Mark as read individually hoặc all
- Auto-update qua SSE event `notification`

### Announcement modal
- Server push qua SSE event `announcement` hoặc fetch `/announcement` khi sidebar open
- Show modal blocking nếu `severity = 'critical'`
- Show banner nhẹ nếu `severity = 'info'`
- Dismiss → save ID vào `af_announcement_dismissed`, không show lại

### Changelog
- Compare current version (manifest) với `af_changelog_version_seen`
- Khác → show badge dot trên changelog button
- Click button → open changelog markdown (fetch from `/changelog`)
- Mark seen → save current version

---

## 11. Referral

### Display
- User dropdown → "Refer friends" section
- Show code (e.g., `TOBY-XYZ123`), copy button, share button
- Stats: `12 đã đăng ký • 3 đã nâng cấp`

### Share
- Click share → use Web Share API hoặc copy share URL
- URL format: `https://your-backend.example.com/r/TOBY-XYZ123`
- Khi friend click → set cookie `ref_by=TOBY-XYZ123` → khi register, send field `referred_by`

### Reward
- Backend tracks: registered count, converted (became paid) count
- Reward formula: 7 days Pro per conversion (configurable)
- Fire SSE event `referral_rewarded` khi friend upgrade

---

## 12. Tip Coffee

### Flow
1. Header → ☕ button → tip modal
2. Modal:
   - Description
   - Amount input + quick buttons (20k/30k/50k/100k/200k)
   - Click amount → POST `/tip` body `{ amount, currency }` → return `{ qr_url, bank_info, transfer_content }`
   - Show QR + bank info
3. User scan QR bằng banking app → chuyển khoản
4. (Optional) Backend auto-detect bank webhook → show "Thank you!" toast via SSE

### VietQR
- Backend tạo URL: `https://img.vietqr.io/image/<bank>-<account>-<template>.png?amount=<amount>&addInfo=<content>`
- Hoặc gen QR client-side với `qrcode` library

---

## 13. VietQR Payment (Plan upgrade)

### Flow
1. User click Upgrade → Upgrade modal
2. Pick plan → POST `/orders` body `{ plan_key, duration_days, currency, payment_method: 'vietqr' }`
3. Response: `{ order_id, vietqr_url, bank_info, expires_at }`
4. Modal switch to payment view:
   - QR image
   - Bank info (account no, content)
   - Countdown timer
   - "I've paid" button (manual confirm trigger backend poll)
5. Backend polls bank webhook → khi receive khớp `transfer_content` → activate plan
6. SSE event `plan_activated` → close modal, show success
7. Refresh FeatureGate, badge update Free → Pro

### Order states
- `pending`: chờ thanh toán
- `paid`: nhận tiền, đang verify
- `activated`: plan đã active
- `expired`: hết hạn, chưa pay
- `cancelled`: user cancel

---

## 14. Angles Editor (popup window)

### Mục đích
Cho user pick góc camera cho video gen (vd: bird's eye, low angle, dolly...)

### Flow
1. Trong GenTab hoặc workflow node, click "Angles" → mở popup `angles-editor.html` (chrome.windows.create)
2. Popup load presets từ `GET /angle-presets`
3. UI grid presets với thumbnail
4. User click 1 preset → preview animation
5. Click "Apply" → postMessage về sidebar/popup gốc → set vào node config

### Data
```ts
interface AnglePreset {
  id: string;
  name: string;
  description: string;
  params: { camera_angle: string; movement: string; speed: number; ... };
  thumbnail_url: string;
}
```

---

## 15. Effects Editor (popup window)

Tương tự Angles Editor nhưng cho video effects (slow motion, color grade, transitions).

---

## 16. Offline detection

### Detection
```ts
window.addEventListener('online', () => setOnline(true));
window.addEventListener('offline', () => setOnline(false));

// Periodic ping (mỗi 30s khi suspected offline)
async function pingServer() {
  try {
    await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    setOnline(true);
  } catch {
    setOnline(false);
  }
}
```

### UX
- `setOnline(false)` → set `af_offline = true` → render `<OfflineOverlay />`
- Block tất cả interaction
- Retry button → call ping
- SSE auto-reconnect khi online lại

---

## 17. Settings sync (server)

Khi user thay đổi settings:
1. UI dispatch `useSettingsStore.setState({ key: value })`
2. Persist local: `chrome.storage.local.set({ af_settings })`
3. Debounce 1s → PUT `/settings` body partial
4. Server validate + save → other tabs receive `auth:settings_updated` SSE → reload

---

## 18. Logging

### Levels
`debug | info | warn | error`

### Sinks
1. `console.log` (dev mode)
2. Ring buffer in `af_logs` chrome.storage (max 200 entries)
3. Render to Logs tab DOM
4. Export → download .txt file

### Format
```
[14:32:15.123] [INFO] [WorkflowExecutor] Node "Generate" started
[14:32:18.456] [ERROR] [FlowAdapter] Selector not found: ratio_dropdown
```

### Sensitive data
- Mask token, password, email khi log
- Không log full prompt (chỉ 60 char preview) trừ debug mode

---

## 19. Dark/Light theme

### Persistence
- `af_theme: 'light' | 'dark' | 'auto'`
- `auto` → follow `prefers-color-scheme`

### Apply
```ts
function applyTheme(theme: 'light'|'dark'|'auto') {
  const effective = theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.classList.toggle('dark', effective === 'dark');
}
```

Tailwind `darkMode: 'class'`.

### React hook
```tsx
const { theme, setTheme, effectiveTheme } = useTheme();
```

---

## 20. Keyboard shortcuts

| Combo | Action | Scope |
|---|---|---|
| `Alt+G` | Generate | Global (Chrome command) |
| `Alt+S` | Toggle sidebar | Global |
| `Ctrl+S` | Save workflow | Editor |
| `Ctrl+Z` | Undo | Editor |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo | Editor |
| `Esc` | Close modal | App |
| `Ctrl+Enter` | Submit prompt | GenTab |
| `Ctrl+/` | Open snippets | GenTab |
| `Delete` | Remove selected node | Editor |
| `Space` | Pan canvas | Editor (hold) |
| `Ctrl+A` | Select all nodes | Editor |
| `Ctrl+D` | Duplicate selected | Editor |
