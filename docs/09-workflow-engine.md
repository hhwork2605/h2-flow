# 09 — Workflow Engine

## 1. Mental model

Workflow = **DAG** (Directed Acyclic Graph) gồm `nodes` + `edges`. Engine:
1. Topological sort → tìm thứ tự execute
2. Theo từng node, gọi runner phù hợp (theo `node_type`)
3. Runner forward output → input cho node kế tiếp qua edge
4. Persist intermediate state vào `chrome.storage` để resume khi reload

---

## 2. Node Type Catalog

### 2.1 Generate (Flow)
```ts
{
  node_type: 'generate',
  prompt: string,
  model: string,              // 'imagen-3' | 'veo-2' | ...
  media_type: 'Image' | 'Video',
  ratio: '16:9' | '1:1' | ...,
  quantity: 1-4,
  duration?: '4s' | '8s',     // video only
  ref_file_ids?: string[],    // tile UUIDs
  auto_download: boolean,
  download_resolution: '1k'|'2k'|'4k',
  download_folder?: string,
}
```
**Input port** (1): accepts `image` (ref) hoặc `text` (prompt from upstream).
**Output port** (1): produces `image` hoặc `video`.

### 2.2 ChatGPT
```ts
{
  node_type: 'chatgpt',
  prompt: string,
  chatgpt_model: 'gpt-4o' | 'gpt-4o-mini' | 'o1',
  ref_file_ids?: string[],
  chatgpt_delete_after_gen?: boolean,   // delete conversation sau khi gen
  auto_download: boolean,
}
```
**Output**: `image` (Note: file_id là synthetic vì ChatGPT không có UUID bền)

### 2.3 Grok
```ts
{
  node_type: 'grok',
  prompt: string,
  grok_mode: 'image' | 'video',
  grok_duration?: '6s' | '15s',
  grok_resolution?: '720p' | '1080p',
  grok_image_quality?: 'standard' | 'high',
  ref_file_ids?: string[],
}
```

### 2.4 Prompt
```ts
{
  node_type: 'prompt',
  prompt: string,             // có thể chứa {placeholder}
  enhance: boolean,           // call enhance API trước khi forward
}
```
**Output**: `text`. Khi `enhance=true`, gọi ChatGPT/Gemini để rewrite prompt.

### 2.5 Text
```ts
{ node_type: 'text', prompt: string }  // static text input
```

### 2.6 Image
```ts
{
  node_type: 'image',
  ref_file_ids: string[],     // user picked
}
```
Static image input (multi).

### 2.7 Transform
```ts
{
  node_type: 'transform',
  transform_type: 'upscale' | 'remove_bg' | 'angle' | 'effect',
  params: Record<string, unknown>,
}
```

### 2.8 Condition
```ts
{
  node_type: 'condition',
  condition_expr: string,     // "result.length > 0", "media_type === 'video'"
}
```
**Output**: 2 ports (true, false)

### 2.9 Merge
```ts
{
  node_type: 'merge',
  merge_mode: 'concat' | 'pick_first' | 'pick_random',
}
```
**Input**: 2 ports.

### 2.10 Delay
```ts
{ node_type: 'delay', delay_ms: 5000 }
```

### 2.11 Download
```ts
{
  node_type: 'download',
  download_folder: string,    // template: "{workflow}/{date}/{prompt}"
  download_resolution: '1k'|'2k'|'4k',
}
```

### 2.12 Telegram
```ts
{
  node_type: 'telegram',
  telegram_caption: string,   // template "{prompt} — {provider}"
  telegram_mode: 'image'|'video'|'album',
}
```

### 2.13 Note
```ts
{ node_type: 'note', prompt: string }  // không thực thi, chỉ ghi chú
```

### 2.14 Output
```ts
{ node_type: 'output' }  // marker node, kết quả "final"
```

---

## 3. Port system

### 3.1 Types

