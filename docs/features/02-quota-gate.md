# 02 — Quota & FeatureGate

Bao gồm: FeatureGate (feature flag + entitlements), ExecutionGate (server token quota), ExecutionLock (single-flight), TrialGate (legacy shim), UsageSync (analytics), PipelineFooter (quota display).

> Nguồn: `reference-ext/src/core/FeatureGate.js`, `ExecutionGate.js`, `ExecutionLock.js`, `TrialGate.js`, `ExecutionTracker.js`, `UsageSync.js`, `PipelineFooter.js`.

---

## A. FeatureGate (client-side feature flag)

### A1. Bootstrap entitlements ✅

- **Trigger:** App init / `auth:login` / `auth:logout` / SSE `config_changed`.
- **Steps:**
  1. Đọc cache `af_entitlements_cache` (TTL 30 phút).
  2. Nếu hợp lệ → set `entitlements = cached`, dùng tạm.
  3. Background: `GET /entitlements` (signed) → cập nhật cache + emit `featuregate:refreshed`.
  4. Anonymous: dùng public entitlements free-plan (mock + server `/entitlements?anonymous=1`).
- **Happy path:** UI render đúng feature gated theo plan của user; PlanBadge khớp.
- **Case lỗi:**
  - **Fetch fail nhưng có cache:** dùng cache, log warn, retry ngầm sau 60s.
  - **Fetch fail không có cache:** assume free-plan + show toast "Không tải được quyền lợi, đang chế độ free".
  - **Server trả entitlements không có key feature mới:** UI fallback `enabled: false` (fail-closed).

### A2. `canUse(featureKey)` ✅

- **Trigger:** UI gọi trước render nút/feature (qua `useFeatureGate`).
- **Steps:**
  1. Đọc `entitlements.features[key].enabled`. Hỗ trợ alias docs/08 (`workflow_run`) + reference-ext (`flow_enabled`).
  2. Trả boolean đồng bộ.
- **Case lỗi:** key sai/không tồn tại → trả `false` (fail-closed), log debug 1 lần.

### A3. `getQuota(action)` ✅

- **Trigger:** Footer + dialog quota cần show "X/Y lượt còn".
- **Steps:**
  1. `entitlements.quotas[action] → { limit, used, remaining, resets_at }`.
  2. Format remaining time `resets_at` thành "Còn 5h 23m".
- **Case lỗi:** action không có quota → trả `null`, UI ẩn block quota.

### A4. Cache invalidation theo version 📋

- **Trigger:** SSE event `config_versions_bumped` payload chứa `user_entitlements.version` đổi.
- **Steps:** Gọi `_updateFromVersion(remoteVersion)` → fetch lại entitlements force, persist version mới.

### A5. Local daily stats (display only) ✅

- **Trigger:** Sau mỗi gen/workflow chạy.
- **Steps:** Increment counter trong `af_daily_stats.<YYYY-MM-DD>.<action>` để hiển thị "Hôm nay đã chạy 12 lượt".
- **Case lỗi:** clock skew client → key sai ngày → server-side quota mới là nguồn chính xác, local chỉ display.

---

## B. ExecutionGate (server-side quota token)

### B1. Request token trước khi execute ✅ (mock)

- **Trigger:** User click Generate / Run workflow / Run multi-task.
- **Steps:**
  1. `POST /execution/request` body `{ action, count, owner_type, owner_id?, prompt_ids? }`.
  2. Server validate:
     - Plan có entitlement không?
     - Daily quota còn không?
     - Có execution đang chạy cùng owner_type không (lock)?
  3. Thành công → `{ token, remaining_after, limit, resets_at, used_after }`. Token TTL 5 phút.
  4. Lưu vào `MOCK_EXECUTIONS` (mock) / Redis (prod) keyed bởi token.
  5. Client lưu token vào job context để bước `complete` dùng lại.
- **Happy path:** Gen/Workflow chạy, UI footer cập nhật `remaining_after`.
- **Case lỗi:**
  - **`QUOTA_EXCEEDED`** (400): hiện CustomDialog "Hết X/Y lượt {action} hôm nay. Reset sau {resets_at}" + nút Nâng cấp.
  - **`FEATURE_DISABLED`** (403): "Tính năng này chỉ có ở gói Pro" + Upgrade CTA.
  - **`ALREADY_RUNNING`** (409): "Đang có 1 {action} chạy. Bạn muốn dừng nó?" — UI cho stop.

### B2. Complete token sau khi done ✅ (mock)

- **Trigger:** Workflow/Gen kết thúc (success/fail/cancel).
- **Steps:**
  1. `POST /execution/complete` body `{ token, status: 'success'|'failed'|'cancelled', duration_ms, generated_count? }`.
  2. Server tăng `used` cho action tương ứng (chỉ khi `status=success`); release lock; ghi vào history.
  3. Mock: cập nhật `MOCK_QUOTA_USED[action] += generated_count`.
- **Case lỗi:**
  - **Token đã expire (5 phút):** server trả `EXPIRED_TOKEN` → UI ghi vào logs, vẫn lưu kết quả local, nhưng quota không trừ. Hiện toast "Thời gian execute quá lâu, kết quả không tính vào quota".
  - **Network fail khi complete:** retry 3 lần exponential; vẫn fail → mark `_pendingComplete` lưu local, retry next session.

### B3. Cancel midway 📋

- **Trigger:** User click Stop.
- **Steps:** `POST /execution/complete` với `status='cancelled'` (không trừ quota); nếu workflow đã chạy 1 phần, đếm partial count tuỳ phase.
- **Case lỗi:** SW khởi động lại giữa chừng → token mồ côi → server auto-cleanup sau TTL.

---

## C. ExecutionLock (single-flight client + server)

