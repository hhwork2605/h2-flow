# 05 — UI Specification

> **Cập nhật 2026-05-29:** đổi brand từ blue `#3186FF` sang **coral (light) / violet (dark)** theo Claude Design handoff. Mọi token & component map xem [`docs/features/00-design-system.md`](features/00-design-system.md) — đây là nguồn duy nhất. File này giữ phần spec layout sidebar + screen-by-screen.

## 0. Design tokens (TL;DR)

Chi tiết → [`features/00-design-system.md`](features/00-design-system.md). Tóm tắt:

- **Light:** nền cream `#f1ede4` + accent **coral `#de6b4a`**.
- **Dark:** nền near-black `#0c0c10` + accent **violet `#9177e1`** (trùng `node.generate`).
- Token theo contract **shadcn/ui** (`--background`, `--primary`, `--card`, `--border`, `--ring`…). Khai báo: [`src/index.css`](../src/index.css).
- Tailwind config: [`tailwind.config.ts`](../tailwind.config.ts) extend với `font-display` (Playfair Display), type scale role-named (`text-hero` 44px, `text-section` 20px, `text-eyebrow` 11px UPPERCASE, …), radius scale (10 → 18px), shadow tokens (`shadow-card`, `shadow-btn-glow`).
- **Fonts:** Playfair Display (display italic, hỗ trợ tiếng Việt), Inter (UI), JetBrains Mono (số liệu/code) — load qua Google Fonts trong 5 HTML entries.
- **Workflow diagram tokens** (`node.*`, `port.*`, `status.*`) giữ FIXED không đổi theo mode.
- **Legacy aliases** (`bg-bg-base`, `text-text-1`, `bg-brand-500`…) trỏ về vars mới — không cần migrate gấp, chỉ migrate khi đụng file đó.

### Z-index layers
```
0    — base content
10   — sticky header
20   — dropdown menu
40   — sidebar overlay
50   — modal dialog
60   — toast notification
70   — offline persistent toast
100  — clone-detected overlay (blocks everything)
```

### Radius
- `rounded-sm` 6 — inner toggle, segmented child
- `rounded` (DEFAULT) 10 — button, input, chip, segmented
- `rounded-lg` 14 — card, panel
- `rounded-xl` 18 — prompt card lớn

### Typography (role-named)

| Token | Size | Weight | Font | Use |
|---|---|---|---|---|
| `text-hero` | 44 / 1.05 | 400 italic | display | "Hãy tạo một thứ gì đó đẹp" |
| `text-section` | 20 / 1.1 | 400 italic | display | "Gần đây" |
| `text-input` | 16 / 1.55 | 400 | sans | textarea prompt |
| `text-body` | 13 / 1.5 | 400 | sans | UI mặc định |
| `text-meta` | 12 / 1.3 | 400 | sans | chip |
| `text-label` | 11.5 / 1.2 | 400 | sans | setting label |
| `text-eyebrow` | 11 / UPPERCASE / tracking-[0.12em] | 600 | sans | "STUDIO · GENERATE" |
| number/filename/kbd | — | — | mono | char count, status counters |

---

## 1. Sidebar layout

**Viewport**: Chrome Side Panel ~360–480px wide (user resize được). Min width 320px.

```
┌─────────────────────────────────────────────┐
│ [Header — sticky top, 48px]                 │
│ ┌──┐ Toby Flow [Free badge]   [⚡][🔔][☕][🌐][⚙][👤] │
│ │🎨│                                         │
│ └──┘                                         │
├─────────────────────────────────────────────┤
│ [Project Indicator — 32px, optional]        │
│  📂 My Flow Project        [▼] [＋]          │
├─────────────────────────────────────────────┤
│ [Tab bar — sticky, 40px, horizontal scroll]│
│ [Gen] [Multi] [Workflow] [Photo] [Hist] [Log]│
├─────────────────────────────────────────────┤
│                                             │
│              [Tab content]                  │
│              (scrollable)                   │
│                                             │
├─────────────────────────────────────────────┤
│ [Pipeline Footer — sticky bottom, 56px]     │
│ ▶️ Pipeline: OFF    [Settings] [Start All]  │
└─────────────────────────────────────────────┘
```