```ts
export const PORT_TYPES = {
  text:  { color: '#9177e1', icon: 'T' },
  image: { color: '#3b82f6', icon: 'I' },
  video: { color: '#a855f7', icon: 'V' },
  frame: { color: '#14b8a6', icon: 'F' },
  any:   { color: '#71717a', icon: '*' },
} as const;

export const PORT_COMPAT: Record<PortType, PortType[]> = {
  text:  ['text', 'any'],
  image: ['image', 'frame', 'any'],
  video: ['video', 'any'],
  frame: ['frame', 'image', 'any'],
  any:   ['text', 'image', 'video', 'frame', 'any'],
};
```

### 3.2 Compatibility check
Khi user kéo edge: từ `output port type A` → `input port type B`:
```ts
function canConnect(sourceType: PortType, targetType: PortType): boolean {
  return PORT_COMPAT[sourceType].includes(targetType);
}
```

### 3.3 Type coercion (auto-cast)
- `image` ↔ `frame`: automatic (cùng vật liệu, khác semantics)
- `any` accept tất cả nhưng runner phải narrow ở runtime

---

## 4. Topological Sort

```ts
function topologicalSort(workflow: Workflow): WorkflowNode[] {
  const { nodes, edges } = workflow;
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.node_id, 0);
    graph.set(n.node_id, []);
  }

  for (const e of edges) {
    graph.get(e.source_node_id)!.push(e.target_node_id);
    inDegree.set(e.target_node_id, (inDegree.get(e.target_node_id) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: WorkflowNode[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.node_id, n]));

  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);

  while (queue.length) {
    const id = queue.shift()!;
    const node = nodeMap.get(id)!;
    if (!node.enabled) continue;       // skip disabled nodes
    if (node.node_type === 'note') continue;  // notes don't execute
    result.push(node);

    for (const next of graph.get(id) || []) {
      inDegree.set(next, inDegree.get(next)! - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  if (result.length < nodes.filter((n) => n.enabled && n.node_type !== 'note').length) {
    throw new Error('CYCLE_DETECTED');
  }

  return result;
}
```

**Note quan trọng**: workflow editor MUST block tạo cycle (React Flow có `isValidConnection` callback).

---

## 5. Executor flow

### 5.1 Top-level run

```ts
class WorkflowExecutor {
  isRunning = false;
  currentWorkflow: Workflow | null = null;
  currentNode: WorkflowNode | null = null;
  private _currentExecutionToken: string | null = null;
  private _heartbeatTimer: number | null = null;

  async run(workflowId: string, ctx: 'sidebar' | 'popup-editor'): Promise<void> {
    if (this.isRunning) throw new Error('ALREADY_RUNNING_LOCAL');

    // 1. Cross-context lock
    const claim = await claimRunningFlag(workflowId, '', ctx);
    if (!claim.ok) {
      throw new Error(`ANOTHER_WORKFLOW_RUNNING: ${claim.runningWfName}`);
    }

    try {
      // 2. Load workflow
      const workflow = await loadWorkflow(workflowId);
      this.currentWorkflow = workflow;
      this.isRunning = true;
      await updateRunningFlagName(workflowId, workflow.wf_name);

      // 3. Heartbeat every 60s
      this._startHeartbeat(workflowId);

      // 4. Topological sort
      const ordered = topologicalSort(workflow);

      // 5. ExecutionGate request — count generate+chatgpt+grok prompts
      const promptCount = ordered.filter((n) => ['generate','chatgpt','grok'].includes(n.node_type)).length;
      const gate = await ExecutionGate.request('workflow_run', promptCount, { owner: 'workflow', label: workflow.wf_name, wf_id: workflowId });
      if (!gate.allowed) {
        ExecutionGate.showDeniedDialog(gate, 'Workflow');
        throw new Error(gate.reason || 'DENIED');
      }
      this._currentExecutionToken = gate.token!;

      eventBus.emit('execution:started', { workflow });
      broadcastEvent('execution:started', { wf_id: workflowId, wf_name: workflow.wf_name });

      // 6. Run nodes in order
      const stop = { value: false };
      eventBus.once('execution:stop_requested', () => { stop.value = true; });

      for (const node of ordered) {
        if (stop.value) break;
        await this._runNode(node, workflow);
      }

      // 7. Complete
      await ExecutionGate.complete(this._currentExecutionToken, stop.value ? 'failed' : 'success');
      eventBus.emit('execution:completed', { workflow, stopped: stop.value });
      broadcastEvent('execution:completed', { wf_id: workflowId, stopped: stop.value });

      // 8. Telegram notify nếu user setting bật
      if (await getSetting('notify_on_complete')) {
        await apiClient.post('telegram/notify-completion', { json: {
          wf_id: workflowId, wf_name: workflow.wf_name, success: !stop.value
        }});
      }
    } catch (err) {
      // Refund quota
      if (this._currentExecutionToken) {
        await ExecutionGate.complete(this._currentExecutionToken, 'failed');
      }
      eventBus.emit('execution:completed', { workflow: this.currentWorkflow, error: err });
      throw err;
    } finally {
      this._stopHeartbeat();
      await clearRunningFlag(workflowId);
      this.isRunning = false;
      this.currentWorkflow = null;
      this.currentNode = null;
      this._currentExecutionToken = null;
    }
  }
}
```

