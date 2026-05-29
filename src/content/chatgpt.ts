/**
 * content/chatgpt.ts — Content script chạy trong tab chat.openai.com /
 * chatgpt.com. Bridge DOM ↔ background qua chrome.runtime.sendMessage.
 *
 * Layer: Content script (extension context, page DOM)
 * Owner: providers/sessions
 *
 * Phase 4 P4.1b scope:
 *  - Selector infrastructure: cache provider configs từ chrome.storage,
 *    `queryWithFallback`, `queryAllWithFallback`, `getSelectorsForKey`.
 *  - Helper functions: `waitForElement`, `simulateClick`, `sleep`,
 *    `checkAbort` (đọc flag từ chrome.storage để abort mid-flow).
 *  - Skeleton message handler: ping, checkLogin (full submit flow ở P4.1c).
 *  - Inject guard: chỉ load 1 lần per tab.
 *  - Navigate tracking: emit `chatgpt:navigated` lên background khi pushState.
 *
 * Reference: `reference-ext/chat-content-chatgpt.js` (~2900 LoC). Port helpers
 * trước, submit flow + image mode activation sẽ kế thừa ở P4.1c.
 */

/* ─── Inject guard ────────────────────────────────────────────────────── */

declare global {
  interface Window {
    __h2flowChatGPTLoaded__?: boolean;
  }
}

// Bootstrap invocation moved to BOTTOM of file (sau khi tất cả `let` declared)
// để tránh TDZ error khi bootstrap() đọc _configCache / _abortCache.

/* ─── Constants ───────────────────────────────────────────────────────── */

const PROVIDER = 'chatgpt';
const SELECTOR_CACHE_TTL_MS = 60_000;
const STORAGE_KEY_PROVIDER_CONFIGS = 'h2flow_provider_configs';
const STORAGE_KEY_ABORT_FLAG = 'h2flow_abort_active';

/**
 * Schema của data trong chrome.storage.local.h2flow_provider_configs:
 *   { data: { [providerKey]: { selectors: { [key]: { selectors: string[] } } } } }
 *
 * Sidebar bootstrap (`useProviderDomSelectors`) sẽ ghi vào key này.
 */
interface ProviderConfigBundle {
  data?: Record<
    string,
    { selectors?: Record<string, { selectors?: string[] }> }
  >;
  fetchedAt?: number;
}

interface QueryOptions {
  scope?: ParentNode;
  /** Suppress console.log spam khi poll mỗi 200ms. */
  silent?: boolean;
}

/* ─── Selector cache ──────────────────────────────────────────────────── */

let _configCache: ProviderConfigBundle | null = null;
let _configCacheAt = 0;

/**
 * Lazy-load provider configs từ chrome.storage. Cache 60s — sidebar push qua
 * chrome.storage.onChanged sẽ invalidate ngay nên hiếm khi miss.
 */
function loadConfigs(): void {
  const now = Date.now();
  if (_configCache && now - _configCacheAt < SELECTOR_CACHE_TTL_MS) return;
  try {
    chrome.storage.local.get([STORAGE_KEY_PROVIDER_CONFIGS], (res) => {
      const bundle = res[STORAGE_KEY_PROVIDER_CONFIGS] as ProviderConfigBundle | undefined;
      if (bundle) {
        _configCache = bundle;
        _configCacheAt = Date.now();
      }
    });
  } catch (err) {
    console.warn('[h2flow:chatgpt] storage read fail', err);
  }
}

/** Lắng nghe sidebar push config mới → invalidate cache ngay. */
function watchConfigChanges(): void {
  if (!chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEY_PROVIDER_CONFIGS]) {
      _configCache = changes[STORAGE_KEY_PROVIDER_CONFIGS].newValue as ProviderConfigBundle;
      _configCacheAt = Date.now();
    }
  });
}

/* ─── Selector helpers ────────────────────────────────────────────────── */