### Header (48px high)

Icons left-to-right:
1. **Logo + brand** (clickable → about modal)
2. **Plan badge** — `Free` (gray) / `Pro` (gold) / `Team` (blue) — click → upgrade modal
3. **Capture button** — yellow icon, prominent — click → start screen capture mode
4. **Changelog bell** — badge dot khi có version mới
5. **Tip Coffee** — gold coffee icon → tip modal
6. **Language** — globe icon → 4 flag option
7. **Settings dropdown** — gear icon → menu:
   - Settings (open settings.html in new tab)
   - Dark mode toggle
   - Extension link (admin set, optional)
   - Upgrade (hide nếu paid)
   - Contact support
   - Logout
8. **User avatar** — `?` khi chưa login, ảnh khi login. SSE status dot ở góc dưới phải avatar.

### Project Indicator (optional, hide khi không có project)
- Dropdown để switch giữa các Flow project
- `＋` để tạo project mới (mở tab Flow)

### Tab bar
- 6 tab: Generate, Multi-Task, Workflow, Photos, History, Logs
- Active state: bottom border 2px brand color + text bold
- Hover: bg `--bg-elevate`
- Badge `has-new` (pulse dot) khi tab có content mới (vd: workflow vừa complete)
- Lưu active tab vào `chrome.storage.local.af_active_sidebar_tab` để restore

### Pipeline Footer (Tab Workflow only)
- Toggle bật/tắt pipeline mode (run nhiều workflow song song)
- Show progress bar + count khi đang chạy

---

## 2. Tab 1 — Generate (GenTab) — Claude Design layout

Layout **1 cột trung tâm `max-w-[860px]`**, padding ngoài responsive theo container width (`px-3` / `sm:px-4` / `md:px-7`). Khoảng cách khối `gap-5.5` (22px). Khoang Hero + Provider + Prompt + Settings + RefImages + Advanced + Recent, theo trật tự:

```
                           STUDIO · GENERATE                    ← eyebrow 11px UPPERCASE
                  Hãy tạo một thứ gì đó đẹp.                    ← hero 44px italic display
                                       └─ "đẹp" sans 30px primary

           ┌─[Ảnh ⬛ │ Video ⬜]─┐   │   ┌─Google・ChatGPT👑・Grok👑・Gemini─┐
            kind toggle (ToggleGroup)  │     provider segmented (ToggleGroup)

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  💬  Prompt   · 0 prompt                              Multi-Prompt ⬜ ⬜  │
  │ ────────────────────────────────────────────────────────────────────── │
  │                                                                          │
  │  Mô tả thứ bạn muốn tạo… ánh sáng, bố cục, phong cách, chất liệu.        │
  │                                                                          │
  │ ────────────────────────────────────────────────────────────────────── │
  │  [✨ Nâng prompt] [🔖 Thư viện] [⚡ Chat AI] [📄 Import .txt] [📎]       │
  │                                       0 / 4000          [^ Nâng cao] [▶ Tạo  ⌘↵]
  └──────────────────────────────────────────────────────────────────────────┘

  ⚙ Cài đặt
  [Model ▼ ●]   [16:9 ▢]   [- 4 +]   [Tuần tự│Song song]   [Cinematic ▼]

  📷 Ảnh tham chiếu (0/10)             [🔍] [Tất cả ▼]
  ┌──── Kéo thả ảnh · chọn ảnh · Ctrl+V ────┐

  ⌃ Nâng cao  (Collapsible)
   / [filename________] .png          [Tự động tải] [1K│2K│4K]

  Gần đây
  [🖼][🖼][🖼][🖼]  grid 4 cột AspectRatio 16/9

  ────────────────── Run controls (sticky bottom) ──────────────────
  ☑ Tự tải   ☑ Tự thử lại            Hàng đợi 0/20  · Đã tạo 0 · Đã tải 0
                                                       [▶  Tạo  ⌘↵]   primary, btn-glow
```

