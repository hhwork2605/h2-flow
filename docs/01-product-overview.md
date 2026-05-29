# 01 — Product Overview (PRD)

## 1. Tóm tắt sản phẩm

**Tên gọi nội bộ**: AutoFlow (codename) / branding của bạn
**Loại**: Chrome Extension Manifest V3 (Side Panel + Content Scripts)
**Tagline**: *Tự động hoá tạo ảnh/video AI hàng loạt trên Google Flow, ChatGPT, Grok, Gemini — workflow kéo-thả trực quan, tải về 2K/4K, gửi Telegram tự động.*

**Tóm gọn nghiệp vụ một dòng**: SaaS extension cho content creator: dựng workflow visual để generate ảnh/video AI hàng loạt qua nhiều provider, theo quota daily với gói free/premium thanh toán qua VietQR.

---

## 2. Vấn đề & Giải pháp

### Vấn đề người dùng gặp
1. **Mỗi lần gen 1 ảnh**: phải copy prompt → paste sang Google Flow / ChatGPT / Grok → đợi → tải về thủ công.
2. **Đa provider rời rạc**: muốn so sánh kết quả của Flow vs ChatGPT vs Grok thì phải mở 3 tab, không pipeline được.
3. **Không có batch**: muốn gen 50 prompt thì phải làm 50 lần.
4. **Không có chuỗi nghiệp vụ**: "lấy ảnh từ ChatGPT → upscale ở Flow → gửi Telegram" không tự động được.
5. **Tải về chất lượng cao** (2K/4K) phải mò UI provider.

### Giải pháp
- Sidebar Chrome dùng làm command center, **điều khiển tab provider** qua content scripts.
- **Visual workflow editor** (node-based) cho phép user định nghĩa pipeline phức tạp.
- **Batch + parallel/sequential** chạy nhiều prompt cùng lúc.
- **Bridge giữa provider**: output ChatGPT/Grok → upload sang Flow (chuyển sang UUID bền) → dùng làm input cho node tiếp theo.
- **Auto-download** chất lượng cao + tổ chức theo folder workflow.
- **Telegram bot** gửi kết quả ngay khi gen xong.

---

## 3. User Persona

### P1 — Content creator solo (chính)
- 22–35 tuổi, designer/marketer freelance.
- Tự sản xuất ảnh/video cho TikTok, Instagram, Etsy, Pinterest.
- Cần khối lượng lớn: 50–200 ảnh/ngày, đa style.
- Biết dùng AI tools nhưng không code.
- Sẵn sàng trả $5–15/tháng để tiết kiệm 3–4h/ngày.

### P2 — Agency nhỏ
- 5–15 người, làm content cho client.
- Cần share workflow (template) giữa thành viên.
- Cần audit log: ai chạy gì, khi nào.
- Sẵn sàng trả gói team $30–50/tháng.

### P3 — Power user AI
- Khám phá khả năng pipeline AI.
- Thử style mới: bridge ChatGPT → Flow để có UUID bền.
- Quan tâm angles editor, effects editor.

---

## 4. Monetization

### 4.1 Mô hình
**Freemium** với 4 trục giá trị:

| Trục | Free | Pro | Team |
|---|---|---|---|
| Daily quota (workflow_run) | 10 | 200 | 1000 |
| Provider | Flow only | Flow + ChatGPT + Grok | + Gemini, Custom |
| Auto-download | 1K | 1K/2K | 4K |
| Telegram integration | ❌ | ✅ | ✅ |
| Workflow templates share | ❌ | Public | Team-private |
| Storage (album) | 100 ảnh | 1000 | Unlimited |
| Support | Email | Priority | Dedicated |

### 4.2 Kênh thu
1. **Subscription** qua VietQR (MB, TCB, VCB, BIDV, VTB, TPB, STB, SHB, MSB, VPB, SCB, OCB, EIB, ACB)
   - Plans được fetch từ `GET /api/v1/plans`
   - Order tạo qua `POST /api/v1/orders` → trả về QR code
   - Server confirm qua webhook ngân hàng → activate plan