### C1. Acquire/release client lock ✅ (mock)

- **Trigger:** Trước khi call `ExecutionGate.request`.
- **Steps:**
  1. Đọc `chrome.storage.local.af_execution_lock`. Nếu có lock khác owner_type chưa expire → reject "Đang chạy <owner>, dừng trước khi chạy {action} mới".
  2. Acquire: ghi `{ owner_type, owner_id, acquired_at, expires_at: now + 60s }`.
  3. Broadcast qua `BroadcastChannel('af-lock')` cho tabs khác.
  4. Trên complete/error/cancel → release.
- **Case lỗi:**
  - **Lock orphan (browser crash):** lock expire sau 60s; lần acquire kế ghi đè.
  - **Pipeline mode (P4+):** nếu user bật "Pipeline queue", lock cho phép queue thay vì reject — chuyển sang serialize trong PromptQueue.

### C2. Force-release ✅

- **Trigger:** User click "Force stop" từ FloatingTracker hoặc Footer.
- **Steps:** Bỏ qua check expires_at, xoá lock, emit `lock:force_released`. Các job đang chạy nhận event → abort.

---

## D. TrialGate (legacy shim)

### D1. Delegate sang FeatureGate ✅

- **Trigger:** Code cũ trong reference-ext gọi `TrialGate.canUse()`.
- **Steps:** TrialGate thuần redirect sang FeatureGate. h2-flow KHÔNG implement TrialGate riêng — chỉ dùng FeatureGate.
- **Rebuild note:** Bỏ TrialGate.ts. Trial state expose qua `user.trial_active + trial_ends_at` và FeatureGate quotas tier `trial`.

---

## E. UsageSync (analytics)

### E1. Track event 📋

- **Trigger:** Sau mỗi `auth:login`, gen complete, workflow start/end, error, settings change.
- **Steps:**
  1. `trackEvent({ type, metadata })` push vào in-memory buffer.
  2. Auto-flush khi buffer ≥ 20 events HOẶC 60s đã trôi qua.
  3. `POST /usage/events` batch với UUID device fingerprint.
- **Case lỗi:**
  - **429:** exponential backoff (1→2→4→8s), max 3 retries; bỏ batch nếu vẫn fail.
  - **Offline:** buffer giữ trong memory (cap 1000 events) → flush khi online lại.
  - **Drop nếu close sidebar trước khi flush:** acceptable cho analytics, không retry.

### E2. Daily stats sync 📋

- **Trigger:** Mỗi 24h hoặc app close (`chrome.alarms` daily).
- **Steps:** Aggregate counters local → `POST /usage/daily` `{ date, logins, executions, errors }`.

### E3. Heartbeat session 📋

- **Trigger:** Mỗi 5 phút khi sidebar mở.
- **Steps:** `POST /usage/heartbeat` báo session alive. Multi-tab: chỉ leader (qua `SseBroadcastManager`) gửi để khỏi duplicate.

---

## F. PipelineFooter / Quota display

### F1. Render counter ✅

- **Trigger:** Mỗi lần `featuregate:refreshed` hoặc job state đổi.
- **Steps:**
  1. Lấy `getQuota(action).remaining` cho action tương ứng tab hiện tại (Generate → `generate`, Workflow → `workflow_run`...).
  2. Format `{remaining} {action} runs left` (i18n key `generate.quotaRemaining`).
  3. Style theo level: ≥20% xanh nhạt, 5-20% vàng, <5% đỏ.
- **Case lỗi:**
  - **Quota = 0 nhưng vẫn show "0 runs left":** thay text "Hết lượt — Nâng cấp" thành CTA.
  - **Reset đã qua mà server chưa cập nhật:** UI hiển thị local count → next refetch corrects.

### F2. Progress bar batch ✅

- **Trigger:** PromptQueue có job đang chạy.
- **Steps:**
  1. Tổng progress = `sum(itemProgress) / itemCount`.
  2. Show "Running {done}/{total}…" với i18n key `generate.running`.
  3. Per-job action: pause (chỉ prompt), stop (all).
- **Case lỗi:**
  - **Job error:** badge đỏ + giữ footer mở để user thấy chi tiết lỗi.
  - **All complete:** show "All done" 3s rồi auto-collapse.

### F3. Warning quota realtime 📋

- **Trigger:** SSE event `quota_warning` (remaining < 20%).
- **Steps:** Toast ngắn "⚠️ Còn {remaining}/{limit} lượt {action} hôm nay" — chỉ show 1 lần/ngày/action (dedup qua `af_quota_warning_shown.<date>.<action>`).

---

## G. Quota matrix (mock baseline)

Khớp `src/api/mock/data.ts` → `entitlementsForPlan`:

| Plan | workflow_run | generate | chatgpt_run | task_run |
|---|---|---|---|---|
| free | 10 | 50 | 5 | 5 |
| trial | 50 | 200 | 20 | 30 |
| pro | 500 | 2000 | 200 | 500 |
| team | 2000 | 10000 | 1000 | 2000 |

Reset: 24h từ thời điểm dùng đầu tiên trong ngày (`resets_at`).

## H. Events emit

| Event | Khi nào | Payload |
|---|---|---|
| `featuregate:refreshed` | sau fetch entitlements | `{ entitlements }` |
| `executiongate:granted` | token issued | `{ action, token, remaining }` |
| `executiongate:denied` | denied + reason | `{ action, reason, limit, used }` |
| `executiongate:completed` | complete success/fail/cancel | `{ action, status }` |
| `lock:acquired` / `lock:released` / `lock:force_released` | client lock state | `{ owner_type, owner_id }` |
| `quota:warning` | SSE quota_warning | `{ action, remaining, limit }` |
