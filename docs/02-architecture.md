# 02 — Architecture

## 1. High-level diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BROWSER (Chrome / Edge)                          │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  SIDE PANEL      │  │  POPUP WINDOWS   │  │ CONTENT SCRIPTS  │  │
│  │  (sidebar.html)  │  │  workflow-editor │  │ (injected vào    │  │
│  │                  │  │  angles-editor   │  │  trang provider) │  │
│  │  Tabs: Gen /     │  │  effects-editor  │  │  - labs.google   │  │
│  │  MultiTask /     │  │  settings        │  │  - chatgpt.com   │  │
│  │  Workflow / etc  │  │                  │  │  - grok.com      │  │
│  │                  │  │                  │  │  - gemini        │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                     │            │
│           └────────┬────────────┴─────────────────────┘            │
│                    │                                                │
│         chrome.runtime.sendMessage / BroadcastChannel              │
│                    │                                                │
│           ┌────────▼─────────────┐                                 │
│           │  SERVICE WORKER       │                                 │
│           │  (background.js)      │                                 │
│           │  - apiRequest proxy   │                                 │
│           │  - alarms             │                                 │
│           │  - downloads.start    │                                 │
│           │  - tabs management    │                                 │
│           └────────┬──────────────┘                                 │
│                    │ fetch (CORS-free)                              │
└────────────────────┼────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (labs.toby.vn)                           │
│                                                                      │
│  REST API:      /api/v1/auth, /workflows, /execution, /entitle...   │
│  SSE Stream:    /api/v1/sse/stream  (legacy, paid user)             │
│  Polling:       /api/v1/events/poll (free user, 30s)                │
│  Mercure Hub:   /.well-known/mercure (Phase 2, paid user, JWT 2h)   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Bốn execution context

Extension chạy đồng thời trên **4 context khác nhau** với address space riêng:

| Context | File entry | Có DOM? | Có chrome.* full? | Lifecycle |
|---|---|---|---|---|
| **Service Worker** | `background.ts` | ❌ | ✅ | Lazy, Chrome có thể kill |
| **Side Panel** | `sidebar.html` → `app.tsx` | ✅ | ✅ | Tồn tại khi panel mở |
| **Popup Window** | `workflow-editor.html` etc. | ✅ | ✅ | Tồn tại khi window mở |
| **Content Script** | `content.ts` (isolated) + `slate-bridge.ts` (MAIN) | ✅ (trang provider) | Hạn chế | Tồn tại theo tab provider |

**Quy tắc trao đổi**:
- Sidebar/Popup ↔ Service Worker: `chrome.runtime.sendMessage(msg, cb)`
- Service Worker ↔ Content Script: `chrome.tabs.sendMessage(tabId, msg, cb)`
- Sidebar ↔ Popup ↔ Service Worker: `BroadcastChannel('tobyflow-broadcast')` cho realtime broadcast (vd: node:phase event)
- Mọi context ↔ Storage: `chrome.storage.local` (sync khi `onChanged` fire)

---

## 3. Data flow chính

### 3.1 User generate 1 ảnh từ Tab Generate

```
[GenTab UI]
   │ user click "Generate"
   ▼
[ExecutionGate.request('generate', 1)]  ─POST /execution/request──→ [Backend]
   │                                                                  │
   │ ← { allowed: true, token, remaining }                            │
   ▼
[ExecutionLock.acquire('generate')]  ← single-runner lock locally
   │
   ▼
[ProviderRegistry.get('flow')] → [FlowAdapter.submit({prompt, refs, ratio, model})]
   │
   ▼
[FlowAdapter.ensureReady()]
   │ 1. Find/Open tab labs.google/fx
   │ 2. ProviderTabLock.acquire(tabId)
   ▼
[chrome.tabs.sendMessage(tabId, 'flow:submit')]
   │
   ▼
[Content Script — content.ts]
   │ 1. Type prompt into Slate.js editor (via slate-bridge MAIN world)
   │ 2. Upload ref images via tRPC
   │ 3. Click "Generate"
   │ 4. Watch DOM for tile appearance (TileMonitor)
   │ 5. Extract file_name (UUID) khi tile xuất hiện
   │
   ▼
[Content Script → SW → Sidebar]  fileIds[], thumbnails, file_names
   │
   ▼
[ExecutionGate.complete(token, 'success')]  ─POST /execution/complete──→ [Backend]
   │
   ▼
[ImageStore.addToAlbum() if saveToAlbum]
[DownloadExecutor.download() if auto_download]
[FeatureGate.recordGenRun()]
[Emit eventBus 'generation:complete']
[ExecutionLock.release('generate')]
```

