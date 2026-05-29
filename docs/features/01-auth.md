# 01 — Auth, OAuth & Security

Bao gồm: đăng nhập email/password, đăng ký, đăng xuất, token refresh, Google OAuth, request signing (HMAC), anti-clone + self-heal, ApiBaseConfig override per-user.

> Nguồn gốc nghiệp vụ: `reference-ext/src/core/AuthManager.js`, `RequestSigner.js`, `ApiBaseConfig.js`, `ApiStorage.js`, `background.js` (interceptor 403 + self-heal probe), `oauth-bridge.js`.

---

## A. Authentication

### A1. Đăng ký email/password ✅

- **Trigger:** User mở Login modal → tab Register → submit form.
- **Preconditions:** Online, server không trả `EXTENSION_NOT_AUTHORIZED`.
- **Steps:**
  1. Validate client-side: email format, password ≥ 8 ký tự, `password === password_confirmation`, name không rỗng.
  2. `POST /auth/register` body `{ name, email, password, password_confirmation, referred_by? }`.
  3. Nhận `{ token, user }` → lưu `af_auth` (zustand persist + chrome.storage).
  4. Emit `auth:login` event → `FeatureGate.refresh()` để load entitlements user mới.
  5. Đóng modal, render UI logged-in state.
- **Happy path:** Token hợp lệ, user record có `email_verified=false` (chờ verify email) → vẫn cho vào app, banner nhắc verify email ở header.
- **Case lỗi:**
  - **422 validation:** server trả `{ errors: { email: ['Email đã tồn tại'] } }` → inline error dưới input, không đóng modal.
  - **429 rate-limit:** cooldown theo `Retry-After`, disable nút Submit, đếm ngược ("Thử lại sau 30s").
  - **`EXTENSION_NOT_AUTHORIZED`:** không lưu af_auth, hiện CloneDetectedOverlay (xem D).

### A2. Đăng nhập email/password ✅

- **Trigger:** User submit form Login.
- **Steps:**
  1. `POST /auth/login` body `{ email, password }`, header `X-Fingerprint: <hash>` (FP từ navigator + screen).
  2. Nhận `{ token, user, apiBaseUrl? }` → lưu af_auth + `apiBaseUrl` (nếu có).
  3. Emit `auth:login` → refresh entitlements + restore pending settings (xem A6).
  4. Đóng modal.
- **Happy path:** UI tab `Generate` reload với entitlements user; PlanBadge đổi `FREE → PRO`.
- **Case lỗi:**
  - **401 invalid credentials:** giữ modal, hiện `auth.loginFailed` (i18n) dưới password field; KHÔNG clear email.
  - **`EMAIL_NOT_VERIFIED`** (custom 403): chuyển sang trạng thái "Verify email gửi tới {email}", hiện nút "Gửi lại email".
  - **Offline:** modal disable submit, gợi ý retry; KHÔNG ghi gì vào storage.

### A3. Logout ✅

- **Trigger:** User click "Sign out" trong dropdown header.
- **Steps:**
  1. Set `_isLoggingOut = true` (cờ ngắn — chặn refresh nếu request đang chạy).
  2. Disconnect SSE (`POST /sse/end-session` best-effort).
  3. `POST /auth/logout` best-effort — KHÔNG block UI nếu timeout/lỗi.
  4. Snapshot `af_settings` → `af_settings_pending_resync` (theo `userId, savedAt`) để khôi phục nếu login lại cùng user (bugfix mid-session token expire).
  5. Clear af_auth + `af_entitlements_cache` + `af_referral_code`.
  6. Emit `auth:logout` → reset stores về anonymous; refetch public entitlements (Free).
- **Happy path:** UI quay về header anonymous (chỉ còn nút Sign in / Sign up); FeatureGate active free-plan public entitlements.
- **Case lỗi:**
  - **Logout API timeout 5s:** vẫn clear local state, log warn; server token sẽ expire tự nhiên.
  - **Multi-tab race:** tab khác đang chạy workflow → `chrome.storage.onChanged` báo `af_auth = null` → tab kia cancel pending requests, hiện toast "Đã đăng xuất".

### A4. Token refresh on 401 ✅

- **Trigger:** Bất kỳ API call nào (trừ `/auth/login`, `/auth/register`, `/auth/refresh`) trả 401.
- **Steps:**
  1. Single-flight lock: nếu đã có 1 refresh đang chạy → các call song song đợi cùng promise.
  2. `POST /auth/refresh` body `{ refresh_token }` (nếu dùng split-token) hoặc dùng cookie HttpOnly.
  3. Thành công → update `af_auth.token` → replay request gốc 1 lần.
  4. Thất bại → `clearAuth()` + emit `auth:logout` + render login modal.