### 5.2 Per-node run

```ts
private async _runNode(node: WorkflowNode, workflow: Workflow): Promise<NodeExecutionResult> {
  this.currentNode = node;
  await this._updateNodeStatus(node.node_id, 'running');
  eventBus.emit('node:started', { node });
  broadcastEvent('node:started', { node_id: node.node_id, node_name: node.node_name });

  const startedAt = Date.now();
  try {
    // Dispatch theo type
    let result: NodeExecutionResult;
    switch (node.node_type) {
      case 'generate':
      case 'chatgpt':
      case 'grok':
        emitNodePhase(node.node_id, 'sending');
        result = await ProviderNodeRunner.run(node, workflow);
        break;

      case 'prompt':
        result = await PromptNodeRunner.run(node, workflow);
        break;

      case 'text':
        result = { fileIds: [], thumbnails: {}, fileNames: {}, text: node.prompt!, duration: 0 };
        break;

      case 'image':
        result = await ImageInputRunner.run(node);
        break;

      case 'transform':
        result = await TransformRunner.run(node, workflow);
        break;

      case 'condition':
        result = await ConditionRunner.run(node, workflow);
        break;

      case 'merge':
        result = await MergeRunner.run(node, workflow);
        break;

      case 'delay':
        await sleep(node.delay_ms || 1000);
        result = { fileIds: [], thumbnails: {}, fileNames: {}, duration: node.delay_ms || 0 };
        break;

      case 'download':
        result = await DownloadRunner.run(node, workflow);
        break;

      case 'telegram':
        result = await TelegramRunner.run(node, workflow);
        break;

      case 'output':
        result = await OutputRunner.run(node, workflow);
        break;

      default:
        throw new Error(`UNKNOWN_NODE_TYPE: ${node.node_type}`);
    }

    // Validate output cho gen nodes
    if (['generate','chatgpt','grok'].includes(node.node_type) && result.fileIds.length === 0) {
      throw new Error('NO_OUTPUT_FILES');
    }

    // Persist node result
    Object.assign(node, {
      result_file_ids: result.fileIds,
      result_thumbnails: result.thumbnails,
      result_file_names: result.fileNames,
      result_provider_urls: result.providerUrls,
      result_text: result.text,
      duration_ms: Date.now() - startedAt,
    });

    await this._updateNodeStatus(node.node_id, 'completed', result.fileIds);
    eventBus.emit('node:completed', { node, result });
    broadcastEvent('node:completed', { node_id: node.node_id, result });
    return result;
  } catch (err) {
    await this._updateNodeStatus(node.node_id, 'failed', null, (err as Error).message);
    eventBus.emit('node:failed', { node, error: err });
    broadcastEvent('node:failed', { node_id: node.node_id, error: (err as Error).message });
    throw err;
  }
}
```

### 5.3 Phase events (UX)

