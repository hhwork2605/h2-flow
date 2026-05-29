# 06 — Data Models (TypeScript)

Tất cả types dưới đây MUST được dùng chung giữa các context. Tổ chức trong `src/types/`.

---

## 1. User & Auth

```ts
// src/types/user.types.ts

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  email_verified: boolean;
  google_linked: boolean;
  preferred_locale: 'vi' | 'en' | 'th' | 'ja';
  preferred_currency: 'VND' | 'USD' | 'THB' | 'JPY';
  created_at: string; // ISO
  // Plan info
  plan: PlanKey;             // 'free' | 'pro' | 'team' | 'trial'
  plan_expires_at: string | null;
  trial_active: boolean;
  trial_ends_at: string | null;
  // Referral
  referral_code: string;
  referral_stats: {
    registered: number;
    converted: number;
  };
}

export type PlanKey = 'free' | 'pro' | 'team' | 'trial';

export interface AuthSession {
  token: string;          // JWT access token
  refresh_token?: string;
  user: User;
  apiBaseUrl: string;     // Có thể bị override bởi admin per-user
  expires_at: number;     // ms epoch
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  referred_by?: string;   // referral code
}
```

---

## 2. Plans & Entitlements

```ts
// src/types/plan.types.ts

export interface Plan {
  key: PlanKey;
  name: string;             // "Pro Monthly"
  description: string;
  price_vnd: number;
  price_usd: number;
  duration_days: number;
  features: PlanFeature[];
  popular?: boolean;        // highlight in UI
}

export interface PlanFeature {
  key: string;              // 'workflow_run', 'auto_download_4k'
  label: string;            // "Chạy workflow"
  limit: number | null;     // null = unlimited
  unit: 'per_day' | 'per_month' | 'total';
}

export interface Entitlements {
  user_id: string;
  plan: PlanKey;
  plan_expires_at: string | null;
  features: Record<string, FeatureFlag>;
  quotas: Record<string, QuotaInfo>;
  fetched_at: number;       // client cache timestamp
}

export interface FeatureFlag {
  enabled: boolean;
  reason?: 'plan' | 'admin_override' | 'feature_disabled';
}

export interface QuotaInfo {
  action: string;           // 'workflow_run'
  limit: number;
  used: number;
  remaining: number;
  resets_at: string;        // ISO, when counter resets
  global?: {                // global quota (across all users / org)
    limit: number;
    used: number;
    remaining: number;
  };
}
```

---

## 3. Workflow Data Model (CORE)