### Behavior chính

- **Hero** "Hãy tạo một thứ gì đó đẹp." — `font-display italic`, color `text-foreground`, size co theo container: 26→34→44px. Chữ "đẹp" override sang `font-sans` weight 600 màu `primary`, size = 68% hero.
- **Kind + Provider** đặt cùng hàng, hai `ToggleGroup`. Có `VDivider` ngăn cách ở khổ rộng; xuống dòng tự nhiên ở vnarrow.
- **Prompt card** `rounded-xl` (18) + `bg-card` + `shadow-card`. Header bar có "Prompt · 0 prompt" + switch Multi-Prompt. Textarea trong suốt, min-h 170px (130px ở vnarrow).
- **Toolbar chips** dưới textarea: "Nâng prompt" highlight `text-primary border-primary/40`; còn lại `Button variant="secondary"`. Char count `font-mono`.
- **Tạo button** primary `bg-primary text-primary-foreground` + `shadow-btn-glow`, có `kbd ⌘↵`. Ở vnarrow giãn full bề ngang.
- **Settings strip** "Model · Tỉ lệ · Số lượng · Chế độ · Phong cách" — `flex-wrap items-end gap-2`. Vạch ngăn ẩn ở narrow.
- **Ảnh tham chiếu** luôn hiển thị (KHÔNG còn nằm trong Advanced — đã reorganize sau iteration trong chat handoff). Card `rounded-lg` + dropzone + search + filter.
- **Advanced (Collapsible)** chỉ còn filename + Tự động tải + Chất lượng.
- **Recent grid** 4 cột (`md:`), 3 cột (`sm:`), 2 cột (vnarrow). Card `rounded-lg` + `AspectRatio 16/9`.
- **Status bar** sticky bottom, dùng `Checkbox` shadcn cho "Tự tải" + "Tự thử lại" (success color khi bật), counters `font-mono` icon Lucide `Zap`/`Image`/`Download`.

### Interactions

- **Drag-drop image** vào ref section → auto add
- **Paste image** (Cmd+V) → add nếu cursor ở ref area
- **@ref1** trong prompt → mention helper auto-suggest
- **Ctrl+Enter** trong prompt area → start generation
- **Alt+G** (global) → submit current prompt

### States

| State | UI |
|---|---|
| Idle | "Tạo" button enabled với accent (`bg-primary`) + `shadow-btn-glow` |
| Running | Generate disabled, "Stop" visible (`bg-destructive`), progress bar |
| Quota exceeded | Generate disabled grey, banner đỏ "Đã hết quota — Upgrade?" |
| Provider tab not found | Banner warning "Mở tab Flow" + button auto-open |
| Cloudflare on Grok | Persistent toast top với countdown |
| No internet | Offline overlay full-screen |

---

## 3. Tab 3 — Workflow (key feature)

```
┌─────────────────────────────────────────────┐
│ [Toolbar — 40px]                            │
│ [+ New] [📁 Open] [🔍 Search]    [⚙ Sort ▼] │
├─────────────────────────────────────────────┤
│                                             │
│  [Workflow Cards — grid 2 col]             │
│  ┌────────────────┐ ┌────────────────┐     │
│  │ Workflow A    │ │ Workflow B     │     │
│  │ ─────────     │ │ ─────────      │     │
│  │ 5 nodes       │ │ 8 nodes        │     │
│  │ Last run 2h   │ │ Last run 1d    │     │
│  │ [▶][✏][📋][⋮] │ │ [▶][✏][📋][⋮]  │     │
│  └────────────────┘ └────────────────┘     │
│                                             │
└─────────────────────────────────────────────┘
```

Card actions:
- ▶ Run (lock all other workflows)
- ✏ Edit → mở popup workflow-editor.html
- 📋 Duplicate
- ⋮ More: Share, Export, Delete, Save as Template

### Workflow Editor (popup window, separate HTML)

Window mặc định: 1400×900, resizable.

