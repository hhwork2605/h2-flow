# 03 — Tech Stack

## Quyết định stack (1 trang)

| Layer | Chọn | Lý do |
|---|---|---|
| Language | **TypeScript 5.x** strict | Type-safe across 4 execution contexts |
| Framework UI | **React 18** | Ecosystem mạnh, gen UI dễ với v0/Lovable |
| Build | **Vite 5 + @crxjs/vite-plugin v2** | HMR cho extension, output đúng MV3 |
| State | **Zustand 4** + **Immer** | Đơn giản, persist được, dễ test |
| Data fetching | **TanStack Query 5** | Cache + retry + SSE-aware |
| Schema validation | **Zod 3** | Validate API response, form |
| Form | **React Hook Form** | Performant |
| Style | **Tailwind 3** + **CSS Modules** cho legacy | Match design tokens TobyFlow |
| UI primitives | **shadcn/ui** (Radix UI) | Accessible, customize tốt |
| Icons | **Lucide React** | Cùng style với bản gốc |
| Workflow editor | **React Flow 11** | Thay Drawflow, React-native, type-safe |
| IndexedDB | **Dexie 4** | Wrapper Promise-based |
| Crypto | **WebCrypto API** + **js-sha256** | HMAC cho RequestSigner |
| i18n | **i18next** + **react-i18next** | Server-side translation load |
| Date | **date-fns 3** | Tree-shakeable |
| HTTP | **ky** (wrapper fetch) | Retry built-in, hooks |
| Test | **Vitest** + **Testing Library** + **Playwright** (E2E) | |
| Lint | **ESLint** + **Prettier** + **@typescript-eslint** | |

---

## 1. Package.json mẫu

```json
{
  "name": "tobyflow-clone",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,md}\""
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-popover": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@tanstack/react-query": "^5.40.0",
    "clsx": "^2.1.0",
    "date-fns": "^3.6.0",
    "dexie": "^4.0.0",
    "dexie-react-hooks": "^1.1.7",
    "i18next": "^23.11.0",
    "i18next-http-backend": "^2.5.0",
    "immer": "^10.1.0",
    "js-sha256": "^0.11.0",
    "ky": "^1.4.0",
    "lucide-react": "^0.395.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-hook-form": "^7.52.0",
    "react-i18next": "^14.1.0",
    "reactflow": "^11.11.0",
    "tailwind-merge": "^2.3.0",
    "zod": "^3.23.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.25",
    "@playwright/test": "^1.45.0",
    "@testing-library/react": "^16.0.0",
    "@types/chrome": "^0.0.268",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@typescript-eslint/eslint-plugin": "^7.13.0",
    "@typescript-eslint/parser": "^7.13.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "eslint": "^8.57.0",
    "eslint-plugin-react": "^7.34.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "jsdom": "^24.1.0",
    "postcss": "^8.4.39",
    "prettier": "^3.3.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.3.0",
    "vitest": "^1.6.0"
  }
}
```

---

## 2. Vite config (CRXJS — manifest V3)

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
import path from 'path';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        sidebar: 'sidebar.html',
        workflowEditor: 'workflow-editor.html',
        anglesEditor: 'angles-editor.html',
        effectsEditor: 'effects-editor.html',
        settings: 'settings.html',
      },
    },
  },
  server: { port: 5173 },
});
```

`manifest.config.ts`:
```ts
import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'TobyFlow Clone',
  short_name: 'TF',
  version: pkg.version,
  description: 'Auto Flow — workflow AI image/video automation',
  icons: {
    16: 'public/icons/icon-16.png',
    32: 'public/icons/icon-32.png',
    48: 'public/icons/icon-48.png',
    128: 'public/icons/icon-128.png',
  },
  permissions: [
    'activeTab', 'storage', 'unlimitedStorage', 'sidePanel',
    'scripting', 'tabs', 'downloads', 'notifications', 'alarms',
  ],
  host_permissions: [
    'https://labs.google/*',
    '*://chatgpt.com/*',
    '*://gemini.google.com/*',
    'https://grok.com/*',
    'https://*.grok.com/*',
    '*://your-backend.example.com/*',
  ],
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'sidebar.html' },
  content_scripts: [
    { matches: ['https://labs.google/fx/*'], js: ['src/content/flow.ts'], run_at: 'document_idle' },
    { matches: ['https://labs.google/fx/*'], js: ['src/content/slate-bridge.ts'], world: 'MAIN' },
    { matches: ['*://chatgpt.com/*'], js: ['src/content/chatgpt.ts'], run_at: 'document_idle' },
    { matches: ['https://grok.com/*', 'https://*.grok.com/*'], js: ['src/content/grok.ts'], run_at: 'document_idle' },
    { matches: ['*://gemini.google.com/*'], js: ['src/content/gemini.ts'], run_at: 'document_idle' },
  ],
  commands: {
    generate: { suggested_key: { default: 'Alt+G' }, description: 'Generate with current prompt' },
    'toggle-sidebar': { suggested_key: { default: 'Alt+S' }, description: 'Toggle sidebar' },
  },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';",
  },
  web_accessible_resources: [{
    matches: ['https://labs.google/*'],
    resources: ['sidebar.html', 'workflow-editor.html', 'angles-editor.html', 'effects-editor.html', 'settings.html', 'assets/*'],
  }],
});
```

---

## 3. TypeScript config

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "allowImportingTsExtensions": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["chrome", "vite/client", "vitest/globals"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*", "vite.config.ts"]
}
```

