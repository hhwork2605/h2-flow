# 07 — Integrations: Telegram, Notifications, Announcement, Referral, Tip, VietQR

Bao gồm: Telegram link/send/notify, NotificationBell (header + panel), AnnouncementManager (modal/banner), Referral system, Tip Coffee (VietQR donate), Plan upgrade qua VietQR.

> Nguồn: `reference-ext/src/core/TelegramExecutor.js`, `NotificationManager.js`, `NotificationBell.js`, `NotificationPanel.js`, `NotificationModal.js`, `AnnouncementManager.js`, `SseClient.js`, `SseBroadcastManager.js`, `shared/PlanContentRenderer.js`.

---

## A. Telegram Integration

### A1. Link Telegram account 📋 (P5)

- **Trigger:** User Settings → Telegram → "Link Telegram".
- **Steps:**
  1. `POST /telegram/link-init` → `{ bot_username, link_code, expires_at }` (TTL 10 phút).
  2. Modal hướng dẫn: "Mở @TobyFlowBot trên Telegram, gõ `/start <link_code>`". Show QR code → user scan từ điện thoại.
  3. Sidebar lắng nghe SSE event `telegram:linked` → modal close, badge "Linked as @username" hiện trong Settings.
- **Happy path:** User scan QR → bot bind → SSE bắn `telegram:linked` → user thấy badge xanh.
- **Case lỗi:**
  - **link_code expired (10 phút):** modal nhắc "Code hết hạn, lấy code mới?" → re-init.
  - **User đã link Telegram account khác:** server trả `ALREADY_LINKED` → confirm "Đổi sang account mới?" → call `POST /telegram/link-force`.
  - **SSE drop trong lúc chờ:** polling fallback `GET /telegram/status` mỗi 10s cho đến khi linked hoặc timeout.

### A2. Unlink Telegram 📋

- **Trigger:** Settings → Telegram → "Unlink".
- **Steps:** confirm → `DELETE /telegram/link` → badge mất, các Telegram nodes trong workflow show warning "Chưa link Telegram".
- **Case lỗi:** API fail → giữ link, toast retry.

### A3. Telegram command → trigger workflow 📋 (P5+)

- **Trigger:** User gõ `/generate "prompt"` trên Telegram bot.
- **Steps:**
  1. Bot forward command tới backend → SSE event `telegram:command` payload `{ queue_id, command, args, default_provider }` tới extension đã link.
  2. Extension nhận → ExecutionLock check (đang chạy gì khác không?).
  3. Get default provider từ `af_settings.telegram.defaultProvider` (Flow/ChatGPT/Grok).
  4. ExecutionGate request quota.
  5. Activate provider tab → submit prompt → wait result.
  6. `POST /telegram/results/{queue_id}` với image + status.
- **Case lỗi:**
  - **Extension busy (lock conflict):** trả `BUSY` → bot reply "Đang xử lý job khác, thử lại sau".
  - **Quota exceeded:** bot reply "Hết quota hôm nay, nâng cấp tại {URL}".
  - **Provider tab closed:** Phase 3 multi-provider fallback Flow; nếu Flow cũng không có → trả `PROVIDER_UNAVAILABLE`.

### A4. Telegram node trong workflow 📋

- **Trigger:** Workflow chạy đến node Telegram.
- **Steps:** check `user.telegram_chat_id` link chưa? chưa → mark `FAILED TELEGRAM_NOT_LINKED`; rồi → `POST /telegram/send-workflow-images` body `{ file_ids, caption, mode: 'photo'|'document' }`.
- **Case lỗi:**
  - **Telegram rate-limit (1msg/3s):** server queue retry; client nhận `delayed`, node tiếp tục.
  - **File quá lớn (>50MB):** chia chunk hoặc send link cloud.

### A5. Notify on workflow complete 📋

- **Trigger:** `Settings.telegramNotifyComplete = true`.
- **Steps:** sau workflow done → `POST /telegram/notify-completion` body `{ workflow_id, run_id, summary }` → bot gửi tin nhắn user.
- **Case lỗi:** Telegram API down → server retry queue 3 lần exponential.

### A6. Cancel Telegram task 📋

- **Trigger:** User gõ `/cancel` Telegram hoặc click Stop trong sidebar.
- **Steps:** SSE event `telegram:cancel` payload `queue_id` → extension abort active item nếu match → reply user.
- **Case lỗi:** Item đã complete trước cancel → ack "Already done, kết quả: ...".

---

## B. Notifications (in-app)

### B1. Notification bell badge ✅ (skeleton P2.7)

