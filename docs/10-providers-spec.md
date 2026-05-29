# 10 — Providers Spec

## 1. Abstract base

```ts
// src/providers/AIProviderAdapter.ts

export interface ProviderCapabilities {
  supportsRatio: boolean;
  supportsQuantity: boolean;
  supportsVideo: boolean;
  supportsRefImage: boolean;
  supportsAutoDownload: boolean;
  supportsHumanized: boolean;
  maxRefImages: number;
}

export interface EnsureReadyResult {
  ready: boolean;
  tabId?: number;
  error?: string;
}

export interface SubmitParams {
  prompt: string;
  ratio?: string;
  quantity?: number;
  duration?: string;
  refFileIds?: string[];
  refThumbnails?: Record<string, ResultDetail>;
  model?: string;
  media_type?: 'Image' | 'Video';
  signal?: AbortSignal;
}

export interface SubmitResult {
  fileIds: string[];
  thumbnails: Record<string, ResultDetail>;
  fileNames: Record<string, string>;
  providerUrls?: Record<string, string>;
  duration: number;
}

export abstract class AIProviderAdapter {
  abstract key: string;          // 'flow' | 'chatgpt' | 'grok' | 'gemini'
  abstract displayName: string;
  abstract featureKey: string;   // FeatureGate key
  abstract executionAction: string; // ExecutionGate action

  abstract get capabilities(): ProviderCapabilities;

  abstract ensureReady(): Promise<EnsureReadyResult>;
  abstract submit(params: SubmitParams): Promise<SubmitResult>;
  abstract uploadRef(blob: Blob, filename?: string): Promise<{ file_name: string; thumbnail_url?: string }>;

  async cancel(): Promise<void> { /* optional */ }
  async getPromptPrefix(): Promise<string> { return ''; }

  isEnabled(): boolean {
    try {
      return !!FeatureGate.canUse(this.featureKey);
    } catch {
      return true; // fallback an toàn khi FeatureGate chưa load
    }
  }
}
```

---

## 2. FlowAdapter (labs.google/fx)

### 2.1 Đặc điểm
- **Host**: `https://labs.google/fx/...`
- **Tech**: Slate.js editor + tRPC API
- **Identity**: tile UUID bền (file_name) — re-fetchable sau reload page
- **Content script**: 2 file
  - `content/flow.ts` (isolated world) — orchestrate DOM
  - `content/slate-bridge.ts` (MAIN world) — type vào Slate editor

### 2.2 Flow

```
ensureReady():
  1. Check có tab labs.google/fx/<project_id>/* mở chưa
     - Yes → return { ready: true, tabId }
     - No  → chrome.tabs.create({ url: project_url, active: false }) → wait until 'document_idle' message
  2. ProviderTabLock.acquire(tabId)
  3. Verify content script handshake (chrome.tabs.sendMessage(tabId, 'flow:ping'))

submit(params):
  1. emitPhase('sending')
  2. chrome.tabs.sendMessage(tabId, { action: 'flow:submit', params })
  3. content script:
     - slate-bridge.typeText(prompt)
     - Upload refs via tRPC (uploadRef)
     - Set ratio, model, quantity via DOM dropdown clicks
     - Click "Generate" button
  4. emitPhase('generating')
  5. TileMonitor watches DOM: <img src="...getMediaUrlRedirect?name=UUID">
     - Extract file_name từ ?name= hoặc ?input=
     - When N tiles appear → resolve
  6. emitPhase('downloading')
  7. FlowSession.fetchTileDetails(file_names, project_id)
     → POST /flow/tile-resolve (backend proxy tRPC)
     → return thumbnails + provider_urls
  8. ProviderTabLock.release(tabId)
  9. return { fileIds: file_names, thumbnails, fileNames, providerUrls, duration }

uploadRef(blob):
  1. Build FormData with file
  2. POST tRPC `media.uploadFile` via fetch trong content script context (CORS)
  3. Parse response → return file_name
```

### 2.3 Capabilities
```ts
{
  supportsRatio: true,         // 16:9, 1:1, 9:16, 4:3, 3:4
  supportsQuantity: true,      // 1-4
  supportsVideo: true,         // Veo models
  supportsRefImage: true,      // max 10 image, 3 video frames
  supportsAutoDownload: true,
  supportsHumanized: false,
  maxRefImages: 10,
}
```

### 2.4 Models (fetched từ /provider-models)
- Image: `imagen-3`, `imagen-3-fast`, `imagen-4`
- Video: `veo-2`, `veo-2-fast`

### 2.5 Error handling

