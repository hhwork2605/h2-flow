# 00 — Design System

Tài liệu nguồn cho **mọi quyết định màu / typography / spacing / component** trong h2-flow. Sync với Claude Design handoff (xem [`docs/design-handoff/`](../design-handoff/HANDOFF.md)).

> Nguyên tắc: KHÔNG hardcode hex / px trong component. Luôn dùng **class semantic shadcn** (`bg-primary`, `text-muted-foreground`, `border`, …) hoặc **token Tailwind đã được khai báo** (`font-display`, `text-hero`, `shadow-btn-glow`, `rounded-xl`). Code mới vi phạm → từ chối review.

---

## 1. Color strategy — Light ↔ Dark

| Mode | Nền | Accent (primary) | Trigger |
|---|---|---|---|
| **Light** | warm cream `#f1ede4` | **coral** `#de6b4a` | mặc định |
| **Dark** | near-black `#0c0c10` | **violet** `#9177e1` | thêm class `.dark` lên `<html>` |

- **Violet `#9177e1` ≡ `node.generate`/`node.prompt`** đã có sẵn trong workflow editor → primary tối tận dụng được hệ thống diagram, không phá tokens cũ.
- **Coral** mới — tone ấm cho light mode.
- `node.*`, `port.*`, `status.*` giữ FIXED — đây là màu ngữ nghĩa của diagram, không đổi theo mode.
- Khi cần một hue tuyệt đối bất kể mode, dùng palette `violet-{50..900}` hoặc `coral-{50..900}`.

### Semantic tokens (shadcn contract)

Tất cả khai báo trong [`src/index.css`](../../src/index.css) dạng HSL channel.

| Token | Light | Dark | Class shortcut |
|---|---|---|---|
| `background` | cream `#f1ede4` | `#0c0c10` | `bg-background` |
| `foreground` | ink `#1d1a13` | `#ececf1` | `text-foreground` |
| `card` | `#fbf8f1` | `#15151c` | `bg-card text-card-foreground` |
| `popover` | `#fbf8f1` | `#1c1c25` | `bg-popover` |
| `primary` | coral `#de6b4a` | violet `#9177e1` | `bg-primary text-primary-foreground` |
| `secondary` | `#f5f1e7` | `#1c1c25` | `bg-secondary` |
| `muted` | `#f5f1e7` | `#1c1c25` | `bg-muted` |
| `muted-foreground` | `#8a8170` | `#9595a3` | `text-muted-foreground` |
| `accent` | `#ede8db` | `#23232e` | `bg-accent` |
| `border` | `#dcd6c9` | `#2a2a33` | `border` (tự áp) |
| `input` | `#dcd6c9` | `#2a2a33` | `border-input` |
| `ring` | coral | violet | `ring-ring focus-visible:ring-2` |
| `destructive` | `#ef4444` | `#dc2626` | `bg-destructive text-destructive-foreground` |
| `success` | `#2f9e6f` | `#5bcfa1` | `text-success` |
| `warning` | amber `#f59e0b` / `#facc15` | tương tự | `text-warning` |

### Legacy aliases (back-compat)

71 file hiện đang dùng `bg-bg-base`, `text-text-1`, `bg-brand-500`… Vẫn hoạt động vì các vars `--bg-base`, `--text-1`, `--brand-500` đã được trỏ về cùng giá trị HSL mới. Code MỚI ưu tiên semantic — legacy chỉ tồn tại để giảm churn.

Quy ước migrate dần (không bắt buộc, làm khi sửa file kế tiếp):

| Cũ | Mới |
|---|---|
| `bg-bg-base` | `bg-background` |
| `bg-bg-elevate` | `bg-card` (hoặc `bg-secondary`) |
| `bg-bg-overlay` | `bg-popover` |
| `text-text-1` | `text-foreground` |
| `text-text-2` | `text-muted-foreground` |
| `text-text-3` | `text-muted-foreground/70` |
| `bg-brand-500` | `bg-primary` |
| `text-brand-500` | `text-primary` |
| `ring-brand-500` | `ring-ring` |
| `border-border` | `border` (đã global apply) |

---

## 2. Typography

Load qua Google Fonts CDN trong 5 HTML entries (sidebar, workflow-editor, angles-editor, effects-editor, settings).

| Family | Dùng cho | Tailwind class |
|---|---|---|
| **Playfair Display** (italic, hỗ trợ tiếng Việt) | hero heading, section heading, wordmark | `font-display` |
| **Inter** | UI sans-serif mặc định | `font-sans` |
| **JetBrains Mono** | số liệu, filename, char count, kbd | `font-mono` |

> **Đã thử Instrument Serif → bỏ** vì thiếu glyph dấu thanh tiếng Việt ("Gà ̀n đây" hiển thị sai). Playfair Display đầy đủ dấu.

### Type scale