```
┌────────────────────────────────────────────────────────────────┐
│ [Header — 48px]                                                │
│ Workflow: "My Pipeline" ✏  [▶ Run][💾 Save][📤 Export][⋯]       │
├────────┬───────────────────────────────────────────┬───────────┤
│ Palette│           DIAGRAM CANVAS                  │ Inspector │
│  240px │     (React Flow, zoom/pan)                │  300px    │
│        │                                           │           │
│ ┌─────┐│   ┌─────────┐    ┌─────────┐              │ Selected  │
│ │📝Pr.│ │   │  Prompt │───→│Generate │              │ node:     │
│ │💬CG │ │   └─────────┘    └────┬────┘              │ Generate  │
│ │🌟Gk │ │                       │                   │           │
│ │🖼Im │ │              ┌────────▼────┐              │ Settings: │
│ │⏱De │ │              │  Download   │              │ - Prompt  │
│ │🎬Gn │ │              └─────────────┘              │ - Model   │
│ │📥Dl │ │                                           │ - Ratio   │
│ │📤Te │ │                                           │ - Refs    │
│ │📝No │ │                                           │           │
│ │🔀Cn │ │                                           │ [Apply]   │
│ │🔁Mr │ │                                           │           │
│ └─────┘ │                                           │           │
├────────┴───────────────────────────────────────────┴───────────┤
│ [Footer — 32px]                                                │
│ Status: Idle | Last save: 2 min ago | 🟢 Connected             │
└────────────────────────────────────────────────────────────────┘
```

### Node rendering (React Flow custom node)

Mỗi node có:
- **Top floating provider pill** (chỉ generate/chatgpt/grok): logo + tên brand
- **Card body**:
  - Header: icon + node name (editable inline)
  - Body: 1-2 line summary (prompt snippet, model, ratio)
  - Footer: status indicator dot + duration