| Error pattern | Code | Action |
|---|---|---|
| DOM selector miss | `SELECTOR_NOT_FOUND` | Report to `/analytics/selector-failure`, retry once |
| Tile không xuất hiện sau timeout | `TILE_TIMEOUT` | Fail node, allow retry |
| "Content policy violation" toast | `CONTENT_BLOCKED` | Fail with provider:error event |
| 401 unauthorized | `FLOW_LOGIN_REQUIRED` | Show login overlay |

### 2.6 Project context
Flow tổ chức ảnh theo project. `_currentProjectId` được lưu để route đúng tab:
- User chọn project ở Project Indicator → switch tab
- Tile UUID gắn với project_id, không share giữa project khác

---

## 3. ChatGPTAdapter (chatgpt.com)

### 3.1 Đặc điểm
- **Host**: `https://chatgpt.com/*`
- **Tech**: React + tiptap editor + GraphQL conversations API
- **Identity**: **synthetic file_id** — ChatGPT trả CDN URL với token expires ~1h
- **Critical issue**: cần fetch ảnh ngay trước khi token expires

### 3.2 Flow

```
ensureReady():
  1. Tab chatgpt.com mở? → focus
  2. Login? Check `chrome.cookies.get(domain='chatgpt.com', name='__Secure-next-auth.session-token')`
     - No → emit 'chatgpt:login_required' event → show modal
  3. Verify model dropdown render OK

submit(params):
  1. emitPhase('sending')
  2. chrome.tabs.sendMessage(tabId, { action: 'chatgpt:submit', params })
  3. content script:
     - Set model via dropdown (gpt-4o / gpt-4o-mini / o1)
     - Insert prompt vào tiptap editor (textarea[data-id='root'] hoặc div[contenteditable])
     - Upload refs nếu có (drag-drop simulation hoặc paste)
     - Click send button
  4. emitPhase('generating')
  5. Watch DOM for <img class="generated-image" hoặc data-message-author="assistant"> containing img
  6. When image appears:
     - Extract CDN URL
     - emitPhase('downloading')
     - fetch(url, { credentials: 'include' }) → blob
     - Cache blob in ImageStore với synthetic_id = sha256(prompt + timestamp)
     - Compute thumbnail (50KB) + medium (1200px WebP)
  7. Optional: delete conversation nếu node.chatgpt_delete_after_gen
  8. return { fileIds: [synthetic_id], thumbnails, fileNames: {}, providerUrls: { synthetic_id: cdn_url } }
```

### 3.3 Capabilities
```ts
{
  supportsRatio: false,         // ChatGPT auto-determines
  supportsQuantity: false,      // luôn 1
  supportsVideo: false,
  supportsRefImage: true,       // max 4 (ChatGPT limit)
  supportsAutoDownload: true,
  supportsHumanized: true,      // có thể bật humanized mode
  maxRefImages: 4,
}
```

### 3.4 Bridge sang Flow
Nếu node sau là `generate` (Flow) cần dùng output ChatGPT làm ref:

```ts
// WorkflowExecutor._resolveCrossProviderRefs
const flowFileNames: string[] = [];
for (const externalId of upstreamFileIds) {
  if (externalId.startsWith('cgpt_') || externalId.startsWith('grok_')) {
    const blob = await getBlobFromCache(externalId);
    const { file_name } = await FlowAdapter.uploadRef(blob);
    flowFileNames.push(file_name);
  } else {
    flowFileNames.push(externalId); // already Flow UUID
  }
}
```

### 3.5 Error patterns

| Error | Code |
|---|---|
| "You've reached your plan limit" | `RATE_LIMIT` |
| "I can't help with that" / "policy" | `CONTENT_BLOCKED` |
| Trả text-only thay vì image | `TEXT_ONLY` |
| Image generation failed banner | `IMAGE_GEN_FAILED` |
| Subscription required (free user gen image) | `SUBSCRIPTION_REQUIRED` |

---

## 4. GrokAdapter (grok.com)

### 4.1 Đặc điểm
- **Host**: `https://grok.com/*`, `https://*.grok.com/*`
- **Tech**: React + custom editor
- **Special**: Cloudflare challenge protection
- **Modes**: image hoặc video

### 4.2 Flow