| Token | Size | Use | Class |
|---|---|---|---|
| `text-hero` | 44 / 1.05 / -0.02em | Hero "Hãy tạo một thứ gì đó đẹp" | display italic |
| `text-section` | 20 / 1.1 | Section heading ("Gần đây") | display italic |
| `text-input` | 16 / 1.55 | Textarea prompt | sans |
| `text-body` | 13 / 1.5 | UI mặc định | sans |
| `text-meta` | 12 / 1.3 | Chip, nhãn nhỏ | sans |
| `text-label` | 11.5 / 1.2 | Setting label | sans |
| `text-eyebrow` | 11 / UPPERCASE / tracking-[0.12em] | "STUDIO · GENERATE" | sans uppercase |

Số liệu / filename / kbd luôn `font-mono`.

### Responsive size (extension side panel)

Hero co theo container: `text-[26px]` (vnarrow <480), `text-[34px]` (narrow <680), `text-hero` (default). Dùng `sm:` / `md:` breakpoints hoặc ResizeObserver hook (xem §6).

---

## 3. Radius & elevation

`--radius: 10px` là base. Scale theo `calc()`:

| Token | px | Use |
|---|---|---|
| `rounded-sm` | 6 | inner toggle, segmented child, checkbox |
| `rounded-md` | 8 | nhỏ hơn default 1 step |
| `rounded` (DEFAULT) | 10 | button, input, chip, segmented |
| `rounded-lg` | 14 | card, panel (refImages, advanced, status) |
| `rounded-xl` | 18 | prompt card lớn |
| `rounded-2xl`/full | — | tuỳ ngữ cảnh (avatar tròn …) |

Shadows:

| Token | Dùng cho |
|---|---|
| `shadow-card` | card nổi nền sáng |
| `shadow-card-dark` | card nổi nền tối |
| `shadow-btn-glow` | nút primary (Tạo, Dự án mới) — tự pick alpha 50% của `--primary` |

---

## 4. Spacing nhịp chính

- Gap dày dùng nhiều: `gap-1.5` (6), `gap-2` (8), `gap-2.5` (10), `gap-3` (12), `gap-3.5` (14).
- Khối lớn cách nhau `gap-5.5` (22px — custom step).
- Padding ngoài cột chính: `px-3` (vnarrow), `sm:px-4` (narrow), `md:px-7` (default = 28px).
- Cột chính `max-w-[860px]` căn giữa.
- Spacing custom thêm: `4.5` (18px), `5.5` (22px), `13` (52px).

---

## 5. Component inventory (prototype → shadcn/Radix)

Khi viết component mới, MAP theo bảng dưới. Cài shadcn primitive trước khi dựng. Bảng đầy đủ ở [`HANDOFF.md §5`](../design-handoff/HANDOFF.md).

| Khu UI | Component shadcn | Note |
|---|---|---|
| Top bar (logo + meta + icon buttons + Đăng nhập) | custom `<AppHeader/>` | icon btn = `Button variant="ghost" size="icon"` + `Tooltip`; logo `bg-primary text-primary-foreground` |
| Đăng nhập button | `Button variant="default"` | foreground/background hoặc primary tuỳ ngữ cảnh |
| Tabs (8 tabs Gen…Logs) | `Tabs` (Radix) hoặc nav buttons | active = `bg-card border` indicator dưới |
| Project switcher chip | `DropdownMenu` trigger = `Button variant="outline"` | list project + "Tạo dự án" |
| Dự án mới | `Button` (primary) + icon `Plus` | shadow `btn-glow` |
| Kind toggle (Ảnh / Video) | `ToggleGroup type="single"` | |
| Provider segmented (Google / ChatGPT 👑 / Grok 👑 / Gemini) | `ToggleGroup type="single"` | crown = `Crown` icon `text-warning`; dot màu hãng |
| Prompt card | `Card` + `Textarea` | header gồm label + Multi-Prompt |
| Multi-Prompt | `Switch` | |
| Chips (Nâng prompt / Thư viện / Chat AI / Import / Attach) | `Button variant="secondary" size="sm"` | "Nâng prompt" accent: `variant="outline"` + `text-primary border-primary/40` |
| Char count `0 / 4000` | `span text-muted-foreground font-mono` | |
| Nâng cao | `Button variant="ghost"` + `Collapsible` | chevron xoay 180° khi mở |
| Tạo | `Button` (primary) + `Sparkles`/`Play` + `kbd ⌘↵` | `shadow-btn-glow` |
| Model | `Select` | dot xanh trước tên model |
| Tỉ lệ (16:9 …) | custom `RatioPicker` from `ToggleGroup` | mini-rect vẽ `border` theo tỉ lệ |
| Số lượng | stepper: 2× `Button size="icon"` + số ở giữa | clamp 1–8 |
| Chế độ (Tuần tự / Song song) | `ToggleGroup type="single"` | |
| Phong cách | `Select` | Cinematic, Anime, 3D, … |
| Reference images | custom `Dropzone` + `Input` (search) + `Select` (filter "Tất cả") | paste Ctrl+V & drag-drop, max 10 |
| Advanced filename | `Input` prefix `/` suffix `.png` | `font-mono` |
| Advanced Tự tải / Chất lượng | `ToggleGroup type="single"` | |
| Recent grid | grid 4 cột + `AspectRatio 16/9` + `Card` | |
| Status bar (Tự tải / Tự thử lại) | `Checkbox` (shadcn) | màu bật = `text-success` |
| Status counters (Hàng đợi 0/20 / Đã tạo / Đã tải) | `span` + Lucide icon | `font-mono` |