/**
 * Lấy danh sách selector cho 1 key (vd: `prompt_textarea`, `cdn_image`,
 * `stop_button`). Server-Only — không có hardcoded fallback. Trả [] nếu
 * sidebar chưa push config.
 */
export function getSelectorsForKey(key: string): string[] {
  loadConfigs();
  const bundle = _configCache?.data?.[PROVIDER];
  return bundle?.selectors?.[key]?.selectors ?? [];
}

/**
 * Query 1 element bằng selectors list. Trả null nếu không match.
 * Server-Only: chỉ dùng selectors từ chrome.storage.
 */
export function queryWithFallback(
  key: string,
  options: QueryOptions = {},
): Element | null {
  const selectors = getSelectorsForKey(key);
  const scope = options.scope ?? document;
  const silent = options.silent ?? false;
  if (!silent) {
    console.debug(
      `[h2flow:chatgpt:${key}] trying ${selectors.length} selectors`,
    );
  }
  for (const sel of selectors) {
    try {
      const el = scope.querySelector(sel);
      if (el) {
        if (!silent) console.debug(`[h2flow:chatgpt:${key}] ✓ ${sel}`);
        return el;
      }
    } catch {
      // invalid selector — skip
    }
  }
  if (!silent) console.debug(`[h2flow:chatgpt:${key}] ✗ no match`);
  return null;
}

/** Query nhiều elements — fallback theo từng selector. */
export function queryAllWithFallback(
  key: string,
  options: QueryOptions = {},
): Element[] {
  const selectors = getSelectorsForKey(key);
  const scope = options.scope ?? document;
  for (const sel of selectors) {
    try {
      const els = Array.from(scope.querySelectorAll(sel));
      if (els.length > 0) return els;
    } catch {
      // invalid selector
    }
  }
  return [];
}

/**
 * Đợi element xuất hiện (poll mỗi `pollMs`). Throw nếu vượt `timeoutMs` hoặc
 * abort signal fire.
 */
export async function waitForElement(
  key: string,
  options: {
    timeoutMs?: number;
    pollMs?: number;
    scope?: ParentNode;
    signal?: AbortSignal;
  } = {},
): Promise<Element> {
  const { timeoutMs = 10_000, pollMs = 200, scope, signal } = options;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('ABORTED');
    const el = queryWithFallback(key, { scope, silent: true });
    if (el) return el;
    await sleep(pollMs);
  }
  throw new Error(`waitForElement timeout: ${key}`);
}

/* ─── Pointer + click helpers ────────────────────────────────────────── */

/**
 * Simulate full pointer + click event chain. Cần thiết với React app:
 * native `el.click()` đôi khi không trigger React synthetic event handler.
 */
export function simulateClick(el: Element): void {
  const rect = (el as HTMLElement).getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const opts: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerType: 'mouse',
  };
  el.dispatchEvent(new PointerEvent('pointerdown', opts));
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new PointerEvent('pointerup', opts));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ─── Abort flag ──────────────────────────────────────────────────────── */

let _abortCache = false;

/**
 * Sidebar set `chrome.storage.local.h2flow_abort_active = true` để báo content
 * script dừng flow ngay. Dùng trong loop dài (upload images, wait CDN).
 */
export function checkAbort(stage: string): void {
  if (_abortCache) {
    console.log(`[h2flow:chatgpt:abort] ${stage}`);
    throw new Error(`ABORTED:${stage}`);
  }
}

function watchAbortFlag(): void {
  if (!chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEY_ABORT_FLAG]) {
      _abortCache = !!changes[STORAGE_KEY_ABORT_FLAG].newValue;
    }
  });
  chrome.storage.local.get([STORAGE_KEY_ABORT_FLAG], (res) => {
    _abortCache = !!res[STORAGE_KEY_ABORT_FLAG];
  });
}

/* ─── Message handler ─────────────────────────────────────────────────── */

interface ContentRequest {
  action?: string;
  payload?: unknown;
}

interface ContentResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