```ts
// src/types/workflow.types.ts

export interface Workflow {
  wf_id: string;            // UUID
  wf_name: string;
  description?: string;
  project_id?: string;      // Flow project ID
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  // Drawflow-style canvas state
  canvas: {
    zoom: number;
    pan: { x: number; y: number };
  };
  // Metadata
  created_at: string;
  updated_at: string;
  owner_id: string;
  shared_with?: string[];   // user IDs
  is_template?: boolean;
  template_category?: string;
  tags?: string[];
  // Execution history
  last_run_at?: string;
  last_run_status?: 'success' | 'failed' | 'cancelled';
}

export type NodeType =
  | 'generate'
  | 'chatgpt'
  | 'grok'
  | 'prompt'
  | 'text'
  | 'image'
  | 'transform'
  | 'condition'
  | 'merge'
  | 'delay'
  | 'download'
  | 'telegram'
  | 'note'
  | 'output';

export type PortType = 'text' | 'image' | 'video' | 'frame' | 'any';

export interface WorkflowNode {
  node_id: string;
  node_type: NodeType;
  node_name: string;        // user-editable label
  position: { x: number; y: number };
  enabled: boolean;         // toggled off = skip during execution

  // ===== Common config =====
  prompt?: string;
  media_type?: 'Image' | 'Video';

  // Reference images
  ref_file_ids?: string[];
  ref_file_names?: Record<string, string>; // for @mention
  ref_thumbnails?: Record<string, string>;

  // Provider-specific
  model?: string;
  ratio?: string;           // '16:9', '1:1', '9:16', '4:3', '3:4'
  quantity?: number;
  duration?: string;        // '4s', '8s' (video)
  resolution?: string;      // '1k', '2k', '4k' (image) / '720p', '1080p' (video)

  // ChatGPT-specific
  chatgpt_model?: 'gpt-4o' | 'gpt-4o-mini' | 'o1';
  chatgpt_delete_after_gen?: boolean;

  // Grok-specific
  grok_mode?: 'image' | 'video';
  grok_duration?: string;
  grok_resolution?: string;
  grok_image_quality?: 'standard' | 'high';

  // Auto-download
  auto_download?: boolean;
  download_resolution?: string;
  video_download_resolution?: string;
  download_folder?: string; // template: "{workflow}/{date}"

  // Prompt node enhance
  enhance?: boolean;

  // Delay node
  delay_ms?: number;

  // Telegram node
  telegram_caption?: string;
  telegram_mode?: 'image' | 'video' | 'album';

  // Condition node
  condition_expr?: string;  // "result.length > 0"

  // ===== Execution state =====
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;

  // ===== Results =====
  // file_ids of resulting tiles (Flow UUID or synthetic for ChatGPT/Grok)
  result_file_ids?: string[];
  // Detailed result keyed by file_id
  result_thumbnails?: Record<string, ResultDetail>;
  result_file_names?: Record<string, string>;       // Flow UUID
  result_provider_urls?: Record<string, string>;    // Original provider URL
  result_text?: string;     // for prompt node
  result_source?: 'flow' | 'chatgpt' | 'grok' | 'gemini';
}

export interface ResultDetail {
  thumbnail: string;        // blob URL or HTTP URL
  type: 'image' | 'video';
  file_name?: string;       // Flow UUID
  width?: number;
  height?: number;
}

export interface WorkflowEdge {
  edge_id: string;
  source_node_id: string;
  source_port: number;      // output port index (0-based)
  target_node_id: string;
  target_port: number;      // input port index (0-based)
  port_type?: PortType;     // for visual color
}

export interface NodeMeta {
  type: NodeType;
  name: string;             // i18n key resolved
  description: string;
  color: string;
  icon: string;             // SVG name in icon library
  inputs: number;
  outputs: number;
  portType: PortType;       // primary I/O port type
}
```

---

## 4. Execution & Runtime

```ts
// src/types/execution.types.ts

export interface ExecutionRequest {
  action: ExecutionAction;
  prompt_count: number;
  metadata?: {
    owner?: 'generate' | 'task' | 'workflow' | 'single_node' | 'angles';
    label?: string;
    wf_id?: string;
    node_id?: string;
  };
}

export type ExecutionAction =
  | 'generate'
  | 'task_run'
  | 'workflow_run'
  | 'angles_run'
  | 'effects_run';

export interface ExecutionResponse {
  allowed: boolean;
  token?: string;
  reason?: ExecutionReason;
  remaining?: number;
  limit?: number;
  used?: number;
  global_remaining?: number;
  global_limit?: number;
  global_used?: number;
  prompt_count: number;
  expires_in?: number;      // seconds
}

export type ExecutionReason =
  | 'SERVER_APPROVED'
  | 'SERVER_DENIED'
  | 'QUOTA_EXCEEDED'
  | 'GLOBAL_QUOTA_EXCEEDED'
  | 'FEATURE_DISABLED'
  | 'PLAN_EXPIRED'
  | 'EXTENSION_NOT_AUTHORIZED'
  | 'RATE_LIMITED'
  | 'MAINTENANCE';

export interface RunningFlag {
  wf_id: string;
  wf_name: string;
  started_at: number;
  last_heartbeat_at: number;
  executor_context: 'sidebar' | 'popup-editor' | 'service-worker';
}

export interface NodeExecutionResult {
  fileIds: string[];
  thumbnails: Record<string, ResultDetail>;
  fileNames: Record<string, string>;
  providerUrls?: Record<string, string>;
  text?: string;
  duration: number;
}
```

---

## 5. Album & Image