2. **Tip Coffee** (one-time donation): 20k / 30k / 50k / 100k / 200k VNĐ — QR ngân hàng tĩnh
3. **Referral program**: mời bạn → bạn upgrade → reward (số ngày Pro bonus hoặc % giảm giá lần renew)

### 4.3 Trial / Onboarding
- New user: **TrialGate** cho phép dùng thử N ngày bản Pro (server-driven, có thể tắt từ admin)
- Khi hết trial → fallback Free quota
- Clone-detected (sai extension key) → khoá hoàn toàn, hiện overlay "Mở Chrome Web Store"

---

## 5. Tính năng cốt lõi (Feature Inventory)

### 5.1 Sidebar — 6 tab chính

| Tab | Tên | Chức năng |
|---|---|---|
| 1 | **Generate** (GenTab) | Quick batch: 1 provider, nhiều prompt, ref images, auto-download |
| 2 | **Multi-Task** | Tạo nhiều task riêng biệt, mỗi task config khác nhau |
| 3 | **Workflow** | Visual editor (Drawflow), pipeline đa node |
| 4 | **Photos** | Browse output đã gen, search, filter |
| 5 | **History** | Lịch sử generation, replay prompt |
| 6 | **Logs** | Debug logs (export được) |

Ngoài ra có **Snippets** (prompt template ngắn), **Albums** (collection ảnh), **Templates** (workflow chia sẻ).

### 5.2 Workflow Node Catalog (14 loại)

| Node | Vai trò | Inputs | Outputs |
|---|---|---|---|
| `generate` | Gen Flow | 1 | 1 (image/video) |
| `chatgpt` | Gen ChatGPT | 1 | 1 (image) |
| `grok` | Gen Grok | 1 | 1 (image/video) |
| `prompt` | Prompt text (có enhance) | 0–1 | 1 (text) |
| `text` | Text input thuần | 0 | 1 (text) |
| `image` | Image input thuần | 0 | 1 (image) |
| `transform` | Biến đổi ảnh/video | 1 | 1 |
| `condition` | Rẽ nhánh (if/else) | 1 | 2 |
| `merge` | Gộp inputs | 2 | 1 |
| `delay` | Trì hoãn | 1 | 1 |
| `download` | Tải về máy | 1 | 0 |
| `telegram` | Gửi Telegram | 1 | 0 |
| `note` | Ghi chú (không thực thi) | 0 | 0 |
| `output` | Kết quả cuối | 1 | 0 |

### 5.3 Port type system (5 loại)

| Type | Màu | Icon | Compatible with |
|---|---|---|---|
| `text` | #9177e1 | T | text, any |
| `image` | #3b82f6 | I | image, frame, any |
| `video` | #a855f7 | V | video, any |
| `frame` | #14b8a6 | F | frame, image, any |
| `any` | #71717a | * | tất cả |

### 5.4 Tính năng phụ
- **Screen Capture**: chụp màn hình → dùng làm ref image
- **Angles Editor**: chỉnh góc camera cho video (popup window riêng)
- **Effects Editor**: hiệu ứng cho video (popup window riêng)
- **Albums**: bộ sưu tập ảnh đã gen, có thumbnail 3-tier
- **Snippets / MyPrompts**: prompt template tái sử dụng + `@mention` để map ref image
- **Notification bell**: thông báo từ admin (in-app banner)
- **Changelog**: hiện version mới + badge khi có update
- **Multi-language**: vi (default), en, th, ja
- **Dark/Light theme**
- **Project indicator**: gắn sidebar với 1 Flow project
- **Referral**: copy mã + share link

---

## 6. Non-functional Requirements

### Performance
- Sidebar boot < 1s sau khi mở Chrome
- Workflow editor responsive với 50+ nodes
- IndexedDB read < 50ms cho 1000 ảnh metadata
- SSE reconnect < 5s sau khi network back