---

## 6. Icon map (Lucide React)

| Prototype | Lucide | | Prototype | Lucide |
|---|---|---|---|---|
| sparkle | `Sparkles` | | search | `Search` |
| flow | `Workflow` | | upload | `Upload` |
| prompt | `MessageSquareText` | | bookmark | `Bookmark` |
| tasks | `ListTodo` | | download | `Download` |
| photo | `Images` | | bolt | `Zap` |
| snippet | `Code2` | | bell | `Bell` |
| history | `History` | | globe | `Globe` |
| log | `ScrollText` | | moon / sun | `Moon` / `Sun` |
| chev | `ChevronDown` | | doc | `FileText` |
| plus / minus | `Plus` / `Minus` | | user | `User` |
| image / video | `Image` / `Video` | | play / refresh | `Play` / `RefreshCw` |
| filter | `ListFilter` | | attach | `Paperclip` |
| folder | `Folder` | | crown | `Crown` |
| wand | `Wand2` | | style | `Palette` |
| check | `Check` | | settings | `Settings2` |

---

## 7. Responsive — Extension side panel

Side panel co-kéo liên tục, **viewport KHÔNG đại diện cho container**. Quy tắc:

- **Trên 680px** (`md:`): layout default, hero 44px, 4-cột Recent, top bar đầy đủ "50 credits · 2 jobs · Login".
- **480px – 680px** (`sm:`): tabs cuộn ngang, hero 34px, 3-cột Recent, ẩn "credits". Top bar gọn (giữ login text).
- **Dưới 480px** (vnarrow): hero 26px, 2-cột Recent, top bar **chỉ icon** (Đăng nhập + Dự án mới = icon-only), Multi-Prompt label viết tắt, status bar wrap xuống.

Triển khai 2 cách:

1. **Tailwind responsive utilities** (`sm:`, `md:`) — đủ trong đa số case.
2. **`useContainerWidth` hook** (custom) — dùng `ResizeObserver` đo bề rộng container thật, áp `narrow/vnarrow` flags vào component. Bắt buộc khi style phụ thuộc container (vd: Recent grid cols, Top bar buttons collapse).

Hidden scrollbar trong `src/index.css`: class `.scrollbar-none`.

---

## 8. Vị trí file & migration

```
src/
  index.css                     ← tokens (shadcn + legacy aliases)
  styles/globals.css            ← (alias copy nếu shadcn CLI cần)
  ui/components/                ← shadcn primitives (button, card, tabs, …) — installs as needed
  components/ui/                ← (shadcn convention; có thể dùng alias trong tsconfig)
  features/gen/
    components/
      GenTab.tsx                ← layout 1 cột max-w-[860px], hero, settings strip
      PromptArea.tsx + PromptToolbar.tsx
      ProviderSelector.tsx
      ModelSelector / RatioSelector / QuantitySelector / StyleSelector
      RefImagePicker.tsx
      AutoDownloadRow.tsx       ← advanced (filename, auto-DL, quality)
      ResultTilesGrid.tsx       ← Recent strip
      RunControls.tsx           ← Tạo + Stop + run-mode
  pages/sidebar/
    TabRouter.tsx               ← header + tabs + project indicator + footer
    SidebarFooter.tsx           ← status bar dưới
docs/
  design-handoff/               ← bundle gốc từ Claude Design (HANDOFF.md, globals.css, tailwind.config.ts, prototype-*.jsx)
  features/00-design-system.md  ← FILE NÀY
```

### Khi sửa component có sẵn

1. Đọc tokens semantic trong [§1](#1-color-strategy--light--dark) — không hardcode hex / không thêm var mới.
2. Nếu file dùng legacy alias (`bg-bg-base` …) — OK, không bắt buộc migrate. Khi sửa "đáng kể" → đổi sang semantic theo bảng.
3. Hero / heading lớn → `font-display italic`.
4. Số liệu / kbd → `font-mono`.

---

## 9. Quy ước animation

- `animate-slide-up` — sheet bottom slide 0.3s ease-out.
- `animate-spin-slow` — loading spinner 2s linear infinite.
- `transition-colors` (default 150ms) — đủ cho hover state.
- KHÔNG dùng GSAP / Framer trừ khi có lý do chính đáng (giảm bundle).

---

## 10. Khi nào update file này

- Thêm token mới (color / radius / spacing / shadow) → ghi vào §1-4.
- Thêm component shadcn / Radix → bổ sung §5.
- Phát hiện font / icon thay thế phù hợp hơn → §2 / §6.
- Đổi responsive breakpoint → §7.

KHÔNG xoá entry cũ — gạch ngang + ghi deprecation note để biết lịch sử.