---

## 4. Tailwind config (design tokens TobyFlow)

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './sidebar.html', './workflow-editor.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand
        brand: { 50: '#eef4ff', 500: '#3186FF', 700: '#1d5dd8' },

        // Node colors (workflow editor)
        node: {
          generate: '#9177e1',
          download: '#3b82f6',
          chatgpt: '#10a37f',
          grok: '#1d9bf0',
          prompt: '#9177e1',
          delay: '#71717a',
          telegram: '#26A5E4',
        },

        // Port type colors
        port: {
          text:  '#9177e1',
          image: '#3b82f6',
          video: '#a855f7',
          any:   '#71717a',
          frame: '#14b8a6',
        },

        // Status colors
        status: {
          pending: '#71717a',
          running: '#3b82f6',
          completed: '#10b981',
          failed: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        'slide-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        'spin-slow': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
        'spin-slow': 'spin-slow 2s linear infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('tailwindcss-animate')],
} satisfies Config;
```

---

## 5. Lý do chọn các thư viện then chốt

### Vite + CRXJS (thay vì webpack)
- HMR cho extension MV3 (cực khó với webpack)
- CRXJS handle hot-reload content scripts khi save
- Manifest type-safe + linked với entry points

### Zustand (thay vì Redux)
- Boilerplate ít, không cần Provider
- Persist middleware → sync `chrome.storage.local` dễ
- Cross-context: 1 store cho mỗi context (sidebar/popup) + sync qua chrome.storage `onChanged`

### TanStack Query (thay vì SWR)
- Mutation + invalidation built-in
- DevTools tốt
- Plug vào SSE: SSE fire event → `queryClient.invalidateQueries`

### React Flow (thay vì Drawflow)
- React-native, TypeScript first
- Built-in zoom, pan, snap, minimap
- Custom node component dễ
- Drawflow là vanilla JS, không có TS types, khó tích hợp React

### Dexie (thay vì raw IndexedDB)
- Promise API
- Hooks `useLiveQuery` cho React
- Migration system tốt (DB version 4 → cần migration)

### ky (thay vì axios / fetch raw)
- Built-in retry + timeout
- Hooks beforeRequest/afterResponse (chèn HMAC signing)
- Nhỏ hơn axios

### i18next (thay vì react-intl)
- Backend HTTP load → match `GET /i18n/{locale}`
- Namespace + interpolation tốt
- Fallback chain dễ config

### shadcn/ui (thay vì MUI / Chakra)
- Copy-paste vào project, không phải dependency
- Tailwind native → customize design tokens dễ
- Radix primitives → accessibility tốt

---

## 6. Compatibility note

| Browser | Hỗ trợ |
|---|---|
| Chrome 120+ | ✅ Full (Side Panel API, Web Locks, BroadcastChannel) |
| Edge 120+ | ✅ Full |
| Brave 1.60+ | ✅ Full |
| Opera (Chromium) | ⚠️ Side Panel có thể khác |
| Firefox | ❌ Side Panel API khác → cần adapter |
| Safari | ❌ Manifest V3 + side_panel chưa support |

Tập trung Chrome + Edge cho MVP.

---

## 7. Bundle size target

| Asset | Target gzip |
|---|---|
| sidebar.js | < 200KB |
| workflow-editor.js | < 300KB |
| background.js | < 50KB |
| Mỗi content script | < 30KB |
| Vendor (React, ReactFlow, etc.) | < 250KB shared chunk |

Dùng `rollup-plugin-visualizer` để check.