async function handleMessage(
  request: ContentRequest,
): Promise<ContentResponse | undefined> {
  switch (request.action) {
    case 'chatgpt:ping':
      return { success: true, data: { loaded: true, href: location.href } };

    case 'chatgpt:checkLogin': {
      const textarea = queryWithFallback('prompt_textarea', { silent: true });
      const loginBtn = queryWithFallback('login_button', { silent: true });
      const ready = !!textarea && !loginBtn;
      return { success: true, data: { ready }, ...(ready ? {} : { error: 'NOT_LOGGED_IN' }) };
    }

    case 'chatgpt:activateImageMode':
      return activateImageMode();

    case 'chatgpt:selectRatio':
      return selectRatio((request.payload as { ariaLabel?: string })?.ariaLabel ?? '');

    case 'chatgpt:submitPrompt': {
      const p = (request.payload ?? {}) as { text?: string; timeoutMs?: number };
      if (!p.text) return { success: false, error: 'EMPTY_TEXT' };
      return submitPromptFlow(p.text, p.timeoutMs ?? 120_000);
    }

    case 'chatgpt:cancel':
      return cancelFlow();

    default:
      return { success: false, error: 'UNKNOWN_ACTION' };
  }
}

/* ─── Submit flow (P4.1c) ─────────────────────────────────────────────── */

/**
 * Bật image mode: click composer plus button → wait menu → click "Create image".
 * Verify mode active qua dấu hiệu ratio control xuất hiện.
 */
