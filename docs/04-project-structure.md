# 04 — Project Structure

## Cây thư mục đầy đủ

```
h2-flow/
├── public/
│   ├── icons/                          # 16/32/48/128 PNG
│   └── locales/                        # fallback i18n (optional)
├── src/
│   ├── background/                     # Service Worker
│   │   ├── index.ts                    # Entry point, register listeners
│   │   ├── api-proxy.ts                # apiRequest handler (CORS-free fetch)
│   │   ├── download-handler.ts         # chrome.downloads.download wrapper
│   │   ├── tab-manager.ts              # Mở/đóng/focus tab provider
│   │   ├── alarm-scheduler.ts          # Heartbeat, polling timers
│   │   └── cloudflare-detector.ts      # Detect CF challenge, broadcast toast
│   │
│   ├── content/                        # Content scripts
│   │   ├── flow.ts                     # labs.google/fx — submit prompt, watch tile
│   │   ├── slate-bridge.ts             # MAIN world bridge để type vào Slate.js
│   │   ├── chatgpt.ts                  # chatgpt.com — submit, capture image
│   │   ├── grok.ts                     # grok.com — submit, detect Cloudflare
│   │   ├── gemini.ts                   # gemini.google.com
│   │   └── oauth-bridge.ts             # labs.toby.vn/auth/google/success
│   │
│   ├── pages/                          # Mỗi page = 1 HTML entry
│   │   ├── sidebar/
│   │   │   ├── index.html              # sidebar.html
│   │   │   ├── main.tsx                # ReactDOM.render
│   │   │   ├── App.tsx                 # Root, route giữa các tab
│   │   │   └── TabRouter.tsx
│   │   ├── workflow-editor/
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   └── WorkflowEditorPage.tsx
│   │   ├── angles-editor/
│   │   ├── effects-editor/
│   │   └── settings/
│   │
│   ├── features/                       # Feature folders (vertical slices)
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginModal.tsx
│   │   │   │   ├── RegisterModal.tsx
│   │   │   │   ├── ForgotPasswordModal.tsx
│   │   │   │   └── UserDropdown.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   └── useGoogleOAuth.ts
│   │   │   ├── services/
│   │   │   │   └── AuthService.ts
│   │   │   └── store/
│   │   │       └── auth.store.ts
│   │   │
│   │   ├── generate/                   # Tab 1 — Generate
│   │   │   ├── components/
│   │   │   │   ├── GenTab.tsx
│   │   │   │   ├── PromptArea.tsx
│   │   │   │   ├── RefImagePicker.tsx
│   │   │   │   ├── MentionHelper.tsx
│   │   │   │   ├── ProviderSelector.tsx
│   │   │   │   ├── ModelSelector.tsx
│   │   │   │   ├── RatioSelector.tsx
│   │   │   │   └── RunControls.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useGeneration.ts
│   │   │   │   └── useRefImages.ts
│   │   │   └── store/
│   │   │       └── generate.store.ts
│   │   │
│   │   ├── multi-task/                 # Tab 2
│   │   │   ├── components/
│   │   │   │   ├── MultiTaskTab.tsx
│   │   │   │   ├── TaskList.tsx
│   │   │   │   ├── TaskCard.tsx
│   │   │   │   └── TaskModal.tsx
│   │   │   └── hooks/
│   │   │
│   │   ├── workflow/                   # Tab 3
│   │   │   ├── components/
│   │   │   │   ├── WorkflowTab.tsx
│   │   │   │   ├── WorkflowList.tsx
│   │   │   │   ├── WorkflowCard.tsx
│   │   │   │   ├── editor/
│   │   │   │   │   ├── DiagramCanvas.tsx        # React Flow wrapper
│   │   │   │   │   ├── NodePalette.tsx
│   │   │   │   │   ├── NodeInspector.tsx
│   │   │   │   │   └── nodes/
│   │   │   │   │       ├── GenerateNode.tsx
│   │   │   │   │       ├── ChatGPTNode.tsx
│   │   │   │   │       ├── GrokNode.tsx
│   │   │   │   │       ├── PromptNode.tsx
│   │   │   │   │       ├── TextNode.tsx
│   │   │   │   │       ├── ImageNode.tsx
│   │   │   │   │       ├── TransformNode.tsx
│   │   │   │   │       ├── ConditionNode.tsx
│   │   │   │   │       ├── MergeNode.tsx
│   │   │   │   │       ├── DelayNode.tsx
│   │   │   │   │       ├── DownloadNode.tsx
│   │   │   │   │       ├── TelegramNode.tsx
│   │   │   │   │       ├── NoteNode.tsx
│   │   │   │   │       └── OutputNode.tsx
│   │   │   │   ├── ShareWorkflowModal.tsx
│   │   │   │   ├── SaveTemplateModal.tsx
│   │   │   │   └── WorkflowHistory.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useWorkflow.ts
│   │   │   │   ├── useWorkflowExecution.ts
│   │   │   │   └── useNodeExecution.ts
│   │   │   ├── engine/
│   │   │   │   ├── WorkflowExecutor.ts         # Core executor
│   │   │   │   ├── topological-sort.ts
│   │   │   │   ├── port-compat.ts              # PORT_TYPES, PORT_COMPAT
│   │   │   │   ├── running-flag.ts             # Web Locks + heartbeat
│   │   │   │   └── node-runners/
│   │   │   │       ├── generate.runner.ts
│   │   │   │       ├── chatgpt.runner.ts
│   │   │   │       ├── grok.runner.ts
│   │   │   │       ├── prompt.runner.ts
│   │   │   │       ├── download.runner.ts
│   │   │   │       ├── telegram.runner.ts
│   │   │   │       ├── delay.runner.ts
│   │   │   │       ├── condition.runner.ts
│   │   │   │       └── merge.runner.ts
│   │   │   └── templates/                       # NodeTemplates
│   │   │       ├── node-meta.ts
│   │   │       └── port-meta.ts
│   │   │
│   │   ├── photos/
│   │   ├── history/
│   │   ├── logs/
│   │   ├── albums/
│   │   ├── snippets/
│   │   ├── templates/
│   │   ├── settings/
│   │   ├── notifications/
│   │   ├── billing/                    # Plans, VietQR, tip, referral
│   │   ├── capture/                    # Screen Capture
│   │   ├── angles/                     # Angles Editor (popup)
│   │   └── effects/                    # Effects Editor (popup)
│   │
│   ├── providers/                      # AI Provider Adapters
│   │   ├── AIProviderAdapter.ts        # Abstract base
│   │   ├── ProviderRegistry.ts
│   │   ├── ProviderTabLock.ts
│   │   ├── FlowAdapter.ts
│   │   ├── ChatGPTAdapter.ts
│   │   ├── GrokAdapter.ts
│   │   ├── GeminiAdapter.ts
│   │   └── sessions/
│   │       ├── FlowSession.ts          # tRPC tile resolution
│   │       ├── ChatGPTSession.ts
│   │       ├── GrokSession.ts
│   │       └── GeminiSession.ts
│   │
│   ├── core/                           # Domain services framework-free
│   │   ├── ExecutionGate.ts            # Server-authoritative quota
│   │   ├── ExecutionLock.ts            # Local single-runner lock
│   │   ├── ExecutionTracker.ts         # Cross-window UI tracker
│   │   ├── FeatureGate.ts              # Entitlements cache + check
│   │   ├── ModelRegistry.ts            # Models from /provider-models
│   │   ├── ProviderConfigManager.ts    # /providers/api-configs + dom-selectors
│   │   ├── ProviderMeta.ts             # /providers metadata
│   │   ├── SystemConfig.ts             # /system-settings/public
│   │   ├── ExecutionConfig.ts          # /system-config/execution
│   │   ├── ValidationRules.ts          # /validation-rules
│   │   ├── ConfigVersionPoller.ts      # Poll /config/version
│   │   ├── LocationCache.ts            # /location/me (IP → country/currency)
│   │   ├── TrialGate.ts                # Server-side trial detection
│   │   ├── AnnouncementManager.ts      # /announcement
│   │   ├── NotificationManager.ts      # Webhook + telegram notify
│   │   ├── ServerHealthCheck.ts        # /health probe
│   │   ├── EventBus.ts                 # Pub/sub
│   │   ├── IdGenerator.ts              # UUID / nanoid wrappers
│   │   ├── RetryHelper.ts              # Exponential backoff
│   │   ├── RequestCoalescer.ts         # Dedupe concurrent calls
│   │   └── MentionParser.ts            # Parse @ref in prompts
│   │
│   ├── realtime/                       # SSE / Mercure / Polling
│   │   ├── SseClient.ts                # 3 transport switching
│   │   ├── SseBroadcastManager.ts      # Leader-follower election
│   │   ├── MercureClient.ts
│   │   ├── PollingClient.ts
│   │   └── event-handlers.ts           # Map server event → action
│   │
│   ├── storage/                        # IndexedDB + chrome.storage
│   │   ├── db.ts                       # Dexie instance
│   │   ├── stores/
│   │   │   ├── AlbumStore.ts
│   │   │   ├── ImageStore.ts
│   │   │   ├── PendingUploadStore.ts
│   │   │   ├── ThumbnailCache.ts
│   │   │   ├── TileCache.ts
│   │   │   └── BlobUrlManager.ts
│   │   ├── chrome-storage.ts           # Typed wrapper
│   │   ├── settings-sync.ts            # 2-tier sync map
│   │   └── migrations/
│   │       ├── v1-to-v2.ts
│   │       ├── v2-to-v3.ts
│   │       └── v3-to-v4.ts
│   │
│   ├── api/                            # HTTP client
│   │   ├── client.ts                   # ky instance + hooks
│   │   ├── request-signer.ts           # HMAC headers
│   │   ├── endpoints/
│   │   │   ├── auth.ts
│   │   │   ├── workflows.ts
│   │   │   ├── albums.ts
│   │   │   ├── execution.ts
│   │   │   ├── entitlements.ts
│   │   │   ├── plans.ts
│   │   │   ├── orders.ts
│   │   │   ├── referral.ts
│   │   │   └── ...
│   │   └── errors.ts                   # ApiError class + handler
│   │
│   ├── ui/                             # Shared UI primitives
│   │   ├── components/                 # shadcn/ui components
│   │   │   ├── Button.tsx
│   │   │   ├── Dialog.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Tabs.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   └── ...
│   │   ├── theme/
│   │   │   ├── tokens.ts               # Design tokens
│   │   │   ├── ThemeProvider.tsx
│   │   │   └── useTheme.ts
│   │   └── icons/                      # Custom SVG icons (brand logos)
│   │
│   ├── shared/                         # Cross-feature utilities
│   │   ├── modals/
│   │   │   ├── CustomDialog.tsx
│   │   │   ├── ImagePickerModal.tsx
│   │   │   ├── StyleSelectModal.tsx
│   │   │   └── PlanContentRenderer.tsx
│   │   ├── helpers/
│   │   │   ├── DownloadHelper.ts
│   │   │   ├── ProjectHelper.ts
│   │   │   ├── WorkflowExportHelper.ts
│   │   │   └── DomSelectorHelper.ts
│   │   └── overlays/
│   │       ├── OfflineOverlay.tsx
│   │       ├── CloneDetectedOverlay.tsx
│   │       └── ConnectingOverlay.tsx
│   │
│   ├── i18n/
│   │   ├── config.ts                   # i18next init
│   │   ├── loading-i18n.ts             # Mini i18n trước khi i18next load
│   │   ├── clone-detected-i18n.ts
│   │   └── locales/                    # Local fallback (vi/en/th/ja)
│   │       ├── vi.json
│   │       ├── en.json
│   │       ├── th.json
│   │       └── ja.json
│   │
│   ├── types/                          # Shared TypeScript types
│   │   ├── workflow.types.ts
│   │   ├── node.types.ts
│   │   ├── user.types.ts
│   │   ├── plan.types.ts
│   │   ├── api.types.ts
│   │   ├── sse.types.ts
│   │   └── messages.types.ts           # chrome.runtime message types
│   │
│   └── utils/
│       ├── cn.ts                       # clsx + tailwind-merge
│       ├── format.ts                   # Date, number, currency
│       ├── debounce.ts
│       ├── chrome-message.ts           # Typed sendMessage
│       └── broadcast-channel.ts        # Typed BroadcastChannel wrapper
│
├── sidebar.html                        # Entry HTML
├── workflow-editor.html
├── angles-editor.html
├── effects-editor.html
├── settings.html
│
├── docs/                               # Tài liệu này
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                            # Playwright
│
├── .env.example
├── .env.local                          # API_BASE_URL, etc.
├── manifest.config.ts
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── eslint.config.js
├── prettier.config.js
└── package.json
```

