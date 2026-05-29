# 08 — API Contract

**Base URL**: `https://your-backend.example.com/api/v1`
**Auth scheme**: `Authorization: Bearer <jwt>` (trừ public endpoints)
**Anti-clone headers** (mọi request quan trọng):
```
X-Ext-Id:   <chrome.runtime.id>
X-Ext-Sig:  <HMAC-SHA256(secret, method + path + body)>
X-Ext-Ts:   <ms epoch>
```
**Content-Type**: `application/json` (trừ multipart upload)

---

## Conventions

### Response envelope
Mọi REST response (trừ stream) dùng format:
```json
{ "success": true, "data": {...} }
```
hoặc
```json
{ "success": false, "code": "QUOTA_EXCEEDED", "message": "Đã hết quota hôm nay", "data": {...} }
```

Field `data` (cả success + error case) chứa info bổ sung như quota remaining, retry_after, etc.

### Error codes chuẩn

| Code | HTTP | Mô tả |
|---|---|---|
| `OK` | 200 | |
| `RATE_LIMITED` | 429 | Backoff |
| `UNAUTHENTICATED` | 401 | Cần login |
| `TOKEN_EXPIRED` | 401 | Try refresh |
| `EXTENSION_NOT_AUTHORIZED` | 403 | Anti-clone fail |
| `QUOTA_EXCEEDED` | 403 | Hết quota module |
| `GLOBAL_QUOTA_EXCEEDED` | 403 | Hết quota global |
| `FEATURE_DISABLED` | 403 | Feature off |
| `PLAN_EXPIRED` | 403 | Hết hạn plan |
| `SUBSCRIPTION_REQUIRED` | 402 | Cần upgrade |
| `VALIDATION_ERROR` | 422 | Input invalid |
| `NOT_FOUND` | 404 | |
| `INTERNAL_ERROR` | 500 | |
| `MAINTENANCE` | 503 | Server bảo trì |

---

## 1. Health & Public

### `GET /health`
Public, không cần auth.
**Response**:
```json
{ "success": true, "data": { "status": "ok", "version": "1.5.2", "uptime_sec": 12345 } }
```

### `GET /system-settings/public`
Public.
**Response**:
```json
{
  "data": {
    "version": 42,
    "feature_flags": { "telegram": true, "mercure": true },
    "limits": { "max_workflow_nodes": 50, "max_ref_images": 10 },
    "timeouts": { "submit_ms": 60000, "tile_watch_ms": 300000 }
  }
}
```

### `GET /default-settings`
Public, dùng cho bootstrap i18n locale.
**Response**:
```json
{ "data": { "default_locale": "vi", "supported_locales": ["vi","en","th","ja"] } }
```

### `GET /location/me`
Geolocate by IP. Public.
**Response**:
```json
{ "data": { "country": "VN", "currency": "VND", "locale_suggest": "vi" } }
```

---

## 2. Auth

### `POST /auth/register`
**Body**: `{ email, password, name, referred_by? }`
**Response**: `{ data: { token, user } }`

### `POST /auth/login`
**Body**: `{ email, password }`
**Headers**: `X-Fingerprint: <hash>` (optional, để track device)
**Response**: `{ data: { token, refresh_token?, user, apiBaseUrl? } }`

### `POST /auth/logout`
Auth required.
**Response**: `{ success: true }`

### `POST /auth/refresh`
**Body**: `{ refresh_token? }` (hoặc dùng access token nếu chưa expired)
**Response**: `{ data: { token, user } }`

### `GET /auth/me`
Auth. Returns current user info.
**Response**: `{ data: { user: User } }`

### `POST /auth/forgot-password`
**Body**: `{ email }`
**Response**: `{ success: true, message: "..." }`

### `POST /auth/resend-verification`
Auth.

### `POST /auth/resend-verification-public`
Public.
**Body**: `{ email }`

### Google OAuth
- `GET /auth/google/url` → `{ data: { auth_url } }`. Client mở tab này.
- `GET /auth/google/link-url` → cho user đã login, link Google.
- `POST /auth/google/link` body `{ google_token }`
- `POST /auth/google/unlink`

### OAuth redirect flow
1. Client click "Login with Google" → fetch `/auth/google/url`
2. Mở tab mới với url đó
3. User auth qua Google → backend redirect `https://your-backend.example.com/auth/google/success?token=<jwt>&user=<base64>`
4. Content script `oauth-bridge.ts` chạy trên trang success → đọc query → `chrome.runtime.sendMessage({ action: 'auth:google-callback', token, user })`
5. Background → set `af_auth` → broadcast `auth:login`