### Reliability
- **Single-runner lock**: chỉ 1 workflow chạy cùng lúc trên toàn extension (Web Locks API + heartbeat 60s, TTL 5 phút)
- **Auto-clear stale flag**: nếu Service Worker chết, sau 5 phút auto-recover
- **Retry với exponential backoff**: 5s → 10s → 20s → 40s → 60s max, tối đa 10 lần
- **Offline detection**: hiện overlay block UI khi mất mạng

### Security
- Anti-clone: extension key trong manifest + RequestSigner HMAC
- Token JWT 2h TTL cho Mercure
- Backend authoritative cho mọi quota decision
- CSP nghiêm ngặt: `script-src 'self'`

### Scalability
- SSE leader-follower: 1 tab giữ kết nối, các tab khác nhận qua BroadcastChannel
- Mercure Hub cho paid user (push scale tốt hơn EventSource)
- Polling fallback 30s cho free user (giảm tải SSE)

### i18n
- 4 ngôn ngữ load từ `/api/v1/i18n/{locale}` (server-driven)
- Bootstrap mini-i18n cho loading screen (chạy trước khi I18n class load)

---

## 7. Constraints & Risk

### Constraints kỹ thuật
- **Manifest V3 CSP**: KHÔNG được dùng inline script, eval, remote script. Mọi script phải `src='self'`.
- **Service Worker lifecycle**: SW có thể bị Chrome kill bất cứ lúc nào → mọi state quan trọng phải persist `chrome.storage` hoặc IndexedDB.
- **Cross-context**: sidebar + popup editor + content script + service worker phải sync qua `chrome.runtime.sendMessage` + `BroadcastChannel`.
- **Content script CSP**: trang provider (chatgpt.com) có CSP riêng → adapter phải dùng `world: MAIN` cho slate-bridge để truy cập React internals.

### Rủi ro pháp lý
- ChatGPT/Grok/Google có thể block extension bất cứ lúc nào → cần fallback graceful.
- Selector DOM của provider thay đổi → backend `GET /providers/dom-selectors` để hot-fix không cần update extension.

### Rủi ro UX
- Cloudflare challenge trên Grok → cần toast hướng dẫn user verify thủ công.
- Quota exhausted giữa batch → cần thông báo rõ ràng, không phá flow.

---

## 8. Success Metrics

| Metric | Target tháng 6 |
|---|---|
| DAU | 500 |
| Free → Pro conversion | 5% |
| Workflow runs / DAU | 8 |
| Avg session duration | 15 phút |
| Retention D7 | 30% |
| NPS | > 40 |
| Crash rate | < 0.5% |

---

## 9. Out of Scope (cho clone)

Không cần làm trong MVP clone:
- Marketplace workflow public (chia sẻ workflow ra ngoài team)
- Stripe / PayPal (chỉ VietQR cho thị trường VN)
- Mobile companion app
- Desktop app standalone (ngoài extension)
- AI agent tự suggest workflow

---

## 10. Glossary

| Thuật ngữ | Nghĩa |
|---|---|
| **Provider** | Dịch vụ AI: Flow, ChatGPT, Grok, Gemini |
| **Adapter** | Class implement giao diện gọi 1 provider |
| **Tile** | Đơn vị output (1 ảnh/video) từ Flow, có UUID bền |
| **file_id** | ID nội bộ ngắn (vd: tile UUID hoặc synthetic ID cho ChatGPT/Grok) |
| **file_name** | Flow UUID (chỉ Flow có) — dùng để re-fetch sau reload |
| **thumbnail_url** | URL ảnh thu nhỏ (có thể từ provider CDN, có thể từ blob cache) |
| **Node** | 1 ô trong workflow |
| **Port** | Đầu vào/ra của node, có type |
| **Workflow** | Tập hợp node + edge |
| **Job** | 1 lần chạy workflow |
| **Quota** | Hạn mức ngày/tháng (theo plan) |
| **ExecutionGate** | Server endpoint check quyền chạy + cấp token |
| **FeatureGate** | Client cache feature flag từ `/entitlements` |
| **Trial** | Thời gian dùng thử Pro miễn phí |
| **Clone-detected** | Extension không phải bản chính thức → khoá |