async function activateImageMode(): Promise<ContentResponse> {
  try {
    const plusBtn = await waitForElement('composer_plus_button', {
      timeoutMs: 5_000,
      pollMs: 200,
    }).catch(() => null);
    if (!plusBtn) {
      return { success: false, error: 'ACTIVATE_FAILED', data: { stage: 'plus_button' } };
    }
    simulateClick(plusBtn);
    await sleep(400);

    const menuItem = await waitForElement('create_image_menu_item', {
      timeoutMs: 3_000,
      pollMs: 150,
    }).catch(() => null);
    if (!menuItem) {
      // Đóng menu trước khi return để không stuck UI.
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return { success: false, error: 'ACTIVATE_FAILED', data: { stage: 'menu_item' } };
    }
    simulateClick(menuItem);
    await sleep(500);

    const ratioBtn = queryWithFallback('ratio_control', { silent: true });
    return {
      success: true,
      activated: true,
      ratioControlAvailable: !!ratioBtn,
    } as ContentResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Chọn ratio. Hiện tại tìm button có aria-label khớp; sidebar pass aria-label
 * (vd "16:9") tương ứng `CHATGPT_RATIO_TO_ARIA` trong types.
 */
async function selectRatio(ariaLabel: string): Promise<ContentResponse> {
  if (!ariaLabel) return { success: false, error: 'MISSING_LABEL' };
  // Tìm theo ratio_control selectors + filter aria-label.
  const candidates = queryAllWithFallback('ratio_control', {});
  for (const el of candidates) {
    if (el.getAttribute('aria-label')?.includes(ariaLabel)) {
      simulateClick(el);
      await sleep(200);
      return { success: true };
    }
  }
  return { success: false, error: 'RATIO_NOT_FOUND' };
}

/**
 * Submit flow:
 *   1. Find composer editor.
 *   2. Take baseline existing CDN image file_ids.
 *   3. Clear editor (selectAll+delete primary / innerHTML reset fallback).
 *   4. Insert text (ClipboardEvent paste primary / execCommand insertText fallback).
 *   5. Submit (KeyboardEvent Enter primary / click submit button fallback).
 *   6. Wait for new CDN image (poll 500ms, timeout).
 *   7. Return { imageUrls }.
 */
async function submitPromptFlow(text: string, timeoutMs: number): Promise<ContentResponse> {
  try {
    const editor = (await waitForElement('composer', {
      timeoutMs: 10_000,
      pollMs: 200,
    })) as HTMLElement;

    // Baseline trước khi submit.
    const baseline = collectCdnImageFileIds();

    // Focus + clear.
    editor.focus();
    await sleep(100);
    await clearEditor(editor);

    // Insert text.
    const inserted = await insertText(editor, text);
    if (!inserted) {
      return { success: false, error: 'INSERT_FAILED' };
    }
    checkAbort('after_insert');

    // Submit.
    const submitted = await submitText(editor);
    if (!submitted) {
      return { success: false, error: 'SUBMIT_FAILED' };
    }
    checkAbort('after_submit');

    // Wait CDN image.
    const result = await waitForNewCdnImages(baseline, timeoutMs);
    if (!result.ok) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: { imageUrls: result.urls },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/** Click Stop button + return true if found. */
async function cancelFlow(): Promise<ContentResponse> {
  const stopBtn = queryWithFallback('stop_button', { silent: true });
  if (stopBtn && !(stopBtn as HTMLButtonElement).disabled) {
    simulateClick(stopBtn);
    await sleep(200);
    return { success: true, data: { stopped: true } };
  }
  return { success: true, data: { stopped: false } };
}

/* ─── Composer text injection helpers ────────────────────────────────── */

async function clearEditor(editor: HTMLElement): Promise<void> {
  const beforeText = (editor.textContent ?? '').trim();
  if (beforeText.length === 0) return; // empty — skip (tránh phá ProseMirror state)

  // Tier 1: execCommand selectAll + delete.
  try {
    document.execCommand('selectAll', false);
    await sleep(50);
    document.execCommand('delete', false);
    await sleep(80);
  } catch {
    /* fallthrough */
  }

  // Tier 2 fallback: innerHTML reset nếu vẫn còn text.
  const stillHasText = (editor.textContent ?? '').trim().length > 0;
  if (stillHasText) {
    editor.innerHTML = '<p><br class="ProseMirror-trailingBreak"></p>';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent' }));
    await sleep(80);
  }
  editor.focus();
}

async function insertText(editor: HTMLElement, text: string): Promise<boolean> {
  const sample = text.slice(0, Math.min(20, text.length));
  const inserted = () => editor.textContent?.includes(sample) ?? false;

  // Tier 1: ClipboardEvent paste.
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    editor.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
    await sleep(250);
  } catch {
    /* fallthrough */
  }

  // Tier 2: execCommand insertText.
  if (!inserted()) {
    try {
      document.execCommand('insertText', false, text);
      await sleep(200);
    } catch {
      /* fallthrough */
    }
  }

  // Tier 3 (last resort): innerHTML replace.
  if (!inserted()) {
    editor.innerHTML = `<p>${escapeHtml(text)}</p>`;
    editor.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
    );
    await sleep(200);
  }

  // CRITICAL: dispatch input event sau cùng để React ProseMirror onChange sync state.
  editor.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertFromPaste',
      data: text,
    }),
  );
  await sleep(120);

  return inserted();
}

async function submitText(editor: HTMLElement): Promise<boolean> {
  // Empty-check để xác định submit thành công (composer được clear sau Enter).
  const submitted = () => (editor.textContent ?? '').trim().length < 5;

  // Tier 1: KeyboardEvent Enter.
  editor.focus();
  await sleep(80);
  const enterOpts: KeyboardEventInit = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  try {
    editor.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
    editor.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
    editor.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
  } catch {
    /* fallthrough */
  }
  await sleep(1_200);
  if (submitted()) return true;

  // Tier 2: click submit button.
  const submitBtn = queryWithFallback('submit_button', { silent: true });
  if (submitBtn && !(submitBtn as HTMLButtonElement).disabled) {
    simulateClick(submitBtn);
    await sleep(1_000);
  }
  return submitted();
}

/* ─── CDN image baseline + wait ──────────────────────────────────────── */

function collectCdnImageFileIds(): Set<string> {
  const ids = new Set<string>();
  for (const img of queryAllWithFallback('cdn_image', {})) {
    const src = (img as HTMLImageElement).src;
    const m = src?.match(/[?&]id=(file_[a-z0-9]+)/i);
    if (m && m[1]) ids.add(m[1]);
  }
  return ids;
}

