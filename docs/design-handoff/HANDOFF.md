# h2-flow — Design System Handoff

Mục tiêu: đưa file này + `globals.css` + `tailwind.config.ts` vào **Claude Code** để dựng lại UI bằng **React 18 + TypeScript + Tailwind 3 + shadcn/ui + Lucide React** (stack trong `03-tech-stack.md`).

Prototype tham chiếu: `index.html` (React inline-style, chỉ để xem layout & hành vi). **Không port inline-style** — chuyển sang Tailwind + shadcn theo bảng dưới.

---

## 1. Chiến lược màu

| Mode | Nền | Accent (primary) | Kích hoạt |
|---|---|---|---|
| **Light** | warm / cream `#f1ede4` | **coral** `#de6b4a` | mặc định |
| **Dark** | near-black `#0c0c10` | **violet** `#9177e1` | thêm class `.dark` lên `<html>` |

- Token nằm trong `globals.css` theo **đúng contract shadcn** (`--background`, `--primary`, `--card`, `--border`, `--ring`…). shadcn component chạy ngay không cần sửa.
- Violet `#9177e1` = chính là `node.generate`/`node.prompt` có sẵn → không phá hệ thống diagram.
- `node.*`, `port.*`, `status.*` giữ **cố định** (không đổi theo mode) — chúng là màu ngữ nghĩa của workflow editor.
- Coral & violet còn được expose dạng palette cố định `coral-*`, `violet-*` khi cần một hue bất kể mode.

Toggle theme: set/remove `.dark` trên `documentElement` (Zustand persist hoặc `prefers-color-scheme`).

---

## 2. Type scale

| Token | Dùng cho | Font |
|---|---|---|
| `text-hero` (44px, italic) | tiêu đề lớn "Hãy tạo một thứ gì đó đẹp" | `font-display` (Playfair Display — hỗ trợ tiếng Việt) |
| `text-section` (20px, italic) | heading khu ("Gần đây") | `font-display` |
| `text-input` (16px) | nội dung textarea prompt | `font-sans` |
| `text-body` (13px) | nội dung UI mặc định | `font-sans` |
| `text-meta` (12px) | nhãn nhỏ, chip | `font-sans` |
| `text-label` (11.5px) | nhãn setting | `font-sans` |
| `text-eyebrow` (11px, UPPERCASE, tracking) | "STUDIO · GENERATE" | `font-sans` |
| số liệu / filename / counter | status bar, char count | `font-mono` (JetBrains Mono) |

Fonts: load `Inter`, `Playfair Display`, `JetBrains Mono` (@fontsource hoặc `<link>` Google Fonts). Lưu ý chọn font display **có subset Vietnamese** — Playfair Display đủ dấu; tránh Instrument Serif (thiếu dấu thanh tiếng Việt).

---

## 3. Radius & elevation

- `rounded` (10px) → button, input, chip, segmented
- `rounded-sm` (6px) → ô con bên trong segmented / checkbox
- `rounded-lg` (14px) → card (reference images, advanced, status panel)
- `rounded-xl` (18px) → prompt card
- `shadow-card` / `shadow-card-dark` → card nổi
- `shadow-btn-glow` → nút primary (Tạo, Dự án mới)

## 4. Spacing nhịp chính
Gap hay dùng: `gap-1.5` (6), `gap-2` (8), `gap-2.5` (10), `gap-3` (12), `gap-3.5` (14). Cột chính `max-w-[860px]`, khoảng cách khối `gap-[22px]` (`gap-5.5`). Padding ngoài `px-7` (28).

---

## 5. Component inventory → shadcn / Radix