Trong các runner provider (Flow/ChatGPT/Grok), emit phase event để UI animate:

```ts
function emitNodePhase(nodeId: string, phase: 'sending' | 'generating' | 'downloading') {
  eventBus.emit('node:phase', { nodeId, phase });
  broadcastEvent('node:phase', { nodeId, phase });
}

// FlowAdapter.submit:
emitNodePhase(node.node_id, 'sending');
await contentScript.typePrompt();
await contentScript.clickGenerate();
emitNodePhase(node.node_id, 'generating');
await tileMonitor.waitForTiles();
emitNodePhase(node.node_id, 'downloading');
await downloadTiles();
```

UI render:
- `sending` → "📤 Đang gửi prompt..."
- `generating` → "🎨 Đang gen ảnh/video..."
- `downloading` → "📥 Đang tải kết quả..."

---

## 6. Cross-context running flag

### 6.1 Web Locks API (atomic acquire)

```ts
async function claimRunningFlag(
  wfId: string,
  wfName: string,
  ctx: 'sidebar' | 'popup-editor'
): Promise<{ ok: boolean; runningWfName?: string }> {
  const doClaim = async () => {
    const existing = await readRunningFlag();
    if (existing?.wf_id) return { ok: false, runningWfName: existing.wf_name };
    const now = Date.now();
    await setStorage('af_running_workflow', {
      wf_id: wfId, wf_name: wfName, started_at: now, last_heartbeat_at: now, executor_context: ctx
    });
    return { ok: true };
  };

  if (navigator.locks?.request) {
    return await navigator.locks.request(
      'af_running_workflow_claim',
      { ifAvailable: true, mode: 'exclusive' },
      async (lock) => {
        if (!lock) {
          const existing = await readRunningFlag();
          return { ok: false, runningWfName: existing?.wf_name };
        }
        return await doClaim();
      }
    );
  }
  return await doClaim(); // fallback TOCTOU
}
```

### 6.2 Heartbeat + stale recovery

```ts
const HEARTBEAT_INTERVAL_MS = 60_000;
const HEARTBEAT_TTL_MS = 5 * 60_000;

private _startHeartbeat(wfId: string) {
  this._heartbeatTimer = setInterval(() => {
    pulseHeartbeat(wfId);
  }, HEARTBEAT_INTERVAL_MS) as unknown as number;
}

async function readRunningFlag(): Promise<RunningFlag | null> {
  const flag = await getStorage<RunningFlag>('af_running_workflow');
  if (!flag?.wf_id) return null;
  const lastBeat = flag.last_heartbeat_at || flag.started_at;
  if (Date.now() - lastBeat > HEARTBEAT_TTL_MS) {
    await removeStorage('af_running_workflow');
    return null;
  }
  return flag;
}
```

---

## 7. Resolving inputs from upstream

Khi runner Generate cần `ref_file_ids`, có 2 nguồn:
1. **Node config** (user pick từ Image Picker) — `node.ref_file_ids`
2. **Upstream output** — qua edge từ node `image`/`generate`/`chatgpt`/`grok`/`merge`

```ts
function resolveNodeInputs(node: WorkflowNode, workflow: Workflow): {
  promptText?: string;
  imageFileIds: string[];
  imageThumbnails: Record<string, ResultDetail>;
} {
  const inputs = {
    promptText: node.prompt,
    imageFileIds: [...(node.ref_file_ids || [])],
    imageThumbnails: {},
  };

  // Find incoming edges
  const incomingEdges = workflow.edges.filter((e) => e.target_node_id === node.node_id);
  for (const edge of incomingEdges) {
    const source = workflow.nodes.find((n) => n.node_id === edge.source_node_id);
    if (!source) continue;

    // Text input — prepend hoặc thay prompt (tuỳ design, mặc định: prepend)
    if (source.node_type === 'text' || (source.node_type === 'prompt' && source.result_text)) {
      const text = source.result_text || source.prompt;
      if (text) inputs.promptText = inputs.promptText ? `${text}\n\n${inputs.promptText}` : text;
    }

    // Image input
    if (['image','generate','chatgpt','grok'].includes(source.node_type)) {
      const ids = source.result_file_ids || source.ref_file_ids || [];
      inputs.imageFileIds.push(...ids);
      Object.assign(inputs.imageThumbnails, source.result_thumbnails || {});
    }

    // Merge node — đã merge sẵn ở runner của nó
    if (source.node_type === 'merge' && source.result_file_ids) {
      inputs.imageFileIds.push(...source.result_file_ids);
    }
  }

  return inputs;
}
```

