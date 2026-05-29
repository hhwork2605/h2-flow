# `docs/features/` — Đặc tả tính năng chi tiết

Thư mục này mô tả **từng feature theo action** của h2-flow (rebuild TobyFlow 1.1.5). Khác với:

- `docs/11-features-spec.md` — overview cấp cao, kiến trúc + flow.
- `docs/08-api-contract.md` — schema API.
- `docs/MOCK-API.md` — mock endpoints.

Ở đây tập trung **business logic chi tiết**: mỗi action user/system làm gì, đường happy path, các case lỗi chính cần xử lý ở UI/state.

## Format

Mỗi action tuân theo cấu trúc thống nhất:

```md
### <Tên action>

- **Trigger:** điều gì kích hoạt action (user click, SSE event, timer…)
- **Preconditions:** state cần có trước khi chạy (logged-in, quota còn, tab open…)
- **Steps:** 3-7 bước chính (đánh số)
- **Happy path:** kết quả mong đợi + side-effects (storage, event bus, UI)
- **Case lỗi:** 2-3 case lỗi quan trọng nhất + cách xử lý ở UI

(Bỏ qua **Preconditions** nếu hiển nhiên — không bắt buộc.)
```

## Index

| File | Phạm vi | Phase ưu tiên |
|---|---|---|
| [00-design-system.md](00-design-system.md) | **Design System** — tokens (coral/violet), typography (Playfair Display + Inter + JetBrains Mono), radius, spacing, component map sang shadcn/Radix, icon Lucide, responsive rule | xuyên suốt |
| [01-auth.md](01-auth.md) | Login/Register/Logout/Refresh, Google OAuth, RequestSigner, Anti-clone & self-heal, ApiBaseConfig override | P1 |
| [02-quota-gate.md](02-quota-gate.md) | FeatureGate, ExecutionGate, ExecutionLock, TrialGate, UsageSync, quota footer | P2-P5 |
| [03-generate.md](03-generate.md) | Gen tab (single/multi-prompt), Reference images, Capture, Snippets/MyPrompts, ChatAI enhance, Providers (Flow/ChatGPT/Grok/Gemini), PromptQueue, TileMonitor, History, ProviderTabLock | P2-P4 |
| [04-workflow.md](04-workflow.md) | Workflow editor, Executor engine, NodeTemplates, Ports/types, List & CRUD, Templates, Share, History, Queue panel | P3 |
| [05-media.md](05-media.md) | ImageStore (3-tier), ThumbnailCache, MediaRegistry, BlobUrlManager, Albums CRUD, Photos tab, DownloadExecutor (auto-download) | P2-P4 |
| [06-tasks-multi.md](06-tasks-multi.md) | Multi-task tab (batch jobs), Angles editor popup, Effects editor popup | P4 |
| [07-integrations.md](07-integrations.md) | Telegram link & send, Notifications, Announcement, Referral, Tip Coffee, VietQR plan upgrade | P5-P6 |
| [08-platform.md](08-platform.md) | Settings sync 2-tier, i18n bootstrap, Theme, Offline detection, Logging, Keyboard shortcuts, SSE client | xuyên suốt |

## Quy ước tham chiếu reference-ext

Khi mô tả nghiệp vụ có nguồn gốc từ bản gốc TobyFlow 1.1.5, cite trực tiếp file gốc:

```md
> Nguồn: `reference-ext/src/core/AuthManager.js` (loginWithGoogle + _handleGoogleCallback)
```

Khi rebuild trên stack mới thay đổi cách làm so với bản gốc (vd: dùng React Query thay vì in-memory cache), note rõ:

```md
> Rebuild note: docs/03 dùng TanStack Query thay vì self-managed cache.
```

## Khi nào update

- Khi implement xong 1 action → đối chiếu spec, fix sai/lỗi/thiếu trong file feature.
- Khi user chốt thêm 1 case lỗi mới → thêm vào mục **Case lỗi**.
- Khi đổi flow (vd: bỏ qua Telegram link bước nào) → cập nhật **Steps**.

KHÔNG xoá action cũ vì "chưa làm" — đánh dấu `(P5+)` để biết phase nào sẽ implement.

## Status legend trong file

- ✅ Đã implement, đã verify trong UI mock
- 🚧 Đang làm dở
- 📋 Đã spec, chưa code
- 🔒 Phụ thuộc backend thật, chưa thể test end-to-end với mock