- **Trigger:** App load + SSE event `notification`.
- **Steps:**
  1. Đọc `af_notifications` từ chrome.storage (max 100 entries).
  2. Render bell icon header với badge `unread_count` (cap "99+").
  3. Click → mở NotificationPanel (popover hoặc full overlay).
- **Case lỗi:** empty → "No notifications yet" (i18n key `notifications.empty`).

### B2. Mark as read ✅

- **Trigger:** Click item, hoặc click "Mark all as read".
- **Steps:**
  1. Set `notification.read = true` local.
  2. `PATCH /notifications/{id}` (best-effort).
  3. Update badge.
- **Case lỗi:** API fail → giữ optimistic; retry sau 10s.

### B3. Realtime delivery 📋 (P4)

- **Trigger:** SSE event `notification` payload `{ id, type, title, body, link?, ts }`.
- **Steps:** Push vào danh sách đầu list, increment badge, optional toast nếu `severity = 'high'`.
- **Case lỗi:** SSE disconnect → polling `GET /notifications?after=<last_id>` mỗi 30s.

### B4. Multi-channel (P5+) 📋

- Cấu hình trong Settings: bật chrome.notifications, âm thanh, webhook URL, Telegram fan-out.
- **Steps per channel:**
  - Chrome native: `chrome.notifications.create` với onclick mở app.
  - Sound: AudioContext oscillator (freq + duration từ settings).
  - Webhook: `POST <user_url>` body full payload; rate-limit 1/3s.
- **Case lỗi:**
  - **Chrome notifications permission denied:** skip channel, đề xuất user grant.
  - **Webhook 4xx/5xx:** retry 3 lần exponential, sau đó disable channel + cảnh báo user trong settings.

---

## C. Announcement

### C1. Bootstrap announcement 📋

- **Trigger:** App init.
- **Steps:**
  1. `GET /announcement` → `{ id, version, severity, display_mode, title, body_md, expires_at }`.
  2. So `version` với `af_announcement_seen_version`.
  3. Khác → render theo `display_mode`: `popup` (modal blocking), `banner` (sticky top), `badge` (chỉ chấm đỏ trên Help button).
  4. Render markdown body (`PlanContentRenderer`) với link click trong sandbox.
- **Case lỗi:**
  - **First-time user (chưa có flag `af_announcement_initialized`):** suppress legacy announcement, set flag → chỉ show từ lần sau.
  - **Empty announcement:** skip, không render modal trống.

### C2. SSE realtime push 📋

- **Trigger:** SSE event `announcement_changed`.
- **Steps:** re-fetch announcement → diff version → show nếu mới.
- **Case lỗi:** Tab follower (không phải SSE leader) → leader broadcast qua BroadcastChannel → mọi tab đồng bộ.

### C3. Dismiss / Mark seen ✅ (UX)

- **Trigger:** User click X hoặc nút "Tôi đã đọc".
- **Steps:** set `af_announcement_seen_version = version` → ẩn modal/banner, giữ badge cho version mới.
- **Case lỗi:** Severity `critical` → không cho X; chỉ nút "Tôi đã đọc" sau khi scroll xuống cuối.

### C4. Polling fallback 📋

- Nếu SSE drop, ConfigVersionPoller mỗi 30 phút check `announcement.version` đổi → refresh.
- **Case lỗi:** Document hidden → skip polling (tiết kiệm pin).

---

## D. Changelog

### D1. Compare version ✅ (P2.7 placeholder)

- **Trigger:** App init.
- **Steps:** đọc `chrome.runtime.getManifest().version` so với `af_changelog_version_seen`. Khác → show dot trên Help/changelog button.
- **Case lỗi:** First install → set version = current, không show dot.

### D2. Open changelog 📋

- **Trigger:** Click button.
- **Steps:** Fetch `/changelog?version=<current>` markdown → render modal full-screen → mark seen.

---

## E. Referral

### E1. Display referral code ✅ (mock)

- **Trigger:** User dropdown → "Refer friends" section.
- **Steps:**
  1. Read `user.referral_code` + `referral_stats`.
  2. Show code (e.g., `TOBY-XYZ123`), copy button, share button.
  3. Show stats: `{registered} đã đăng ký • {converted} đã nâng cấp`.
- **Case lỗi:** stats null → show 0/0.

### E2. Share referral link 📋

- **Trigger:** Click share.
- **Steps:**
  1. URL `https://<backend>/r/<code>`.
  2. Try `navigator.share({ url, title, text })`; fallback copy URL clipboard + toast "Đã copy link".
- **Case lỗi:** `navigator.share` không support → chỉ copy.