### `PATCH /auth/me/preferred-currency`
**Body**: `{ currency: "VND"|"USD"|"THB"|"JPY" }`

---

## 3. Entitlements & Features

### `GET /entitlements`
Auth OPTIONAL — public version trả gói Free. Auth version trả gói user.
**Response**:
```json
{
  "data": {
    "user_id": "...",
    "plan": "pro",
    "plan_expires_at": "2026-06-30T00:00:00Z",
    "features": {
      "workflow_run":   { "enabled": true },
      "chatgpt":        { "enabled": true },
      "grok":           { "enabled": true },
      "gemini":         { "enabled": false, "reason": "plan" },
      "auto_download":  { "enabled": true },
      "auto_download_4k": { "enabled": true },
      "telegram_send":  { "enabled": true },
      "ref_images":     { "enabled": true },
      "save_album":     { "enabled": true },
      "share_workflow": { "enabled": false, "reason": "plan" }
    },
    "quotas": {
      "workflow_run":   { "action": "workflow_run", "limit": 200, "used": 47, "remaining": 153, "resets_at": "2026-05-29T00:00:00Z" },
      "generate":       { "limit": 500, "used": 120, "remaining": 380, "resets_at": "..." },
      "chatgpt_run":    { "limit": 100, "used": 5,   "remaining": 95,  "resets_at": "..." }
    }
  }
}
```

Frontend cache 30s. SSE event `quota_warning` / `quota_exhausted` / `plan_activated` → invalidate.

---

## 4. Execution Gate (CORE)

### `POST /execution/request`
**Body**:
```json
{
  "action": "workflow_run",  // 'generate' | 'task_run' | 'workflow_run' | 'angles_run' | 'effects_run'
  "prompt_count": 5,
  "metadata": { "owner": "workflow", "label": "Workflow A", "wf_id": "..." }
}
```
**Response success**:
```json
{
  "success": true,
  "data": {
    "execution_token": "exec_xxx",
    "expires_in": 300,
    "remaining": 148,
    "limit": 200,
    "used": 52,
    "global": { "remaining": 4500, "limit": 5000, "used": 500 }
  }
}
```
**Response denied (QUOTA_EXCEEDED)**:
```json
{
  "success": false,
  "code": "QUOTA_EXCEEDED",
  "message": "Đã hết quota workflow_run hôm nay",
  "data": { "remaining": 0, "limit": 200, "resets_at": "..." }
}
```

### `POST /execution/complete`
**Body**: `{ execution_token, status: "success"|"failed", actual_count?: number }`
**Response**: `{ success: true }`

### `POST /execution/cancel`
**Body**: `{ execution_token }`
Cancel mà không refund quota (tuỳ admin config).

---

## 5. Workflows

### `GET /workflows`
**Query**: `?page=1&size=20&search=foo&sort=updated_at&order=desc`
**Response**: `{ data: { items: Workflow[], total, page, size } }`

### `POST /workflows`
**Body**: `Omit<Workflow, 'wf_id'|'created_at'|'updated_at'|'owner_id'>`
**Response**: `{ data: { workflow: Workflow } }`

### `GET /workflows/{wf_id}`
### `PUT /workflows/{wf_id}`
### `DELETE /workflows/{wf_id}`

### `POST /workflows/{wf_id}/duplicate`
### `POST /workflows/{wf_id}/share`
**Body**: `{ visibility: 'public'|'unlisted'|'team', user_ids?: string[] }`
**Response**: `{ data: { share_url } }`

### Workflow execution status (real-time qua SSE, nhưng có REST fallback)
### `GET /workflows/{wf_id}/runs`
List execution runs với status.

### `PATCH /workflows/{wf_id}/nodes/{node_id}`
Update single node status (vd khi 1 node complete, sync cross-context):
**Body**: `{ status, result_file_ids, result_thumbnails, result_file_names, result_provider_urls, error_message }`

---

## 6. Workflow Templates

### `GET /templates/categories`
**Response**: `{ data: { categories: TemplateCategory[] } }`

### `GET /templates`
**Query**: `?category=marketing&official=true`
**Response**: `{ data: { items: WorkflowTemplate[] } }`

### `POST /templates`
Save workflow as template.
**Body**: `{ name, description, category, workflow_data }`

### `POST /templates/{id}/clone`
Create workflow từ template, return new workflow.

---