### 3.2 User chạy workflow đa node

```
[WorkflowTab — click Run]
   │
   ▼
[claimRunningFlag(wf_id)]  ← Web Locks API + chrome.storage cross-context
   │
   ▼ (nếu lock OK)
[Topological sort nodes]
   │
   ▼ For each node in order:
   │   ┌──────────────────────────────────────────────┐
   │   │ if generate/chatgpt/grok:                    │
   │   │   ExecutionGate.request('workflow_run', N)    │
   │   │   ↓                                           │
   │   │   ProviderAdapter.submit(...)                 │
   │   │   ↓                                           │
   │   │   broadcastEvent('node:phase', 'sending')     │
   │   │   broadcastEvent('node:phase', 'generating')  │
   │   │   broadcastEvent('node:phase', 'downloading') │
   │   │   ↓                                           │
   │   │   ExecutionGate.complete(token, status)       │
   │   │                                               │
   │   │ if download: DownloadExecutor.download(...)   │
   │   │ if telegram: TelegramExecutor.send(...)       │
   │   │ if delay: await sleep(...)                    │
   │   │ if condition: pick branch                     │
   │   └──────────────────────────────────────────────┘
   │   ↓
   │   pulseHeartbeat(wf_id)  every 60s
   │   ↓
   │   _updateNodeStatus → broadcast cross-context
   ▼
[clearRunningFlag(wf_id)]
[Emit 'execution:completed']
```

---

## 4. Module layers

Code organize thành 6 layer (mỗi layer chỉ phụ thuộc layer dưới):

```
┌──────────────────────────────────────────────────────────────┐
│ Layer 6 — UI Components (React)                              │
│  GenTab, MultiTaskTab, WorkflowTab, PhotosTab,               │
│  HistoryTab, modals, dialogs                                 │
├──────────────────────────────────────────────────────────────┤
│ Layer 5 — Feature Hooks (React hooks)                        │
│  useAuth, useWorkflow, useExecution, useGeneration,          │
│  useFeatureGate, useNotifications                            │
├──────────────────────────────────────────────────────────────┤
│ Layer 4 — Domain Services (TS classes, framework-free)       │
│  WorkflowExecutor, ExecutionGate, FeatureGate,               │
│  AuthManager, ProviderRegistry, NotificationManager          │
├──────────────────────────────────────────────────────────────┤
│ Layer 3 — Provider Adapters                                  │
│  FlowAdapter, ChatGPTAdapter, GrokAdapter, GeminiAdapter     │
├──────────────────────────────────────────────────────────────┤
│ Layer 2 — Infrastructure                                     │
│  SseClient, SseBroadcastManager, MessageBridge,              │
│  RequestSigner, ApiClient, BlobUrlManager                    │
├──────────────────────────────────────────────────────────────┤
│ Layer 1 — Storage / Persistence                              │
│  ImageStore, AlbumStore, PendingUploadStore (IndexedDB)      │
│  StorageManager (chrome.storage)                              │
└──────────────────────────────────────────────────────────────┘
```

**Quy tắc**: Component không bao giờ gọi `fetch` trực tiếp. Component → Hook → Service → Adapter → Infra.

---

## 5. Realtime: SSE + Mercure + Polling (3 transport)

