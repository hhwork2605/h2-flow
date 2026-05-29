# TobyFlow Clone — Tài liệu Vibe-Coding

Bộ tài liệu này được trích xuất từ phiên bản TobyFlow 1.1.5 (Chrome Extension Manifest V3, Vanilla JS) với mục đích **rebuild lại từ đầu trên stack hiện đại** bằng cách feed từng file `.md` vào AI coding agent (Cursor, Claude Code, v0, Bolt, Lovable…).

---

## Cách dùng tài liệu (vibe-coding workflow)

### 1) Đọc theo thứ tự lần đầu
Đọc từ `00 → 13` để nắm tổng thể trước khi code:

| File | Mục đích |
|---|---|
| `00-README.md` (file này) | Cách dùng tài liệu, prerequisites |
| `01-product-overview.md` | PRD: nghiệp vụ, persona, monetization |
| `02-architecture.md` | Kiến trúc hệ thống, data flow, multi-context sync |
| `03-tech-stack.md` | React + Vite + TS + thư viện cụ thể, lý do chọn |
| `04-project-structure.md` | Folder layout đầy đủ |
| `05-ui-spec.md` | UI spec từng screen + design tokens (cho gen UI) |
| `06-data-models.md` | TypeScript types/interfaces |
| `07-storage-schema.md` | IndexedDB stores + chrome.storage keys |
| `08-api-contract.md` | REST + SSE/Mercure API spec đầy đủ |
| `09-workflow-engine.md` | Node catalog + execution engine |
| `10-providers-spec.md` | Adapter spec cho Flow/ChatGPT/Grok/Gemini |
| `11-features-spec.md` | Auth, quota, i18n, capture, telegram, album… |
| `12-implementation-roadmap.md` | Phased build plan (6 phase) |
| `13-vibe-coding-prompts.md` | Prompt templates feed AI agent |

### 2) Khi vibe-code 1 module
Mở `13-vibe-coding-prompts.md`, copy prompt template tương ứng module, kèm:
- **Stack info**: copy từ `03-tech-stack.md`
- **Project layout**: copy phần liên quan từ `04-project-structure.md`
- **UI spec** (nếu cần gen UI): copy phần screen tương ứng từ `05-ui-spec.md`
- **Data model**: copy types liên quan từ `06-data-models.md`
- **API contract** (nếu module gọi server): copy endpoint spec từ `08-api-contract.md`

Paste tất cả vào agent → cho code → review → commit.

### 3) Khi gen UI bằng v0 / Lovable / Bolt
Chỉ cần đoạn UI spec + design tokens trong `05-ui-spec.md` + bộ data model trong `06-data-models.md` là đủ. Bỏ qua các file backend-heavy như `08`, `09`, `10`.

### 4) Khi build backend
Backend nằm ngoài scope tài liệu này. Chỉ cần `08-api-contract.md` để implement đúng REST + SSE contract.

---

## Nguồn tham chiếu nghiệp vụ — `reference-ext/`

Repo có thư mục `reference-ext/` chứa **mã nguồn TobyFlow 1.1.5 bản gốc** (unpacked, Vanilla JS, Manifest V3). Đây là **ground truth về nghiệp vụ** khi bộ docs này chưa đủ chi tiết.

**Khi vibe-code 1 module mà nghiệp vụ chưa rõ** (thuật toán, edge case, payload shape, selector DOM, retry/delay, error mapping…) → **đọc file tương ứng trong `reference-ext/` trước khi viết code**, KHÔNG tự bịa.

Quy tắc đầy đủ + bảng mapping nhanh `docs/` ↔ `reference-ext/` xem `CLAUDE.md` ở root repo.

Tóm tắt nguyên tắc:
- Mâu thuẫn về **kiến trúc/tech stack** → theo `docs/`.
- Mâu thuẫn về **hành vi/nghiệp vụ** → theo `reference-ext/` (code production đã chạy).
- KHÔNG copy-paste `.js` sang `src/` — rewrite TS-strict, React-idiomatic theo `03-tech-stack.md`.
- KHÔNG sửa file trong `reference-ext/` — đây là snapshot read-only.

---

## Prerequisites cho người clone

| Skill | Mức |
|---|---|
| TypeScript + React | Trung cấp |
| Chrome Extension Manifest V3 | Cơ bản (sẽ học thêm qua tài liệu) |
| State management (Zustand/Jotai/Redux) | Cơ bản |
| IndexedDB | Cơ bản (qua Dexie) |
| Backend bất kỳ (Node/Laravel/Django…) | Bạn tự build |

---

## Phạm vi clone

Bộ tài liệu này mô tả **clone 1:1 mọi tính năng** của bản gốc:

- Sidebar + 6 tab (Generate, Multi-Task, Workflow, Photos, History, Logs)
- Workflow visual editor (node-based, Drawflow)
- Multi-provider AI: Google Flow, ChatGPT, Grok, Gemini
- Auth (email/password + Google OAuth)
- Server-authoritative quota (FeatureGate + ExecutionGate)
- SSE realtime + Mercure Hub + polling fallback
- Multi-tab leader-follower sync (BroadcastChannel)
- IndexedDB storage cho ảnh/album/thumbnail (TTL, blob, 3-tier quality)
- Anti-clone (RequestSigner HMAC)
- 4 ngôn ngữ: vi, en, th, ja
- Screen Capture
- Album, Snippets, Templates, History
- Telegram bot integration
- VietQR payment + Tip Coffee + Referral
- Angles Editor, Effects Editor (popup mode)
- Cloudflare challenge handling cho Grok

---

## Quy ước trong tài liệu

- **MUST / SHOULD / MAY**: theo RFC 2119
- **Server-Only**: dữ liệu phải fetch từ backend, KHÔNG hard-code client
- **Server-Authoritative**: quota/quyền do server quyết, client chỉ render
- **Tier 1 LIVE / Tier 2 RESPECTFUL**: 2 tier khi sync settings (xem `07-storage-schema.md`)

---

## Bản quyền & nguồn gốc

Tài liệu này được tạo bằng cách **reverse-engineer code đã unpacked** của extension TobyFlow 1.1.5 (extension công khai trên Chrome Web Store). Mục đích: học tập, nghiên cứu kiến trúc, build sản phẩm tương tự cho thị trường khác.

Không sao chép trực tiếp asset (icon, logo, brand "Toby Flow"). Khi clone, dùng tên/brand riêng của bạn.