```
ensureReady():
  1. Tab grok.com mở?
  2. Login? (xAI cookie)
     - No → 'grok:login_required'
  3. Check subscription (paid Grok)
     - Image gen có thể free, video gen luôn paid
     - emit 'grok:subscription_required' nếu cần

submit(params):
  1. emitPhase('sending')
  2. Content script:
     - Set mode (image/video toggle)
     - For video: set duration + resolution
     - For image: set quality
     - Type prompt
     - Upload refs (max 3 cho Grok)
     - Click submit
  3. CLOUDFLARE CHECK loop:
     - Watch DOM cho element `[data-cloudflare-challenge]` hoặc text "Verify you are human"
     - Nếu detected → emit `cloudflare:challenge { phase: 'detected', elapsedSec: 0 }`
     - Poll mỗi 2s, increment elapsedSec
     - Sau 30s → escalate `phase: 'waiting'` urgent
     - Khi DOM challenge disappear → emit `phase: 'resolved'`
     - Sau 90s không pass → `phase: 'timeout'`, fail node
  4. emitPhase('generating')
  5. Watch response DOM cho image/video
  6. emitPhase('downloading')
  7. Fetch CDN blob → cache → return synthetic ID
```

### 4.3 Capabilities
```ts
{
  supportsRatio: false,
  supportsQuantity: false,
  supportsVideo: true,
  supportsRefImage: true,
  supportsAutoDownload: true,
  supportsHumanized: false,
  maxRefImages: 3,
}
```

### 4.4 Cloudflare handler (UI side)

```ts
// app.tsx hoặc shared overlay handler
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'cloudflare:challenge') {
    handleCloudflareToast(msg);
  }
});

function handleCloudflareToast(msg: {
  provider: string;
  phase: 'detected' | 'waiting' | 'resolved' | 'timeout';
  elapsedSec: number;
}) {
  switch (msg.phase) {
    case 'detected':
    case 'waiting':
      showPersistentToast({
        urgent: msg.elapsedSec >= 30,
        title: msg.elapsedSec >= 30
          ? `🛡️ Cloudflare ${msg.provider} — cần bạn click verify!`
          : `🛡️ Cloudflare ${msg.provider} challenge — đang chờ verify…`,
        subtitle: `Đã chờ ${msg.elapsedSec}s. Click vào tab để verify thủ công.`,
        action: { label: `Mở ${msg.provider}`, onClick: () => chrome.runtime.sendMessage({ action: 'provider:focusTab', tabId: ..., focusWindow: true }) }
      });
      break;
    case 'resolved':
      dismissPersistentToast();
      showToast(`✓ Cloudflare ${msg.provider} đã verify (${msg.elapsedSec}s)`, 'success');
      break;
    case 'timeout':
      dismissPersistentToast();
      showToast(`⚠️ Cloudflare ${msg.provider} verify timeout — thử lại`, 'error');
      break;
  }
}
```

---

## 5. GeminiAdapter (gemini.google.com)

### 5.1 Đặc điểm
- **Host**: `gemini.google.com`
- **Tech**: Angular-based UI
- **Status**: optional, gated theo plan (chỉ Team plan)

### 5.2 Flow tương tự ChatGPT nhưng dùng Gemini-specific selectors. Pattern giống.

---

## 6. ProviderRegistry

```ts
class ProviderRegistry {
  private static adapters = new Map<string, AIProviderAdapter>();
  private static initialized = false;

  static register(adapter: AIProviderAdapter) {
    this.adapters.set(adapter.key, adapter);
  }

  static get(key: string): AIProviderAdapter | undefined {
    return this.adapters.get(key) || this.adapters.get('flow');
  }

  static getAll(): AIProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  static getAvailable(): AIProviderAdapter[] {
    return this.getAll().filter((a) => {
      try { return a.isEnabled(); } catch { return false; }
    });
  }

  static bootstrap() {
    if (this.initialized) return;
    this.register(new FlowAdapter());
    this.register(new ChatGPTAdapter());
    this.register(new GrokAdapter());
    this.register(new GeminiAdapter());
    this.initialized = true;
  }
}

// Auto-bootstrap on app init
ProviderRegistry.bootstrap();
```

---

## 7. ProviderTabLock

Khi nhiều prompts cùng chạy parallel trên cùng 1 provider, chỉ 1 prompt được chạy trên 1 tab cùng lúc (vì DOM của Flow/ChatGPT/Grok không multiplex).

```ts
class ProviderTabLock {
  private static locks = new Map<number, { owner: string; acquiredAt: number }>();

  static async acquire(tabId: number, owner: string, timeoutMs = 60_000): Promise<void> {
    const start = Date.now();
    while (this.locks.has(tabId)) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`PROVIDER_TAB_LOCK_TIMEOUT: ${tabId}`);
      }
      await sleep(200);
    }
    this.locks.set(tabId, { owner, acquiredAt: Date.now() });
  }

  static release(tabId: number) {
    this.locks.delete(tabId);
  }

  static isLocked(tabId: number): boolean {
    return this.locks.has(tabId);
  }
}
```

---

## 8. Content script architecture