```ts
// src/types/album.types.ts

export interface Album {
  id: string;
  name: string;
  cover_image_id?: string;
  image_count: number;
  created_at: string;
  updated_at: string;
}

export interface AlbumImage {
  id: string;               // synthetic or file_name UUID
  album_id?: string;
  file_name?: string;       // Flow UUID
  prompt: string;
  ref_image_ids?: string[];
  // Multi-tier thumbnails
  thumbnail_url: string;    // 50KB max, base64 or blob URL
  medium_url?: string;      // 1200px WebP @0.85
  original_url?: string;    // provider CDN (TTL!)
  // Metadata
  provider: 'flow' | 'chatgpt' | 'grok' | 'gemini';
  model: string;
  ratio: string;
  width: number;
  height: number;
  type: 'image' | 'video';
  created_at: string;
  expires_at?: string;      // blob TTL
}

export interface ImageBlob {
  key: string;              // image_id + size_tier
  blob: Blob;
  size: number;
  mime: string;
  tier: 'thumbnail' | 'medium' | 'original';
  cached_at: number;        // ms epoch
}
```

---

## 6. Multi-Task

```ts
// src/types/task.types.ts

export interface Task {
  id: string;
  name: string;
  provider: 'flow' | 'chatgpt' | 'grok';
  prompts: TaskPrompt[];
  config: {
    model: string;
    ratio: string;
    quantity: number;
    ref_image_mode: 'all' | 'mention' | 'sequential' | 'none';
    run_mode: 'parallel' | 'sequential';
    delay_between_ms: number;
    auto_download: boolean;
    download_resolution: string;
    save_to_album?: string;
  };
  ref_images?: string[];    // image_ids
  status: 'idle' | 'running' | 'completed' | 'partial_failed' | 'failed' | 'cancelled';
  progress: { current: number; total: number };
  created_at: string;
  updated_at: string;
}

export interface TaskPrompt {
  index: number;
  text: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result_file_ids?: string[];
  error_message?: string;
}
```

---

## 7. Snippets & Templates

```ts
// src/types/snippet.types.ts

export interface Snippet {
  id: string;
  title: string;
  content: string;          // prompt text với {placeholders}
  tags: string[];
  is_addon?: boolean;       // server-provided addon prompt
  owner_id: string;
  created_at: string;
}

export interface UserPrompt extends Snippet {
  use_count: number;
}

// src/types/template.types.ts

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  thumbnail_url?: string;
  workflow_data: Pick<Workflow, 'nodes' | 'edges' | 'canvas'>;
  author: string;
  uses: number;
  rating?: number;
  is_official?: boolean;
  created_at: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
}
```

---

## 8. History & Generation Log

```ts
// src/types/history.types.ts

export interface GenerationLog {
  id: string;
  user_id: string;
  source: 'gen_tab' | 'multi_task' | 'workflow' | 'single_node';
  provider: 'flow' | 'chatgpt' | 'grok' | 'gemini';
  model: string;
  prompt: string;
  ref_image_ids?: string[];
  result_file_ids: string[];
  thumbnails: Record<string, ResultDetail>;
  ratio: string;
  duration_ms: number;
  status: 'success' | 'failed' | 'partial';
  error_message?: string;
  wf_id?: string;
  node_id?: string;
  created_at: string;
}
```

---

## 9. SSE Events

```ts
// src/types/sse.types.ts

export type SseEventType =
  | 'notification'
  | 'plan_activated'
  | 'plan_expired'
  | 'quota_warning'
  | 'quota_exhausted'
  | 'workflow_shared'
  | 'announcement'
  | 'force_logout'
  | 'config_updated'
  | 'force_reload_extension'
  | 'session_replaced';

export interface SseEnvelope<T = unknown> {
  id: string;               // UUID for dedup
  type: SseEventType;
  payload: T;
  timestamp: string;
}

// Specific payloads
export interface NotificationPayload {
  title: string;
  body: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  link?: string;
}

export interface PlanActivatedPayload {
  plan: PlanKey;
  expires_at: string;
  order_id: string;
}

export interface QuotaWarningPayload {
  action: ExecutionAction;
  remaining: number;
  limit: number;
}

export interface ConfigUpdatedPayload {
  key: 'models' | 'providers' | 'dom-selectors' | 'i18n' | 'system' | 'execution';
  version: number;
  locale?: string;          // chỉ cho i18n
}

export interface AnnouncementPayload {
  id: string;
  title: string;
  body: string;
  target_plans?: PlanKey[];
  expires_at?: string;
}
```