async function waitForNewCdnImages(
  baseline: Set<string>,
  timeoutMs: number,
): Promise<{ ok: true; urls: string[] } | { ok: false; error: string }> {
  const deadline = Date.now() + timeoutMs;
  const pollMs = 500;
  // Heartbeat: nếu indicator "Generating" tắt > heartbeatMs mà chưa có ảnh → fail sớm.
  const heartbeatMs = 60_000;
  let lastActive = Date.now();
  let seenIndicator = false;

  while (Date.now() < deadline) {
    checkAbort('wait_cdn_image');
    const fresh = new Map<string, string>();
    for (const img of queryAllWithFallback('cdn_image', {})) {
      const imgEl = img as HTMLImageElement;
      if (!imgEl.src) continue;
      if (imgEl.classList.contains('blur-2xl')) continue; // placeholder
      const m = imgEl.src.match(/[?&]id=(file_[a-z0-9]+)/i);
      if (!m || !m[1]) continue;
      const fileId = m[1];
      if (baseline.has(fileId)) continue;
      if (!fresh.has(fileId)) fresh.set(fileId, imgEl.src);
    }

    const generating = !!queryWithFallback('generating_indicator', { silent: true });
    if (generating) {
      seenIndicator = true;
      lastActive = Date.now();
    }

    // Done: có ảnh mới + KHÔNG còn generating indicator (gen xong cho NEW image).
    if (fresh.size > 0 && !generating) {
      return { ok: true, urls: Array.from(fresh.values()) };
    }

    // Heartbeat stuck check.
    if (seenIndicator && !generating && Date.now() - lastActive > heartbeatMs) {
      return { ok: false, error: 'IMAGE_GEN_FAILED' };
    }

    await sleep(pollMs);
  }
  return { ok: false, error: 'TIMEOUT' };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ─── Navigate tracking ────────────────────────────────────────────────── */

function watchNavigation(): void {
  // ChatGPT là SPA — pushState không trigger reload. Listen pushState +
  // popstate để báo background invalidate image mode cache.
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  const notify = () => {
    try {
      chrome.runtime.sendMessage({
        action: 'chatgpt:navigated',
        url: location.href,
      });
    } catch {
      /* extension reloaded — ignore */
    }
  };
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    origPush.apply(this, args);
    notify();
  };
  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    origReplace.apply(this, args);
    notify();
  };
  window.addEventListener('popstate', notify);
}

/* ─── Bootstrap ───────────────────────────────────────────────────────── */

async function bootstrap(): Promise<void> {
  console.info('[h2flow:chatgpt] content script loaded @', location.href);
  loadConfigs();
  watchConfigChanges();
  watchAbortFlag();
  watchNavigation();

  chrome.runtime.onMessage.addListener(
    (request: ContentRequest, _sender, sendResponse: (resp?: ContentResponse) => void) => {
      handleMessage(request)
        .then((resp) => sendResponse(resp))
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          sendResponse({ success: false, error: message });
        });
      // Return true để giữ message channel mở cho async response.
      return true;
    },
  );
}

/* ─── Test exports (test-only — import trong test files) ─────────────── */

export const __test = {
  reset() {
    _configCache = null;
    _configCacheAt = 0;
    _abortCache = false;
  },
  setConfigCache(bundle: ProviderConfigBundle) {
    _configCache = bundle;
    _configCacheAt = Date.now();
  },
  setAbort(active: boolean) {
    _abortCache = active;
  },
};

export type { ProviderConfigBundle };

/* ─── Bootstrap invocation (cuối file để mọi let declared trước khi chạy) ─── */

if (window.__h2flowChatGPTLoaded__) {
  console.warn('[h2flow:chatgpt] content script đã load — skip');
} else {
  window.__h2flowChatGPTLoaded__ = true;
  void bootstrap();
}