## 7. Albums & Images

### `GET /albums`
### `POST /albums` body `{ name }`
### `GET /albums/{id}`
### `PUT /albums/{id}` body `{ name, cover_image_id? }`
### `DELETE /albums/{id}`

### `GET /albums/{id}/images`
**Query**: `?page=1&size=50`

### `POST /albums/{id}/images`
**Body**: `{ image_ids: string[] }` add existing images.

### `DELETE /albums/{id}/images/{image_id}`

### `GET /photos`
Lấy tất cả ảnh user (không cần album).
**Query**: `?provider=flow&start_date=...&end_date=...&search=...`

### `POST /photos/upload` (multipart)
Upload ảnh từ máy local lên backend (cho ref image).
**Body**: `FormData(file, prompt?, album_id?)`
**Response**: `{ data: { image_id, file_name, thumbnail_url } }`

### `DELETE /photos/{image_id}`

---

## 8. Tile resolution (Flow specific)

### `POST /flow/tile-resolve`
Batch resolve file_name → tile_id (cho cross-session reference).
**Body**: `{ file_names: string[], project_id: string }`
**Response**:
```json
{ "data": { "tiles": [
  { "file_name": "uuid-1", "tile_id": "tile_xxx", "thumbnail_url": "https://...", "expires_at": "..." }
]}}
```

---

## 9. History

### `GET /history`
**Query**: `?source=workflow&start=...&end=...`
**Response**: `{ data: { items: GenerationLog[] } }`

### `POST /history`
Log generation event from client (when not running through workflow).
**Body**: `Omit<GenerationLog, 'id'|'created_at'>`

---

## 10. Snippets / Prompts

### `GET /prompts`
**Query**: `?type=addon` (server-curated) hoặc `type=user` (user-saved)

### `POST /prompts`
**Body**: `{ title, content, tags }`

### `PUT /prompts/{id}`
### `DELETE /prompts/{id}`

---

## 11. Plans & Billing

### `GET /plans`
**Response**: `{ data: { plans: Plan[] } }`

### `POST /orders`
Create payment order.
**Body**: `{ plan_key: "pro", duration_days: 30, currency: "VND", payment_method: "vietqr"|"bank_transfer" }`
**Response**:
```json
{
  "data": {
    "order_id": "ord_xxx",
    "status": "pending",
    "amount": 99000,
    "currency": "VND",
    "vietqr_url": "https://api.vietqr.io/image/...",
    "bank_info": {
      "bank_code": "MB",
      "account_no": "...",
      "account_name": "...",
      "transfer_content": "AF ord_xxx"
    },
    "expires_at": "..."
  }
}
```

### `GET /orders/{id}`
Poll status (pending → paid → activated). Mặc dù SSE event `plan_activated` fire khi thành công.

### `GET /orders/me`
List order history.

### `GET /tip-config`
**Response**:
```json
{
  "data": {
    "enabled": true,
    "amounts": [20000, 30000, 50000, 100000, 200000],
    "bank_info": { "bank_code": "MB", "account_no": "...", "account_name": "...", "transfer_content_template": "TIP {name}" }
  }
}
```

### `POST /tip`
**Body**: `{ amount, currency }`
**Response**: `{ data: { qr_url, transfer_content } }`

---

## 12. Referral

### `GET /referral/code`
**Response**: `{ data: { code, share_url } }`

### `GET /referral/stats`
**Response**: `{ data: { registered: 12, converted: 3, reward_days: 14 } }`

---

## 13. Settings

### `GET /settings`
**Response**: `{ data: { settings: AppSettings } }`

### `PUT /settings`
**Body**: `Partial<AppSettings>`

---

## 14. Provider Configs (Server-driven)

### `GET /providers`
**Response**:
```json
{ "data": { "providers": [
  { "key": "flow", "name": "Google Flow", "url": "https://labs.google/fx", "enabled": true, "version": 5 },
  { "key": "chatgpt", "name": "ChatGPT", "url": "https://chatgpt.com", "enabled": true, "version": 3 },
  { "key": "grok", "name": "Grok", "url": "https://grok.com", "enabled": true, "version": 2 },
  { "key": "gemini", "name": "Gemini", "url": "https://gemini.google.com", "enabled": false, "version": 1 }
]}}
```