### E3. Reward delivery 📋

- **Trigger:** Friend register + upgrade qua referral.
- **Steps:** Backend track conversion → SSE event `referral_rewarded` payload `{ days_granted, friend_email }` → toast "Bạn được +7 ngày Pro do {email} nâng cấp!" + FeatureGate.refresh.
- **Case lỗi:** Reward đã cộng nhưng entitlements chưa update → retry refetch sau 5s.

---

## F. Tip Coffee (☕ donate)

### F1. Open tip modal 📋 (P6)

- **Trigger:** Click ☕ button header.
- **Steps:**
  1. Modal show description "Hỗ trợ phát triển h2-flow".
  2. Quick buttons (20k/30k/50k/100k/200k VND) hoặc input số tiền custom.
  3. Click amount → `POST /tip` body `{ amount, currency: 'VND' }` → `{ qr_url, bank_info, transfer_content }`.
  4. Render VietQR image + bank info + transfer content auto-copy.
- **Case lỗi:**
  - **Amount < 5k VND:** inline error.
  - **API fail:** fallback show bank info tĩnh "STK: 123 - Ngân hàng ABC - Nội dung: TIP {userId}".

### F2. Thank you toast 📋

- **Trigger:** Backend bank webhook detect chuyển khoản khớp content → SSE event `tip_received`.
- **Steps:** Toast "Cảm ơn bạn 🙏" + close modal nếu vẫn mở.
- **Case lỗi:** SSE drop → user vẫn xem được history tip trong Settings → Donations.

---

## G. VietQR — Plan Upgrade

### G1. Open upgrade modal 📋

- **Trigger:** Click Upgrade button (header / quota dialog / footer).
- **Steps:**
  1. Modal show plans: Free / Pro / Team (PlanContentRenderer render features + giá).
  2. Pick plan + duration (1m / 3m / 1y) → tính price + discount.
- **Case lỗi:** Plan disabled (server config) → skip plan đó, log warn.

### G2. Tạo order 📋

- **Trigger:** Click "Mua ngay".
- **Steps:**
  1. `POST /orders` body `{ plan_key, duration_days, currency: 'VND', payment_method: 'vietqr' }`.
  2. Nhận `{ order_id, vietqr_url, bank_info, transfer_content, expires_at }`.
  3. Modal switch sang payment view: QR + bank info + countdown timer + "Tôi đã chuyển khoản" button.
- **Case lỗi:**
  - **Duplicate pending order:** server trả `PENDING_ORDER_EXISTS` → reuse order cũ, không tạo mới.
  - **Discount code invalid:** inline error, không apply.

### G3. Payment confirmation 📋

- **Trigger:** User chuyển khoản → backend webhook bank → activate plan.
- **Steps:**
  1. SSE event `plan_activated` payload `{ order_id, plan_key, expires_at }`.
  2. Modal close, toast "Nâng cấp thành công 🎉".
  3. FeatureGate.refresh + PlanBadge update.
- **Case lỗi:**
  - **Webhook trễ (>5 phút):** user click "Tôi đã chuyển khoản" → manual nudge `POST /orders/{id}/verify` → backend retry check.
  - **Sai nội dung chuyển khoản:** admin support manual; UI show "Cần hỗ trợ?" link.
  - **Order expired (TTL 30 phút):** modal show "Đơn đã hết hạn, tạo mới?".

### G4. Order states & UI mapping 📋

| State | UI |
|---|---|
| `pending` | Show QR + countdown |
| `paid` | "Đang xác nhận giao dịch…" spinner |
| `activated` | Toast success, close modal |
| `expired` | "Hết hạn, tạo đơn mới" |
| `cancelled` | "Đã hủy" |

---

## H. Storage keys & events

| Key | Mục đích |
|---|---|
| `af_notifications` | List local (max 100), badge derive |
| `af_announcement_seen_version` | Dedup announcement |
| `af_announcement_initialized` | First-time suppress |
| `af_changelog_version_seen` | Dedup changelog dot |
| `af_settings.telegram.*` | Telegram defaults (provider, model, ratio) |
| `af_pending_orders` | Cache đơn pending để resume |

| Event | Khi nào |
|---|---|
| `notification` | SSE new notification |
| `announcement_changed` | SSE admin update |
| `telegram:linked` / `telegram:unlinked` | bot link/unlink |
| `telegram:command` / `telegram:cancel` / `telegram:stop` | bot → extension |
| `referral_rewarded` | friend convert |
| `plan_activated` / `order_paid` / `order_expired` | upgrade flow |
| `tip_received` | bank webhook |