Bài toán: paid user cần realtime push (notification, plan upgrade, share workflow), free user thì polling đủ.

### 5.1 Transport selection logic

```
isUserLoggedIn?
 ├─ No → no realtime
 └─ Yes →
    isPaidPlan? (FeatureGate)
     ├─ No → POLLING (30s, GET /events/poll)
     └─ Yes → try MERCURE first
        GET /sse/subscribe-token
         ├─ 200 OK → connect EventSource(mercure_url, jwt)
         ├─ 403 SSE_REQUIRES_PAID → cache no_mercure, fallback POLLING
         ├─ 404 → backend chưa Phase 2 → fallback LEGACY SSE
         └─ 503 MERCURE_DISABLED → fallback LEGACY SSE

   LEGACY SSE:
     POST /sse/ticket
      ├─ 200 → EventSource(/sse/stream?ticket=...)
      └─ 403 fallback_url=/events/poll → POLLING
```

### 5.2 Multi-tab leader-follower

Có 3 sidepanel/popup mở cùng lúc → KHÔNG được tạo 3 EventSource (waste connection + server reject duplicate).

**Solution**: `SseBroadcastManager` dùng `BroadcastChannel('tobyflow-sse')`:
- Mỗi tab gọi `electLeader()` → ai có timestamp nhỏ nhất thắng
- Chỉ leader tạo EventSource thật
- Leader nhận event → broadcast qua channel
- Follower nhận từ channel, không tạo connection riêng
- Leader chết → followers detect (timeout 5s), election lại

### 5.3 Event types từ server

| Event type | Payload | Hành động client |
|---|---|---|
| `notification` | `{title, body, severity, link}` | Add to notification bell |
| `plan_activated` | `{plan, expires_at}` | Refresh FeatureGate, reload entitlements |
| `quota_warning` | `{action, remaining}` | Toast warning |
| `quota_exhausted` | `{action}` | Show denied dialog |
| `workflow_shared` | `{wf_id, sharer}` | Refresh template list |
| `announcement` | `{title, body, target}` | Show announcement modal |
| `force_logout` | `{reason}` | Logout, show reason |
| `config_updated` | `{key, version}` | Re-fetch config (Provider/i18n/Model) |
| `force_reload_extension` | — | `chrome.runtime.reload()` |

---

## 6. Cross-context state sync

### 6.1 Workflow executor running flag

Vấn đề: user mở sidebar + popup editor cùng lúc, click Run ở cả 2 → race condition.

**Giải pháp 2 lớp**:

1. **Web Locks API** (atomic acquire-or-fail):
   ```ts
   await navigator.locks.request(
     'af_running_workflow_claim',
     { ifAvailable: true, mode: 'exclusive' },
     async (lock) => {
       if (!lock) return { ok: false }; // tab khác đang giữ
       return await doClaim();
     }
   );
   ```

2. **chrome.storage flag**:
   ```ts
   chrome.storage.local.set({
     af_running_workflow: {
       wf_id, wf_name, started_at, last_heartbeat_at, executor_context
     }
   });
   ```

3. **Heartbeat** mỗi 60s update `last_heartbeat_at`. Reader check: nếu stale > 5 phút → auto-clear (handle SW death).

### 6.2 Settings sync 2-tier

Khi user save settings ở popup, sidebar phải update — nhưng KHÔNG được đè giá trị user đang chỉnh trong session.

```
TIER 1 LIVE — luôn override:
  autoDownload, chatgptDeleteAfterGen
TIER 2 RESPECTFUL — chỉ override nếu chưa touch:
  genType, imageModel, videoModel, ratio, duration, downloadResolution
  → bind change listener → set dataset.userSet='true' khi user thay đổi
  → khi sync, check dataset.userSet === 'true' thì skip
```

### 6.3 Broadcast events cross-context