### `GET /providers/api-configs`
Provider-specific API endpoints, model lists, capabilities.
**Response**:
```json
{ "data": { "configs": {
  "flow": {
    "trpc_base": "https://labs.google/fx/api/trpc",
    "media_url_pattern": "getMediaUrlRedirect",
    "submit_endpoint": "...",
    "max_quantity": 4
  },
  "chatgpt": { "model_dropdown_selector": "...", "submit_button_selector": "..." }
}}}
```

### `GET /providers/dom-selectors`
DOM selectors cho content scripts.
**Response**:
```json
{ "data": { "selectors": {
  "chatgpt": {
    "prompt_input": "div[contenteditable='true']",
    "send_button": "button[data-testid='send-button']",
    "image_response": "img.generated-image",
    "model_dropdown": "..."
  },
  "grok": { ... }
}}}
```

### `GET /provider-models`
List AI models theo provider.
**Response**:
```json
{ "data": { "models": [
  { "key": "imagen-3", "name": "Imagen 3", "provider": "flow", "type": "image", "max_ratio": ["16:9","1:1","9:16","4:3","3:4"] },
  { "key": "veo-2", "name": "Veo 2", "provider": "flow", "type": "video", "max_duration": ["4s","8s"] },
  { "key": "gpt-4o", "name": "GPT-4o", "provider": "chatgpt", "type": "image" },
  { "key": "grok-image-2", "name": "Grok Image 2", "provider": "grok", "type": "image" }
]}}
```

### `POST /analytics/selector-failure`
Khi selector fail trên trang provider, content script báo về để admin có thể update.
**Body**: `{ provider, selector_key, url, ua, failure_count }`

---

## 15. System config

### `GET /system-config/execution`
**Response**:
```json
{ "data": {
  "submit_timeout_ms": 60000,
  "tile_watch_timeout_ms": 300000,
  "max_concurrent_workflows": 1,
  "retry_max": 3,
  "retry_base_ms": 1000
}}
```

### `GET /validation-rules`
**Response**:
```json
{ "data": {
  "prompt_min_length": 1,
  "prompt_max_length": 4000,
  "workflow_name_max": 100,
  "ref_image_max_size_mb": 10
}}
```

### `GET /config/version`
Quick poll endpoint trả version number của mọi config (poll mỗi 60s).
**Response**:
```json
{ "data": {
  "models": 5,
  "providers": 3,
  "dom_selectors": 7,
  "i18n": { "vi": 12, "en": 11, "th": 8, "ja": 6 },
  "system": 4,
  "execution": 2
}}
```

---

## 16. i18n

### `GET /i18n/{locale}`
**Response**:
```json
{ "data": {
  "version": 12,
  "translations": {
    "header.settings": "Cài đặt",
    "header.upgrade": "Nâng cấp",
    "dialog.confirm": "Xác nhận",
    "node.generateName": "Tạo ảnh/video",
    "errors.rateLimit": "Đã hết lượt..."
  }
}}
```

---

## 17. Telegram integration

### `GET /telegram/link/status`
**Response**: `{ data: { linked: true, username: "@user" } }`

### `POST /telegram/link-init`
Start link flow.
**Response**: `{ data: { bot_username, link_code, expires_at } }`

### `POST /telegram/unlink`

### `POST /telegram/result`
Server forward kết quả gen → Telegram bot.
**Body**: `{ file_ids: string[], caption?: string, mode: "image"|"video"|"album" }`

### `POST /telegram/notify-completion`
Notify task/workflow complete.
**Body**: `{ wf_id, wf_name, success: true, result_count }`

### `POST /telegram/send-workflow-images`
Bulk send workflow output.

---

## 18. Notifications

### `GET /notifications`
**Response**: `{ data: { items: Notification[], unread_count } }`

### `POST /notifications/{id}/read`
### `POST /notifications/read-all`
### `DELETE /notifications/{id}`

### `GET /webhook-settings`
### `PUT /webhook-settings` body `{ url, secret? }`

### `GET /announcement`
Server-controlled banner/modal announcement.
**Response**:
```json
{ "data": {
  "announcement": {
    "id": "anc_xxx",
    "title": "...",
    "body": "...",
    "severity": "info",
    "target_plans": ["free"],
    "expires_at": "..."
  }
}}
```

---

## 19. Usage tracking

### `POST /usage/track`
Lightweight client-side action tracking.
**Body**: `{ action, count: 1, metadata }`

### `POST /usage/heartbeat`
SidePanel periodic heartbeat (1 min).
**Body**: `{ session_id, active_tab, stats: {...} }`

### `POST /usage/session-end`
On sidebar close/logout.