---

## 8. Mention parser (`@ref1`, `@my_image`)

User có thể đặt tên cho ref images bằng `image_name_registry`, sau đó `@name` trong prompt → expand thành file_id.

```ts
class MentionParser {
  static expand(prompt: string, registry: Record<string, string>): { text: string; usedRefs: string[] } {
    const usedRefs: string[] = [];
    const text = prompt.replace(/@(\w+)/g, (match, name) => {
      const fileId = registry[name];
      if (fileId) {
        usedRefs.push(fileId);
        return ''; // Strip mention from text, runner sẽ inject ref
      }
      return match;
    });
    return { text: text.trim(), usedRefs };
  }
}
```

UI: Mention helper dropdown hiển thị suggestions khi user gõ `@`.

---

## 9. Bridge ChatGPT/Grok → Flow (production trick)

ChatGPT/Grok không có UUID bền. Khi 1 node Generate Flow nhận input từ ChatGPT/Grok node, ta phải:

1. Fetch ảnh từ ChatGPT/Grok CDN (token expires nhanh!)
2. Upload ảnh đó qua Flow tRPC API → nhận về Flow file_name UUID
3. Dùng UUID đó làm `ref_file_id` cho Generate node

```ts
async function bridgeToFlow(externalFileId: string, source: 'chatgpt' | 'grok'): Promise<string> {
  // 1. Fetch blob từ CDN trước khi token expires
  const meta = await imageStore.get(externalFileId);
  const blob = await fetch(meta.original_url || meta.medium_url).then((r) => r.blob());

  // 2. Upload to Flow
  const result = await FlowAdapter.uploadRef(blob);
  return result.file_name; // Flow UUID
}
```

Logic này nằm trong `WorkflowExecutor._resolveCrossProviderRefs()`.

---

## 10. Persist & resume

### Persist sau mỗi node complete
```ts
await apiClient.patch(`workflows/${wfId}/nodes/${nodeId}`, {
  json: { status: 'completed', result_file_ids, result_thumbnails, result_file_names, result_provider_urls }
});
```

### Resume khi reload
```ts
async function resumeIfStuck(): Promise<void> {
  const flag = await readRunningFlag();
  if (!flag) return;

  // Detect crash: flag exists but no heartbeat for > 2 min
  if (Date.now() - flag.last_heartbeat_at > 2 * 60_000) {
    // Auto-clear or prompt user
    const confirmed = await CustomDialog.confirm({
      title: 'Workflow bị gián đoạn',
      body: `Workflow "${flag.wf_name}" đang chạy nhưng có vẻ đã dừng. Tiếp tục?`,
    });
    if (confirmed) {
      // Optional: load workflow with completed nodes, continue từ chỗ dừng
    } else {
      await removeStorage('af_running_workflow');
    }
  }
}
```

---

## 11. Validation rules cho editor

Khi save workflow:

```ts
function validateWorkflow(wf: Workflow): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Phải có ít nhất 1 node enabled
  if (!wf.nodes.some((n) => n.enabled && n.node_type !== 'note')) {
    errors.push('Cần ít nhất 1 node thực thi');
  }

  // 2. Không có cycle
  try { topologicalSort(wf); } catch { errors.push('Workflow có cycle'); }

  // 3. Mỗi gen node phải có prompt hoặc upstream text input
  for (const node of wf.nodes) {
    if (['generate','chatgpt','grok'].includes(node.node_type) && node.enabled) {
      const hasPrompt = !!node.prompt?.trim();
      const hasTextInput = wf.edges.some((e) =>
        e.target_node_id === node.node_id &&
        ['text','prompt'].includes(wf.nodes.find((n) => n.node_id === e.source_node_id)?.node_type || '')
      );
      if (!hasPrompt && !hasTextInput) {
        errors.push(`Node "${node.node_name}" thiếu prompt`);
      }
    }
  }

  // 4. Port compat check trên edges
  for (const edge of wf.edges) {
    const source = wf.nodes.find((n) => n.node_id === edge.source_node_id);
    const target = wf.nodes.find((n) => n.node_id === edge.target_node_id);
    if (!source || !target) errors.push(`Edge ${edge.edge_id} reference invalid node`);
    // Detailed port type check ở react-flow isValidConnection
  }

  // 5. ref images không vượt limit theo provider
  for (const node of wf.nodes) {
    const max = node.media_type === 'Video' ? 3 : 10;
    if ((node.ref_file_ids?.length || 0) > max) {
      errors.push(`Node "${node.node_name}" vượt giới hạn ref images (${max})`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

---

## 12. Event taxonomy

```ts
// Local eventBus events
type WorkflowEvent =
  | { name: 'execution:started'; data: { workflow: Workflow; singleNode?: boolean } }
  | { name: 'execution:completed'; data: { workflow: Workflow; error?: Error; stopped?: boolean } }
  | { name: 'execution:stop_requested'; data: {} }
  | { name: 'execution:tracker_update'; data: { current: number; total: number; phase: string } }
  | { name: 'execution:lock_changed'; data: { owner: string; acquired: boolean } }
  | { name: 'node:started'; data: { node: WorkflowNode } }
  | { name: 'node:completed'; data: { node: WorkflowNode; result: NodeExecutionResult } }
  | { name: 'node:failed'; data: { node: WorkflowNode; error: Error } }
  | { name: 'node:phase'; data: { nodeId: string; phase: 'sending'|'generating'|'downloading' } }
  | { name: 'workflow:open_editor'; data: { wf_id: string } }
  | { name: 'provider:changed'; data: { provider: string } }
  | { name: 'provider:error'; data: { provider: string; code: string; message: string } }
  | { name: 'chatgpt:login_required'; data: {} }
  | { name: 'grok:login_required'; data: {} }
  | { name: 'grok:subscription_required'; data: {} }
  | { name: 'tasks:batch_complete'; data: { count: number } }
  | { name: 'tasks:all_submitted'; data: {} }
  | { name: 'task:status_changed'; data: { task: Task } }
  | { name: 'task:complete'; data: { task: Task } }
  | { name: 'task:run'; data: { task_id: string } }
  | { name: 'tasks:run_batch'; data: { task_ids: string[] } }
  | { name: 'tasks:stop_all'; data: {} }
  | { name: 'album:created'; data: { album: Album } }
  | { name: 'album:refresh'; data: {} }
  | { name: 'album:use'; data: { album_id: string } }
  | { name: 'auth:login'; data: { user: User } }
  | { name: 'auth:logout'; data: {} }
  | { name: 'auth:restored'; data: { user: User } }
  | { name: 'capture:start'; data: { context: string } }
  | { name: 'capture:complete'; data: { image_id: string } }
  | { name: 'featuregate:refreshed'; data: { entitlements: Entitlements } };
```

---

## 13. Single-node run (debug feature)

User có thể run 1 node riêng trong editor (debug):

```ts
async executeSingleNode(nodeId: string, workflow: Workflow) {
  // Same lock + ExecutionGate flow, nhưng:
  // - promptCount = số prompt của 1 node (vd: quantity=4 cho Generate)
  // - Không loop topological sort
  // - Vẫn resolve upstream inputs (nếu node trước đã có result_file_ids)
  const node = workflow.nodes.find((n) => n.node_id === nodeId)!;
  const promptCount = ['generate','chatgpt','grok'].includes(node.node_type) ? (node.quantity || 1) : 1;
  // ... same flow as run()
}
```