| Trong prototype | Map sang | Ghi chú |
|---|---|---|
| Top bar | custom `<AppHeader/>` | nút icon = `Button variant="ghost" size="icon"` + `Tooltip`; logo dùng `bg-primary text-primary-foreground` |
| Nút **Đăng nhập** | `Button` (nền `foreground`, chữ `background`) hoặc `variant="default"` | |
| Tabs (Gen/Workflow/Prompts/Tasks/Photos/Snippets/Lịch sử/Logs) | **`Tabs`** (Radix) hoặc nav `Button variant="ghost"` + state active | active = `bg-card border` |
| **Project switcher** (chip "Dự án: Mặc định ⌄") | **`DropdownMenu`**, trigger = `Button variant="outline"` | list project + "Tạo dự án" |
| **Dự án mới** | `Button` (primary) + icon `Plus` | |
| Kind toggle (Ảnh/Video) | **`ToggleGroup type="single"`** | |
| Provider segmented (Google/ChatGPT 👑/Grok 👑/Gemini) | **`ToggleGroup type="single"`** | crown = `Crown` icon màu `warning`; mục có dot màu hãng |
| Prompt card | **`Card`** + **`Textarea`** | header card chứa label + Multi-Prompt |
| **Multi-Prompt** | **`Switch`** | |
| Chips (Nâng prompt / Thư viện / Chat AI / Import / 📎) | `Button variant="secondary" size="sm"` | "Nâng prompt" = nhấn accent (`variant="outline"` + `text-primary border-primary/40`) |
| Char count `0 / 4000` | `span text-muted-foreground font-mono` | |
| **Nâng cao** | `Button variant="ghost"` + **`Collapsible`** | chevron xoay 180° khi mở |
| **Tạo** | `Button` (primary) + `Sparkles`/`Play` + kbd `⌘↵` | `shadow-btn-glow` |
| Model | **`Select`** | dot xanh trước tên model |
| **Tỉ lệ** (16:9…) | custom `RatioPicker` (dựng từ `ToggleGroup`) | mini-rect vẽ bằng `border` theo tỉ lệ |
| **Số lượng** | stepper: 2×`Button size="icon"` + số ở giữa | clamp 1–8 |
| Chế độ (Tuần tự/Song song) | `ToggleGroup type="single"` | |
| Phong cách | `Select` (Cinematic, Anime, 3D, …) | |
| Reference images | custom `Dropzone` + `Input` (search) + `Select` (filter "Tất cả") | hỗ trợ dán Ctrl+V & drag-drop, max 10 |
| Advanced: filename | `Input` có prefix `/` + suffix `.png` | dùng `font-mono` |
| Advanced: Tự động tải / Chất lượng | `ToggleGroup type="single"` | |
| Recent grid | grid 4 cột + **`AspectRatio` 16/9** + `Card` | |
| Status bar (Tự tải / Tự thử lại) | `Checkbox` (shadcn) | màu bật = `success` |
| Status counters (Hàng đợi 0/20, Đã tạo, Đã tải) | `span` + Lucide `Zap`/`Image`/`Download` | font-mono |

---

## 6. Icon map (Lucide React)

`sparkle→Sparkles` · `flow→Workflow` · `prompt→MessageSquareText` · `tasks→ListTodo` · `photo→Images` · `snippet→Code2` · `history→History` · `log→ScrollText` · `chev→ChevronDown` · `plus→Plus` · `minus→Minus` · `search→Search` · `upload→Upload` · `bookmark→Bookmark` · `download→Download` · `bolt→Zap` · `bell→Bell` · `globe→Globe` · `moon→Moon` · `sun→Sun` · `doc→FileText` · `user→User` · `image→Image` · `video→Video` · `play→Play` · `refresh→RefreshCw` · `filter→ListFilter` · `attach→Paperclip` · `folder→Folder` · `crown→Crown` · `wand→Wand2` · `style→Palette` · `check→Check`

---

## 7. Gợi ý cấu trúc thư mục

```
src/
  styles/globals.css            ← từ handoff
  components/ui/                ← shadcn (button, card, tabs, select, switch, toggle-group, …)
  features/gen/
    GenView.tsx                 ← layout cột chính (= StudioApp)
    PromptCard.tsx
    SettingsStrip.tsx
    ReferenceImages.tsx
    AdvancedDrawer.tsx
    RecentStrip.tsx
  components/layout/
    AppHeader.tsx
    WorkspaceTabs.tsx
    ProjectSwitcher.tsx
    StatusBar.tsx
  components/controls/
    RatioPicker.tsx
    CountStepper.tsx
    ProviderToggle.tsx
```

State (Zustand): `provider, kind, ratio, count, mode, style, multiPrompt, advancedOpen, autoDownload, autoRetry, fileName, quality, referenceImages[]`.

---

## 8. Prompt gợi ý cho Claude Code

> "Dựng feature Gen theo `HANDOFF.md`. Cài shadcn/ui (button, card, tabs, select, switch, toggle-group, dropdown-menu, collapsible, checkbox, tooltip, aspect-ratio, textarea, input). Dùng token màu trong `globals.css` (light=coral, dark=violet) — không hardcode hex trong component, chỉ dùng class semantic (`bg-card`, `text-muted-foreground`, `border`, `bg-primary`…). Map component theo bảng mục 5, icon theo mục 6. Layout 1 cột `max-w-[860px]` căn giữa. Tham chiếu hành vi từ prototype `index.html`."