### `POST /usage/events`
Batch event upload (offline buffered).
**Body**: `{ events: [{action, count, timestamp}] }`

### `POST /usage/sync-offline`
Sync queued offline executions.
**Body**: `{ executions: ExecutionLogEntry[] }`

### `POST /usage/sync-daily`
Daily stat aggregate.

---

## 20. SSE & Mercure

### `POST /sse/ticket`
Legacy SSE ticket auth. Auth required.
**Response success**: `{ data: { ticket, expires_in: 300 } }`
**Response forbidden free**:
```json
{
  "success": false,
  "code": "SSE_REQUIRES_PAID",
  "data": { "fallback_url": "/api/v1/events/poll" }
}
```

### `GET /sse/stream?ticket=xxx`
EventSource endpoint. Streams events.

### `POST /sse/end-session`
Clean up server-side session resource.

### `GET /sse/subscribe-token` (Phase 2 Mercure)
**Response**:
```json
{ "data": {
  "token": "eyJ...",
  "hub_url": "https://your-backend.example.com/.well-known/mercure",
  "topics": ["users/123/*", "broadcast/*"],
  "expires_at_ms": 1735603200000
}}
```

### `GET /.well-known/mercure?topic=users/123/*&topic=broadcast/*&authorization=<jwt>`
Mercure Hub SSE endpoint.

### Mercure event format
```
id: evt_xxx
event: notification
data: {"id":"evt_xxx","type":"notification","payload":{...},"timestamp":"..."}

```

### `GET /events/poll`
Polling fallback cho free user.
**Query**: `?since=<last_event_id>&max=20`
**Response**: `{ data: { events: SseEnvelope[], next_since } }`

---

## 21. Screen Capture upload

### `POST /capture/upload` (multipart)
Upload screenshot → backend → return as image_id usable cho ref.
**Body**: `FormData(file, source_url?, source_title?)`
**Response**: `{ data: { image_id, thumbnail_url } }`

---

## 22. Angles & Effects presets

### `GET /angle-presets`
**Response**: `{ data: { presets: [{ id, name, params, thumbnail_url }] } }`

### `GET /effect-presets`

---

## 23. Anti-clone selfheal

### `GET /extension/authorized`
Probe endpoint, kiểm tra extension có whitelist không.
**Headers**: `X-Ext-Id`
**Response**: `{ data: { authorized: true } }` hoặc 403 `EXTENSION_NOT_AUTHORIZED`

Background script poll endpoint này mỗi 60s khi `af_clone_detected = true` → khi 200 OK → clear flag, hide overlay.

---

## Request signing (HMAC)

Pseudo code:
```ts
const secret = await getEmbeddedSecret(); // mixed into bundle, not real secret
const ts = Date.now().toString();
const body = JSON.stringify(payload);
const message = `${method.toUpperCase()}\n${path}\n${body}\n${ts}`;
const sig = hmacSHA256Base64(secret, message);

headers['X-Ext-Id']  = chrome.runtime.id;
headers['X-Ext-Sig'] = sig;
headers['X-Ext-Ts']  = ts;
```

Backend verify:
1. Check `ts` lệch < 5 phút (replay protection)
2. Re-compute HMAC với secret server-side
3. Compare constant-time

Note: secret bundled trong client KHÔNG phải secret thật sự — chỉ là obstacle để chống copy/repackage đơn giản. Bảo mật thực sự dựa vào extension_id whitelist + audit log.

---

## Rate limits gợi ý

| Endpoint group | Limit |
|---|---|
| `/auth/*` | 10 req/min per IP |
| `/execution/*` | 100 req/min per user |
| `/workflows GET` | 60 req/min |
| `/workflows POST/PUT/DELETE` | 30 req/min |
| `/i18n/*` | 60 req/hour |
| `/health` | 600 req/hour |
| `/events/poll` | 120 req/hour (cho free user 30s interval) |
| `/sse/ticket` | 60 req/hour |
| Provider configs (`/providers/*`) | 12 req/hour |

---

## Client retry strategy

| Error | Retry? | Backoff |
|---|---|---|
| Network error / timeout | Yes (max 3) | 1s, 2s, 4s |
| 429 RATE_LIMITED | Yes (max 3) | Theo `Retry-After` header hoặc 60s |
| 5xx server error | Yes (max 2) | 2s, 5s |
| 401 TOKEN_EXPIRED | Try refresh once → retry | — |
| 403 EXTENSION_NOT_AUTHORIZED | Không retry, show overlay | — |
| 4xx khác | Không retry | — |