- **Happy path:** Request retry thành công, UI không thấy gì (loading spinner ngắn).
- **Case lỗi:**
  - **Refresh trả 429:** KHÔNG logout. Set cooldown theo `Retry-After`, jitter ±20%. Block thêm calls đến hết cooldown.
  - **Refresh trả 403 `EXTENSION_NOT_AUTHORIZED`:** KHÔNG logout (giữ session, đợi self-heal — xem D).
  - **Refresh trả 401:** logout, redirect login modal, hiện `auth.sessionExpired`.

### A5. ApiBaseConfig override per-user 📋

- **Trigger:** Sau `auth:login` thành công, response chứa `apiBaseUrl`.
- **Steps:**
  1. Lưu vào af_auth.apiBaseUrl + cache riêng `af_api_base_override`.
  2. `getApiBaseUrl()` luôn ưu tiên: `af_api_base_override` → `VITE_API_BASE_URL` env → `DEFAULT_API_BASE_URL`.
  3. SW background đọc lại config cho mỗi `apiRequest` (không cache cứng).
- **Happy path:** User admin override → tất cả call sau dùng domain riêng (vd: `https://staging.example.com`).
- **Case lỗi:**
  - **URL malformed:** throw → revert về DEFAULT, log warn, không persist.
  - **Domain down:** request fail timeout → trigger offline overlay (xem doc 08).

### A6. Settings pending-resync sau logout 📋

- **Trigger:** Login lại cùng `user.id` đã có `af_settings_pending_resync`.
- **Steps:** Merge pending snapshot vào af_settings, push lên server (`PUT /settings`), clear pending.
- **Case lỗi:** User khác login → pending của user cũ giữ nguyên (không merge), chờ đúng user.

---

## B. Google OAuth

### B1. Khởi tạo OAuth flow 📋

- **Trigger:** User click "Sign in with Google".
- **Steps:**
  1. `GET /auth/google/url` → `{ auth_url, state }`.
  2. Lưu `state` vào `chrome.storage.session.af_oauth_state` (chống CSRF + matching khi callback).
  3. `chrome.tabs.create({ url: auth_url, active: true })`.
  4. Sidebar chuyển UI sang trạng thái "Đang chờ xác thực Google… (timeout 2 phút)".
- **Case lỗi:**
  - **`/auth/google/url` 5xx:** giữ modal, hiện retry button.
  - **Popup blocker:** không xảy ra do `chrome.tabs.create` không phải popup, nhưng nếu user tab cuối close hết → vẫn ok, dùng new tab.

### B2. OAuth callback bridge ✅ (content script `oauth-bridge.ts`)

- **Trigger:** Browser nhận redirect `https://<backend>/auth/google/success?token=...&state=...`.
- **Steps:**
  1. Content script `oauth-bridge.ts` match URL `*/auth/google/success*`.
  2. Đọc query string `token`, `state`, `user_json` (base64). Fallback: poll `<meta name="x-oauth-token">` 10 lần × 300ms; fallback 2: lắng nghe `postMessage` từ page.
  3. So `state` với `af_oauth_state` → khác → reject "CSRF state mismatch".
  4. `chrome.runtime.sendMessage({ action: 'auth:google-callback', token, user })`.
  5. Background lưu af_auth → `chrome.tabs.remove(tabId)` → broadcast `'auth:login'`.
- **Happy path:** Sidebar nhận `chrome.storage.onChanged` → render logged-in state ngay.
- **Case lỗi:**
  - **Communication blocked (CSP):** fallback poll meta → fallback URL query. Sau 10s không lấy được → hiện "Không nhận được token, hãy đăng nhập bằng email."
  - **Token rỗng / `state` không match:** content script reset `tokenForwarded=false`, log error, redirect lại login.

### B3. Link Google vào account hiện tại 📋

- Tương tự B1-B2 nhưng `state` mang `mode=link` → backend không tạo session mới, chỉ liên kết google_id vào user hiện tại → emit `oauth:linked`.

---

## C. Request Signing (HMAC-SHA256)

> Nguồn: `reference-ext/src/core/RequestSigner.js` + `background.js` (enrollment). h2-flow dùng hex (KHÔNG base64 như docs/08 đề xuất ban đầu) để khớp reference.

### C1. Enrollment lần đầu ✅

- **Trigger:** Background SW khởi động lần đầu hoặc `toby_client_enrollment` trống.
- **Steps:**
  1. `POST /enroll` body `{ ext_id, manifest_version, fingerprint }`.
  2. Nhận `{ client_id, secret, expires_at }` → lưu `chrome.storage.local.toby_client_enrollment`.
  3. Cache `_enrollment` trong memory SW (warm wake-up).
- **Case lỗi:**
  - **403 `DEVICE_BANNED`:** lưu `_deviceBanned = true` (persistent flag) → block tất cả requests sau, hiện device-ban overlay (khác clone overlay).
  - **403 `EXTENSION_NOT_AUTHORIZED`:** chuyển sang anti-clone path (xem D).
  - **Network fail:** retry exponential 3 lần, sau đó fail tất cả requests cho đến khi user click "Retry".