```ts
// Sender (vd WorkflowExecutor trong sidebar)
chrome.runtime.sendMessage({
  action: 'workflowExecutionEvent',
  event: 'node:phase',
  data: { nodeId, phase: 'generating' }
});

// Receiver (vd popup workflow-editor)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'workflowExecutionEvent') {
    eventBus.emit(msg.event, msg.data);
  }
});
```

---

## 7. Anti-clone (RequestSigner)

Mục đích: chống ai copy code extension upload Web Store khác.

**Cơ chế**:
1. Manifest có `key` (RSA public key) → mỗi extension cài đặt có 1 extension_id duy nhất.
2. Mọi request quan trọng (vd `GET /providers/api-configs`) đính header:
   ```
   X-Ext-Id: ${chrome.runtime.id}
   X-Ext-Sig: HMAC-SHA256(secret, method + path + body)
   X-Ext-Ts: ${Date.now()}
   ```
3. Backend whitelist `ext_id` → nếu không khớp trả 403 `EXTENSION_NOT_AUTHORIZED`.
4. Client gặp 403 → hiện `clone-detected-overlay` blocking entire UI.
5. Self-heal: background poll `GET /health` mỗi 60s → nếu admin add lại whitelist → overlay tự ẩn.

Secret HMAC được trộn vào code (obfuscated build) — không phải client-side secret thật sự bảo mật, nhưng đủ để chặn copy đơn giản.

---

## 8. Error & Retry strategy

### 8.1 Categorize errors

| Code | Hành động |
|---|---|
| `RATE_LIMITED` (429) | Backoff 60s, không logout |
| `EXTENSION_NOT_AUTHORIZED` | Block UI, không logout |
| `TOKEN_EXPIRED` (401) | Try `auth/refresh` → nếu fail → logout |
| `QUOTA_EXCEEDED` | Show denied dialog với upgrade CTA |
| `CONTENT_BLOCKED` | Toast đỏ với policy link |
| `IMAGE_GEN_FAILED` | Retry tối đa 2 lần, sau đó báo fail |
| `CHALLENGE_TIMEOUT` (Cloudflare) | Toast persistent, escalate sau 30s |
| `NETWORK` | Offline overlay |
| `SUBSCRIPTION_REQUIRED` | Upgrade modal |
| `IMAGE_LIMIT` | Toast: "Đã hết quota free" |

### 8.2 Retry helper

```ts
class RetryHelper {
  static async withBackoff<T>(
    fn: () => Promise<T>,
    opts: { maxRetries: 3, baseMs: 1000, maxMs: 30000 }
  ): Promise<T> {
    // exponential backoff với jitter
  }
}
```

### 8.3 SSE reconnect

5s → 10s → 20s → 40s → 60s max. Sau 10 lần thất bại liên tục → dừng, chờ user action (focus tab, click retry).

---

## 9. Config-as-Data (Server-Driven)

Tất cả config "thay đổi được" đều fetch từ server, KHÔNG hard-code:

| Config | Endpoint | TTL cache |
|---|---|---|
| Models list | `GET /provider-models` | 5 phút |
| Provider configs (URL, API key) | `GET /providers/api-configs` | 5 phút |
| DOM selectors (XPath/CSS) | `GET /providers/dom-selectors` | 5 phút |
| Execution config (timeout, retry) | `GET /system-config/execution` | 5 phút |
| System settings (public) | `GET /system-settings/public` | 5 phút |
| Validation rules | `GET /validation-rules` | 5 phút |
| Plans | `GET /plans` | 1 giờ |
| Entitlements | `GET /entitlements` | 30s |
| i18n | `GET /i18n/{locale}` | 5 phút |
| Announcement | `GET /announcement` | Realtime via SSE |

**ConfigVersionPoller** poll `GET /config/version` mỗi 60s → nếu version đổi → re-fetch config tương ứng. SSE event `config_updated` cũng trigger refetch.

Mục tiêu: khi provider đổi selector, admin update DB → tất cả user nhận selector mới trong < 5 phút mà KHÔNG cần update extension qua Web Store.