---

## Naming convention

| Element                       | Convention                 | Ví dụ                                  |
| ----------------------------- | -------------------------- | -------------------------------------- |
| File component                | PascalCase.tsx             | `GenerateNode.tsx`                     |
| File hook                     | camelCase prefix `use`     | `useWorkflow.ts`                       |
| File service/store            | PascalCase + suffix        | `AuthService.ts`, `auth.store.ts`      |
| File type                     | kebab-case + `.types.ts`   | `workflow.types.ts`                    |
| Folder feature                | kebab-case                 | `multi-task/`                          |
| Component                     | PascalCase                 | `<WorkflowCard />`                     |
| Hook                          | camelCase + `use`          | `useExecution`                         |
| Type/Interface                | PascalCase                 | `Workflow`, `Node`                     |
| Enum                          | PascalCase + suffix `Type` | `NodeType`, `PortType`                 |
| Const                         | SCREAMING_SNAKE            | `MAX_REF_IMAGES`                       |
| chrome.storage key            | snake*case + prefix `af*`  | `af_auth`, `af_settings`               |
| Event bus event               | colon-separated            | `workflow:started`, `node:phase`       |
| chrome.runtime message action | camelCase                  | `apiRequest`, `workflowExecutionEvent` |

---

## File header template

Mọi file `.ts/.tsx` MUST có header:

```ts
/**
 * <FileName> — <One-line purpose>
 *
 * Layer: <UI | Hook | Service | Adapter | Infra | Storage>
 * Owner: <feature folder>
 *
 * Depends on:
 *   - @/core/ExecutionGate
 *   - @/api/endpoints/workflows
 *
 * Used by:
 *   - features/workflow/WorkflowTab.tsx
 */
```

---

## Import order (ESLint enforce)

```ts
// 1. External
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

// 2. Internal absolute (@/)
import { Workflow } from "@/types/workflow.types";
import { useWorkflowStore } from "@/features/workflow/store/workflow.store";

// 3. Internal relative
import { NodeCard } from "../components/NodeCard";

// 4. Styles
import styles from "./WorkflowTab.module.css";

// 5. Type-only imports last
import type { NodeType } from "@/types/node.types";
```

---

## Forbidden patterns

- ❌ `any` (use `unknown` + narrow)
- ❌ Default export (trừ page entry và lazy-loaded)
- ❌ `useEffect` không có cleanup return
- ❌ Mutate state trực tiếp (dùng Immer)
- ❌ `fetch()` raw — dùng `apiClient`
- ❌ Hard-code URL — dùng `@/api/endpoints/*`
- ❌ Hard-code feature flag — dùng `useFeatureGate('xxx')`
- ❌ Hard-code model list — fetch `ModelRegistry`
- ❌ Hard-code DOM selector của provider — fetch `ProviderConfigManager`
- ❌ Inline `<style>` trong JSX — dùng Tailwind class
- ❌ console.log production — dùng `logger.debug` (tree-shake khi build)