---

## 10. Chrome runtime messages

```ts
// src/types/messages.types.ts

export type MessageAction =
  // API proxy
  | { action: 'apiRequest'; method: 'GET'|'POST'|'PUT'|'DELETE'|'PATCH'; path: string; body?: unknown; headers?: Record<string,string> }
  // Workflow execution broadcast
  | { action: 'workflowExecutionEvent'; event: string; data: unknown }
  // Provider tab control
  | { action: 'provider:ensureTab'; provider: 'flow'|'chatgpt'|'grok'|'gemini'; project_id?: string }
  | { action: 'provider:focusTab'; tabId: number; focusWindow?: boolean }
  // Cloudflare
  | { action: 'cloudflare:challenge'; provider: string; phase: 'detected'|'waiting'|'resolved'|'timeout'; elapsedSec: number }
  // Generation
  | { action: 'gen:submit'; payload: GenSubmitPayload }
  | { action: 'gen:result'; payload: GenResultPayload }
  | { action: 'gen:error'; payload: { code: string; message: string } }
  // Download
  | { action: 'download:start'; url: string; filename: string; subfolder?: string }
  // Tile resolution
  | { action: 'tile:resolve'; file_names: string[]; project_id: string }
  // Auth sync
  | { action: 'auth:logout' }
  | { action: 'auth:refreshed'; token: string };

// Helper for typed sendMessage
export async function sendMessage<R = unknown>(msg: MessageAction): Promise<R> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(response);
    });
  });
}
```

---

## 11. Settings

```ts
// src/types/settings.types.ts

export interface AppSettings {
  // Tier 1 LIVE
  autoDownload: boolean;
  chatgptDeleteAfterGen: boolean;

  // Tier 2 RESPECTFUL (RestoreValue)
  defaultGenType: 'Image' | 'Video';
  defaultImageModel: string;
  defaultVideoModel: string;
  defaultVideoDuration: string;
  grokDefaultDuration: string;
  grokDefaultResolution: string;
  grokDefaultImageQuality: string;
  downloadResolution: '1k' | '2k' | '4k';
  videoDownloadResolution: '720p' | '1080p';

  // General
  language: 'vi' | 'en' | 'th' | 'ja';
  theme: 'light' | 'dark' | 'auto';
  downloadFolderTemplate: string; // "{workflow}/{date}"

  // Storage
  blobMaxAgeDays: number;
  maxAlbumImages: number;
  compressBeforeUpload: boolean;

  // Notifications
  webhookUrl?: string;
  telegramBotToken?: string;
  emailDigest: boolean;

  // Advanced
  debugMode: boolean;
}
```

---

## 12. Validation schemas (Zod examples)

```ts
// src/api/schemas/workflow.schema.ts
import { z } from 'zod';

export const WorkflowNodeSchema = z.object({
  node_id: z.string().min(1),
  node_type: z.enum(['generate', 'chatgpt', 'grok', 'prompt', 'text', 'image',
    'transform', 'condition', 'merge', 'delay', 'download', 'telegram', 'note', 'output']),
  node_name: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  enabled: z.boolean().default(true),
  prompt: z.string().optional(),
  // ... rest of fields
});

export const WorkflowSchema = z.object({
  wf_id: z.string().uuid(),
  wf_name: z.string().min(1).max(100),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  canvas: z.object({
    zoom: z.number().min(0.1).max(3),
    pan: z.object({ x: z.number(), y: z.number() }),
  }),
});
```

---

## 13. Tip: Branded types cho ID

```ts
// Tránh nhầm lẫn workflowId vs nodeId vs fileId
type Brand<T, B> = T & { __brand: B };
export type WorkflowId = Brand<string, 'WorkflowId'>;
export type NodeId = Brand<string, 'NodeId'>;
export type FileId = Brand<string, 'FileId'>;
export type UserId = Brand<string, 'UserId'>;
```