### 8.1 Isolated world + MAIN world

Vì các trang AI provider dùng modern frameworks (React/Slate/tiptap), DOM manipulation thông thường KHÔNG fire framework state updates. Cần `world: MAIN` để truy cập React fiber / Slate editor instance.

```ts
// content/slate-bridge.ts (world: MAIN)
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.from !== 'tobyflow-extension') return;

  if (event.data.action === 'typeIntoSlate') {
    const text = event.data.text;
    const editor = findSlateEditor();  // Walk DOM tree to find Slate.js editor instance
    if (!editor) return;
    Transforms.select(editor, { offset: 0, path: [0, 0] });
    Transforms.insertText(editor, text);
  }
});

function findSlateEditor() {
  // Walk React fiber tree để tìm Slate editor instance
  // ...
}
```

```ts
// content/flow.ts (isolated world)
function typePromptViaSlateBridge(text: string) {
  window.postMessage({ from: 'tobyflow-extension', action: 'typeIntoSlate', text }, '*');
}
```

### 8.2 Message protocol

```
Sidebar  ─sendMessage→  Background  ─tabs.sendMessage→  Content Script (isolated)
                                                                │
                                                                │ postMessage
                                                                ▼
                                                          MAIN world bridge
```

---

## 9. Provider config (server-driven DOM selectors)

DOM của provider thay đổi → admin update selector → client tự load lại:

```json
// GET /providers/dom-selectors response
{
  "selectors": {
    "chatgpt": {
      "prompt_input": "div[contenteditable='true'][data-virtualkeyboard='true']",
      "send_button": "button[data-testid='send-button']",
      "image_response": "div[data-message-author-role='assistant'] img",
      "model_dropdown": "button[aria-label='Model selector, GPT-4']",
      "model_options": "div[role='menuitem']",
      "stop_button": "button[aria-label='Stop generating']",
      "regenerate_button": "button[aria-label='Regenerate']"
    },
    "grok": {
      "prompt_input": "textarea.grok-input",
      "send_button": "button.send-btn",
      "mode_toggle": "button[data-mode]",
      "image_response": ".message-image",
      "cloudflare_indicator": "[data-cloudflare-challenge]"
    },
    "flow": {
      "ratio_dropdown": "...",
      "model_dropdown": "..."
    }
  }
}
```

Content script khi load → fetch selector qua sendMessage → cache local + use.

Nếu selector miss → POST `/analytics/selector-failure` với context → admin nhận alert.

---

## 10. Capabilities matrix (UI rendering)

UI dùng capabilities để render đúng controls:

| Control | Flow | ChatGPT | Grok | Gemini |
|---|---|---|---|---|
| Ratio dropdown | ✅ | ❌ | ❌ | ✅ |
| Quantity slider (1-4) | ✅ | ❌ | ❌ | ❌ |
| Video toggle | ✅ | ❌ | ✅ | ❌ |
| Ref images upload | ✅ (10) | ✅ (4) | ✅ (3) | ✅ (5) |
| Auto-download | ✅ | ✅ | ✅ | ✅ |
| Humanized | ❌ | ✅ | ❌ | ❌ |
| Model selector | ✅ | ✅ | ❌ | ✅ |
| Duration (video) | ✅ | ❌ | ✅ | ❌ |
| Resolution (video) | ✅ | ❌ | ✅ | ❌ |

Render code:
```tsx
function ProviderControls({ provider }: { provider: 'flow'|'chatgpt'|'grok'|'gemini' }) {
  const adapter = ProviderRegistry.get(provider)!;
  const caps = adapter.capabilities;
  return (
    <>
      {caps.supportsRatio && <RatioSelector />}
      {caps.supportsQuantity && <QuantitySlider />}
      {caps.supportsVideo && <ModeToggle />}
      {caps.supportsRefImage && <RefImagePicker max={caps.maxRefImages} />}
      {caps.supportsAutoDownload && <AutoDownloadToggle />}
      <ModelSelector provider={provider} />
    </>
  );
}
```

---

## 11. Session management

Mỗi provider có 1 Session class quản lý:
- Cookie / auth state
- Current conversation/chat ID (cho ChatGPT, Grok)
- Tile cache (Flow)

```ts
class FlowSession {
  static async getTileDetails(fileNames: string[], projectId: string): Promise<TileDetails[]> {
    return apiClient.post('flow/tile-resolve', { json: { file_names: fileNames, project_id: projectId } }).json();
  }
}

class ChatGPTSession {
  static async deleteConversation(conversationId: string): Promise<void> {
    // sendMessage to content script → fetch DELETE /backend-api/conversation/<id>
  }
}
```