### C2. Ký request 📋

- **Trigger:** Mỗi `apiRequest` qua background.
- **Steps:**
  1. Tính `body_sha256 = SHA-256(body).hex()` (rỗng nếu GET/no-body).
  2. `message = "{ts}:{METHOD}:{path}:{body_sha256}"`.
  3. `signature = HMAC-SHA256(secret, message).hex()`.
  4. Đính headers `X-Client-Id, X-Timestamp, X-Signature, X-Ext-Id` vào request.
- **Case lỗi:**
  - **403 `REVOKED_CLIENT`:** `_ensureEnrollment(force=true)` → re-enroll → retry request gốc 1 lần.
  - **`X-Timestamp` lệch quá ±300s:** server reject `CLOCK_SKEW`. Client đồng bộ lại bằng `Date` từ response header server gửi xuống lần kế.

---

## D. Anti-Clone + Self-Heal

> Nguồn: `reference-ext/background.js` _handleExtensionAuthRejection + self-heal probe.

### D1. Detect clone (403 EXTENSION_NOT_AUTHORIZED) ✅

- **Trigger:** Bất kỳ request nào trả `{ status: 403, code: 'EXTENSION_NOT_AUTHORIZED' }`.
- **Steps:**
  1. Background lưu `af_clone_detected = true` vào chrome.storage.local.
  2. Broadcast `EXTENSION_NOT_AUTHORIZED` message tới tất cả tabs/sidebar.
  3. Sidebar render `<CloneDetectedOverlay />` (cover full + nút "Mở Chrome Web Store" + "Retry").
  4. Background `registerSelfHealProbe()` qua `chrome.alarms` (period: 1 phút).
  5. Toàn bộ API call sau này short-circuit fail với cùng code (không hit network).
- **Happy path:** Overlay che UI, user nhận hướng dẫn cài bản chính thức.
- **Case lỗi:**
  - **User click Retry:** gọi `_selfHealProbe()` ngay; nếu vẫn 403 → giữ overlay.
  - **Race với refresh token:** refresh đang chạy gặp 403 này → KHÔNG logout (giữ session, chờ self-heal).

### D2. Self-heal probe ✅

- **Trigger:** Chrome alarm fire mỗi 60s khi `af_clone_detected = true`.
- **Steps:**
  1. `GET /extension/authorized` với signed headers.
  2. 200 OK → `af_clone_detected = false`, hide overlay, clear alarm.
  3. Vẫn 403 → giữ flag.
- **Case lỗi:**
  - **Timeout 8s:** inconclusive, không update flag, alarm tiếp tục lần sau.
  - **Network unreachable:** giữ overlay nhưng UI báo "Mất mạng" (overlay offline đè lên overlay clone).

### D3. Manual recovery 📋

- Admin whitelist `ext_id` qua dashboard backend → user click Retry → probe nhận 200 → recovery.

---

## E. State invariants

- `af_auth = null` ↔ anonymous mode (chỉ tab `Generate` + `Prompts` đọc-only, đa số feature disabled).
- `af_clone_detected = true` ↔ tất cả call short-circuit, overlay luôn render.
- `af_offline = true` ↔ overlay offline che; SSE auto-reconnect khi `online` event.
- `_deviceBanned = true` ↔ block 100% requests kể cả `/health`; chỉ reset khi `/enroll` retry thành công.

## F. Storage keys liên quan

| Key | Layer | Mục đích |
|---|---|---|
| `af_auth` | chrome.storage.local + zustand | session token + user |
| `af_settings_pending_resync` | chrome.storage.local | snapshot khôi phục settings sau token expire |
| `af_oauth_state` | chrome.storage.session | CSRF state OAuth |
| `toby_client_enrollment` | chrome.storage.local | client_id + secret HMAC |
| `af_clone_detected` | chrome.storage.local | bật/tắt CloneDetectedOverlay |
| `af_api_base_override` | chrome.storage.local | apiBaseUrl admin override |
| `af_device_banned` | chrome.storage.local | block 100% (DEVICE_BANNED) |

## G. Events emit

| Event | Khi nào | Payload |
|---|---|---|
| `auth:login` | sau register/login/oauth thành công | `{ user }` |
| `auth:logout` | sau logout / 401 refresh fail | `void` |
| `auth:settings_updated` | settings server đổi qua SSE | `{ partial }` |
| `oauth:linked` | link Google thành công | `{ provider: 'google' }` |
| `api:rate_limited` | gặp 429 trong refresh | `{ retry_after }` |
| `extension:unauthorized` | clone detected | `void` |
| `extension:authorized` | self-heal recovery | `void` |