- **Ports** (handles):
  - Left = input (1 hoặc 0)
  - Right = output (0, 1, hoặc 2 cho condition)
  - Mỗi port: circle 12x12 với color theo port type + icon chữ (T/I/V/F/*)
  - Tooltip hover: tên port type
- **Edge** (connection): bezier curve với màu = port type, có animation "flowing dots" khi đang chạy

### Node states
| State | Visual |
|---|---|
| Idle | Border thường |
| Selected | Ring 2px brand |
| Running | Pulse animation + spinner overlay |
| Phase "sending" | Caption "📤 Đang gửi prompt..." |
| Phase "generating" | Caption "🎨 Đang gen ảnh/video..." |
| Phase "downloading" | Caption "📥 Đang tải kết quả..." |
| Completed | Border green + checkmark |
| Failed | Border red + error icon + tooltip với message |
| Disabled (toggled off) | Opacity 40% |

### Node Inspector (right panel)

Tùy theo node type:

**Generate / ChatGPT / Grok**:
- Prompt textarea (with @mention)
- Model dropdown (filtered theo provider)
- Ratio (aspect)
- Quantity slider
- Ref images (drag-drop, max theo provider)
- Auto-download toggle + resolution
- Download folder name
- Output mode (image/video)

**Prompt**:
- Text content
- Enhance toggle (gọi ChatGPT enhance prompt)
- Output result_text

**Download**:
- Folder name template (`{workflow}/{date}/{prompt}`)
- Resolution

**Telegram**:
- Bot config (link account)
- Send mode: image / video / album
- Caption template

**Delay**:
- Duration (ms)

**Condition**:
- Condition expression (vd: `result.length > 0`)
- Output 2 ports: true/false

**Merge**:
- Mode: concat / pick first / pick random

---

## 4. Tab 2 — Multi-Task

Layout: list dọc với cards expandable.

```
[Header]
┌─────────────────────────────────────────────┐
│ Multi-Task           [+ New Task][▶ Run All]│
└─────────────────────────────────────────────┘

[Task Card 1 — collapsed]
┌─────────────────────────────────────────────┐
│ ⏵ Task 1: "Logo variations"                 │
│ Provider: Flow • 5 prompts • Status: Done   │
│ [▶][✏][📋][🗑]                              │
└─────────────────────────────────────────────┘

[Task Card 2 — expanded]
┌─────────────────────────────────────────────┐
│ ⏷ Task 2: "Social posts"                    │
│ Provider: ChatGPT • 12 prompts             │
│ ┌─ Prompts list ─────────────────────────┐  │
│ │ 1. cosmic landscape         ✓ Done    │  │
│ │ 2. minimal poster           ⏳ Running│  │
│ │ 3. abstract art             ⏸ Pending │  │
│ └────────────────────────────────────────┘  │
│ Settings: Model=GPT-4o, Ratio=1:1, Refs=2   │
│ [▶ Run][⏹ Stop][✏ Edit]                     │
└─────────────────────────────────────────────┘
```

### Task Modal (create/edit)

Dialog full content:
- Task name
- Provider + model
- Prompts textarea (1/line)
- Ref images (per-task or per-prompt)
- Run mode (parallel/sequential)
- Auto-download
- Save to album

---

## 5. Tab 4 — Photos

Grid 2-3 col responsive, infinite scroll:

```
┌────────┐ ┌────────┐ ┌────────┐
│   🖼   │ │   🖼   │ │   🖼   │
│ prompt │ │ prompt │ │ prompt │
│ 2h ago │ │ 5h ago │ │ 1d ago │
└────────┘ └────────┘ └────────┘
```

Click ảnh → full-screen viewer với:
- Prompt text
- Provider/model badge
- Created at
- Actions: Download, Share, Add to album, Use as ref, Delete

Filter bar:
- Date range
- Provider
- Album
- Search prompt text

---

## 6. Tab 5 — History

List view, mỗi row 1 generation:

```
[Date header — 2026-05-28]
┌─────────────────────────────────────────────┐
│ 14:32 • Flow • Imagen 3 • 16:9              │
│ "A cosmic whale..."        4 imgs   [Replay]│
├─────────────────────────────────────────────┤
│ 14:18 • ChatGPT • DALL-E 3 • 1:1            │
│ "Minimal logo..."          1 img    [Replay]│
└─────────────────────────────────────────────┘
```

Click row → expand show ref images, all output tiles, link tới workflow run nếu có.

---

## 7. Tab 6 — Logs

Console-like UI, monospace font:
- Auto-scroll bottom (toggle on/off)
- Filter level: ALL / DEBUG / INFO / WARN / ERROR
- Search box
- Clear / Export buttons
- Each log line: timestamp + level badge + message

---

## 8. Settings page (settings.html, separate window)

Sidebar nav + content:

```
┌────────┬──────────────────────────────────────┐
│Account │  Storage Settings                    │
│ General│                                      │
│Storage │  Cache TTL: [7 days ▼]                │
│Notify  │  Max images: [1000]                  │
│Plans   │  ☑ Auto-clean stale blobs            │
│Billing │  ☑ Compress before upload (WebP)     │
│Adv.    │                                      │
│        │  Storage usage: 245 MB / 1 GB         │
│        │  [Clean now]                          │
└────────┴──────────────────────────────────────┘
```

Sections:
- **Account**: email, password, link Google, delete account
- **General**: language, theme, default model, default ratio
- **Storage**: TTL, quotas, IndexedDB cleanup
- **Notify**: webhook URL, Telegram bot, email digest
- **Plans**: current plan, expiry, upgrade button
- **Billing**: order history, invoices
- **Advanced**: debug flags, reset, export config

---

## 9. Modal patterns

### CustomDialog
Base modal với:
- Header: title + close X
- Body: content
- Footer: Cancel + Primary action
- Overlay: rgba(0,0,0,0.5), click outside = close (configurable)
- Animation: fade + scale 0.95 → 1.0 (200ms)

### Variants
- **Confirm**: title + body text + 2 buttons (Cancel / Confirm)
- **Form**: title + form fields + submit
- **Plan picker**: title + plan cards + payment buttons
- **Image picker**: title + grid albums/photos + select

### Login Modal
2 sub-views (Login / Register) với toggle bottom:
- Email + password fields
- Forgot password link
- Divider "hoặc"
- Google OAuth button (đỏ Google brand)
- Switch view link

### Tip Coffee Modal
- Description text
- Amount input + quick buttons (20k/30k/50k/100k/200k)
- Bank info list khi click amount
- QR code image (gen từ VietQR API)

### Contact Modal
4 contact link items với icon brand:
- Hướng dẫn (Book icon)
- Zalo (blue)
- Telegram (cyan)
- Facebook (blue)

### Upgrade Modal
- Plan cards (Free vs Pro vs Team) với feature comparison
- Highlight current plan
- Sticky footer với 2 payment buttons (VietQR / International — tạm placeholder)
- Slide-up animation footer khi lần đầu open

### Language Modal
4 options với flag SVG inline + check icon khi selected:
- 🇻🇳 Tiếng Việt
- 🇬🇧 English
- 🇹🇭 ภาษาไทย
- 🇯🇵 日本語

### Cloudflare Toast (persistent)
Top-center, không auto-dismiss:
- Icon shield
- Title: "🛡️ Cloudflare Grok challenge — đang chờ verify…"
- Subtitle: "Đã chờ Xs. Nếu lâu không pass, click vào tab Grok để verify."
- Button: "Mở Grok"
- Sau 30s → `is-urgent` style đỏ + title escalate

### Offline Overlay
Full-screen blocking:
- Icon Wi-Fi off
- Title: "Mất kết nối Internet"
- Description
- Retry button

### Clone-detected Overlay
Z-index 100, blocks everything:
- Shield icon
- Title: "Extension không hợp lệ"
- Description
- Button: "Mở Chrome Web Store"

---

## 10. Toast notifications

Top-right, max 3 stacked, auto-dismiss 2.5s:
- Success (green check)
- Error (red X)
- Warning (yellow triangle)
- Info (blue i)

Slide-in from right, slide-out left when dismiss.

---

## 11. Empty states

| Tab | Empty content |
|---|---|
| Generate | "Type a prompt to start generating" + đèn pin icon |
| Multi-Task | "No tasks yet" + [+ Create your first task] |
| Workflow | "No workflows yet" + [+ Create] + [Browse templates] |
| Photos | "No images yet" + tutorial link |
| History | "No history yet" |
| Albums | "Create your first album" |

---

## 12. Loading states

- **Initial load**: full-screen overlay với spinner + "Loading..." (mini-i18n)
- **Connecting to Flow**: secondary overlay với spinner + "Connecting to Flow..."
- **Tab content load**: skeleton (3-5 placeholder cards)
- **Inline action**: spinner thay icon trong button

---

## 13. Responsive behavior

Sidebar:
- 320–360px: stack tất cả, hide "Last run" text trong workflow card, chỉ icon button
- 360–480px (default): comfortable 2-col grid, full text
- 480px+: 3-col grid

Workflow editor (popup):
- < 1024px: hide right inspector, click node → modal full inspector
- 1024–1400px: 2 panel (palette + canvas)
- > 1400px: 3 panel đầy đủ

---

## 14. Accessibility

- **Tab order**: header → tab bar → content → footer
- **Focus visible**: ring 2px brand + offset 2px
- **ARIA labels**: mọi icon button có `aria-label`
- **Keyboard shortcuts**:
  - `Alt+G`: generate
  - `Alt+S`: toggle sidebar (Chrome native)
  - `Ctrl+S` trong editor: save workflow
  - `Esc`: close modal
  - `Ctrl+Z/Y` trong editor: undo/redo
- **Live region**: notification toast announce qua `aria-live="polite"`
- **Color contrast**: WCAG AA cho text 4.5:1, large text 3:1
- **Dark mode**: full coverage, no hard-coded colors

---

## 15. Asset requirements

- Logo SVG (icon-16/32/48/128 PNG + SVG master)
- Bank logo (14 ngân hàng VN) — optional, có thể text only
- Provider brand logos: Google Flow, OpenAI, Grok (xAI), Gemini — đã có trong NodeTemplates
- Flag SVG: VN, GB, TH, JP — inline data URI (xem code gốc)
