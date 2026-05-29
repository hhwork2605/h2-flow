// @vitest-environment jsdom
/**
 * chatgpt.test.ts — unit tests cho content script helpers (P4.1b).
 *
 * Test strategy:
 *   - jsdom env cho `document.querySelector`.
 *   - Mock `chrome.storage.local` + `chrome.runtime` thành in-memory.
 *   - Skip bootstrap bằng cách set `window.__h2flowChatGPTLoaded__ = true`
 *     TRƯỚC khi import module (bootstrap chỉ chạy nếu flag chưa set).
 *
 * Acceptance criteria P4.1b:
 *  - getSelectorsForKey trả [] khi chưa có config
 *  - getSelectorsForKey trả selectors array đúng provider+key
 *  - queryWithFallback match selector đầu tiên valid
 *  - queryWithFallback skip selector invalid (throw exception)
 *  - queryAllWithFallback trả nhiều elements từ selector match
 *  - waitForElement resolve khi element xuất hiện sau delay
 *  - waitForElement reject sau timeout
 *  - waitForElement reject khi AbortSignal fire
 *  - simulateClick dispatch full pointer chain
 *  - checkAbort throw khi flag set
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* ─── Mock chrome API trước khi import module ────────────────────────── */

interface FakeChromeStorage {
  data: Record<string, unknown>;
  listeners: Array<
    (changes: Record<string, { newValue: unknown }>, area: string) => void
  >;
}

function makeFakeChrome() {
  const storage: FakeChromeStorage = { data: {}, listeners: [] };
  const messageListeners: Array<(req: unknown, sender: unknown, send: (r?: unknown) => void) => boolean | void> = [];
  return {
    storage,
    messageListeners,
    chrome: {
      storage: {
        local: {
          get: vi.fn((keys: string[], cb: (res: Record<string, unknown>) => void) => {
            const out: Record<string, unknown> = {};
            for (const k of keys) out[k] = storage.data[k];
            queueMicrotask(() => cb(out));
          }),
          set: vi.fn((obj: Record<string, unknown>, cb?: () => void) => {
            const changes: Record<string, { newValue: unknown }> = {};
            for (const [k, v] of Object.entries(obj)) {
              storage.data[k] = v;
              changes[k] = { newValue: v };
            }
            queueMicrotask(() => {
              for (const l of storage.listeners) l(changes, 'local');
              cb?.();
            });
          }),
        },
        onChanged: {
          addListener: (
            fn: (changes: Record<string, { newValue: unknown }>, area: string) => void,
          ) => storage.listeners.push(fn),
        },
      },
      runtime: {
        sendMessage: vi.fn(),
        onMessage: {
          addListener: (
            fn: (req: unknown, sender: unknown, send: (r?: unknown) => void) => boolean | void,
          ) => messageListeners.push(fn),
        },
      },
    },
  };
}

let fakeChrome: ReturnType<typeof makeFakeChrome>;

beforeAll(() => {
  // Prevent bootstrap auto-run on first import.
  (window as unknown as { __h2flowChatGPTLoaded__: boolean }).__h2flowChatGPTLoaded__ = true;
  // jsdom thiếu PointerEvent — polyfill = MouseEvent. Production có sẵn.
  if (typeof globalThis.PointerEvent === 'undefined') {
    (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
  }
});

beforeEach(() => {
  fakeChrome = makeFakeChrome();
  (globalThis as unknown as { chrome: unknown }).chrome = fakeChrome.chrome;
});

afterEach(() => {
  document.body.innerHTML = '';
});

/* ─── Tests ──────────────────────────────────────────────────────────── */

describe('getSelectorsForKey', () => {
  it('returns [] when no config in storage', async () => {
    const { getSelectorsForKey, __test } = await import('./chatgpt');
    __test.reset();
    expect(getSelectorsForKey('prompt_textarea')).toEqual([]);
  });

  it('returns selectors array from injected cache', async () => {
    const { getSelectorsForKey, __test } = await import('./chatgpt');
    __test.reset();
    __test.setConfigCache({
      data: {
        chatgpt: {
          selectors: {
            prompt_textarea: { selectors: ['#prompt', 'textarea[data-id="prompt"]'] },
          },
        },
      },
    });
    expect(getSelectorsForKey('prompt_textarea')).toEqual([
      '#prompt',
      'textarea[data-id="prompt"]',
    ]);
  });
});

describe('queryWithFallback', () => {
  it('returns first matching element', async () => {
    const { queryWithFallback, __test } = await import('./chatgpt');
    __test.reset();
    __test.setConfigCache({
      data: { chatgpt: { selectors: { btn: { selectors: ['.miss', 'button.go'] } } } },
    });
    document.body.innerHTML = '<button class="go">click me</button>';
    const el = queryWithFallback('btn', { silent: true });
    expect(el).not.toBeNull();
    expect((el as HTMLElement).className).toBe('go');
  });

  it('skips invalid selectors without throwing', async () => {
    const { queryWithFallback, __test } = await import('./chatgpt');
    __test.reset();
    __test.setConfigCache({
      data: {
        chatgpt: {
          selectors: { btn: { selectors: ['>>> invalid <<<', 'button.real'] } },
        },
      },
    });
    document.body.innerHTML = '<button class="real">x</button>';
    const el = queryWithFallback('btn', { silent: true });
    expect((el as HTMLElement).className).toBe('real');
  });

  it('returns null when no selector matches', async () => {
    const { queryWithFallback, __test } = await import('./chatgpt');
    __test.reset();
    __test.setConfigCache({
      data: { chatgpt: { selectors: { btn: { selectors: ['.absent'] } } } },
    });
    expect(queryWithFallback('btn', { silent: true })).toBeNull();
  });
});

describe('queryAllWithFallback', () => {
  it('returns array of elements from matching selector', async () => {
    const { queryAllWithFallback, __test } = await import('./chatgpt');
    __test.reset();
    __test.setConfigCache({
      data: { chatgpt: { selectors: { items: { selectors: ['.miss', 'li.item'] } } } },
    });
    document.body.innerHTML = '<li class="item">a</li><li class="item">b</li>';
    const els = queryAllWithFallback('items');
    expect(els).toHaveLength(2);
  });

  it('returns [] when none match', async () => {
    const { queryAllWithFallback, __test } = await import('./chatgpt');
    __test.reset();
    __test.setConfigCache({
      data: { chatgpt: { selectors: { items: { selectors: ['.absent'] } } } },
    });
    expect(queryAllWithFallback('items')).toEqual([]);
  });
});

describe('waitForElement', () => {
  it('resolves when element appears after delay', async () => {
    const { waitForElement, __test } = await import('./chatgpt');
    __test.reset();
    __test.setConfigCache({
      data: { chatgpt: { selectors: { late: { selectors: ['.late'] } } } },
    });
    // Insert after 100ms.
    setTimeout(() => {
      document.body.innerHTML = '<div class="late">found</div>';
    }, 100);
    const el = await waitForElement('late', { timeoutMs: 1000, pollMs: 50 });
    expect(el).not.toBeNull();
  });

  it('rejects after timeout', async () => {
    const { waitForElement, __test } = await import('./chatgpt');
    __test.reset();
    __test.setConfigCache({
      data: { chatgpt: { selectors: { never: { selectors: ['.never'] } } } },
    });
    await expect(
      waitForElement('never', { timeoutMs: 200, pollMs: 50 }),
    ).rejects.toThrow(/timeout/);
  });

  it('rejects when AbortSignal fires', async () => {
    const { waitForElement, __test } = await import('./chatgpt');
    __test.reset();
    __test.setConfigCache({
      data: { chatgpt: { selectors: { never: { selectors: ['.never'] } } } },
    });
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 100);
    await expect(
      waitForElement('never', { timeoutMs: 5000, pollMs: 50, signal: ac.signal }),
    ).rejects.toThrow(/ABORTED/);
  });
});

describe('simulateClick', () => {
  it('dispatches full pointer + click chain', async () => {
    const { simulateClick } = await import('./chatgpt');
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    const events: string[] = [];
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
      btn.addEventListener(type, () => events.push(type));
    });
    simulateClick(btn);
    expect(events).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
  });
});

describe('checkAbort', () => {
  it('throws when abort flag set', async () => {
    const { checkAbort, __test } = await import('./chatgpt');
    __test.reset();
    __test.setAbort(true);
    expect(() => checkAbort('test-stage')).toThrow(/ABORTED:test-stage/);
  });

  it('is no-op when abort flag false', async () => {
    const { checkAbort, __test } = await import('./chatgpt');
    __test.reset();
    __test.setAbort(false);
    expect(() => checkAbort('test-stage')).not.toThrow();
  });
});

/* ─── P4.1c submit flow helpers via dispatchMessage ───────────────────── */

describe('submitPrompt flow (P4.1c)', () => {
  /**
   * Helper: invoke message handler trực tiếp qua addListener registration.
   * Mỗi test setup: load chatgpt module → addListener đăng ký handler →
   * invoke handler thủ công + assert.
   *
   * Vì bootstrap đã skip ở beforeAll (inject guard set), chúng ta gọi handler
   * qua re-import + tự register listener.
   */
  type Handler = (
    req: { action: string; payload?: unknown },
    sender: unknown,
    send: (r?: unknown) => void,
  ) => boolean | void;

  // Wrapper utility to invoke handler async.
  function invokeHandler(
    handlers: Handler[],
    request: { action: string; payload?: unknown },
  ): Promise<{ success: boolean; error?: string; data?: unknown }> {
    return new Promise((resolve) => {
      const handler = handlers[0]!;
      handler(request, {}, (resp) => resolve(resp as never));
    });
  }

  async function setupHandlers() {
    // Reset module cache + inject guard để bootstrap re-chạy với chrome stub mới.
    vi.resetModules();
    (window as unknown as { __h2flowChatGPTLoaded__: boolean }).__h2flowChatGPTLoaded__ = false;
    const mod = await import('./chatgpt');
    const { __test } = mod;
    __test.reset();
    // Chờ microtask của bootstrap chạy + register listener.
    await new Promise((r) => setTimeout(r, 10));
    const handlers = fakeChrome.messageListeners as unknown as Handler[];
    return { __test, handlers, mod };
  }

  beforeEach(() => {
    (window as unknown as { __h2flowChatGPTLoaded__?: boolean }).__h2flowChatGPTLoaded__ = false;
  });

  it('ping returns loaded=true', async () => {
    const { handlers } = await setupHandlers();
    const resp = await invokeHandler(handlers, { action: 'chatgpt:ping' });
    expect(resp.success).toBe(true);
    expect((resp.data as { loaded: boolean }).loaded).toBe(true);
  });

  it('checkLogin returns NOT_LOGGED_IN khi không có textarea', async () => {
    const { handlers, __test } = await setupHandlers();
    __test.setConfigCache({
      data: {
        chatgpt: {
          selectors: {
            prompt_textarea: { selectors: ['#absent'] },
            login_button: { selectors: ['.login'] },
          },
        },
      },
    });
    document.body.innerHTML = '<a class="login">Sign in</a>';
    const resp = await invokeHandler(handlers, { action: 'chatgpt:checkLogin' });
    expect((resp.data as { ready: boolean }).ready).toBe(false);
    expect(resp.error).toBe('NOT_LOGGED_IN');
  });

  it('checkLogin returns ready=true khi có textarea + KHÔNG có login button', async () => {
    const { handlers, __test } = await setupHandlers();
    __test.setConfigCache({
      data: {
        chatgpt: {
          selectors: {
            prompt_textarea: { selectors: ['#prompt-textarea'] },
            login_button: { selectors: ['.login'] },
          },
        },
      },
    });
    document.body.innerHTML = '<div id="prompt-textarea" contenteditable></div>';
    const resp = await invokeHandler(handlers, { action: 'chatgpt:checkLogin' });
    expect((resp.data as { ready: boolean }).ready).toBe(true);
  });

  it('cancel clicks stop button when found', async () => {
    const { handlers, __test } = await setupHandlers();
    __test.setConfigCache({
      data: {
        chatgpt: {
          selectors: { stop_button: { selectors: ['button.stop'] } },
        },
      },
    });
    document.body.innerHTML = '<button class="stop">Stop</button>';
    let clicked = false;
    document.querySelector('button.stop')!.addEventListener('click', () => {
      clicked = true;
    });
    const resp = await invokeHandler(handlers, { action: 'chatgpt:cancel' });
    expect(resp.success).toBe(true);
    expect((resp.data as { stopped: boolean }).stopped).toBe(true);
    expect(clicked).toBe(true);
  });

  it('cancel returns stopped=false khi không có stop button', async () => {
    const { handlers, __test } = await setupHandlers();
    __test.setConfigCache({
      data: {
        chatgpt: {
          selectors: { stop_button: { selectors: ['button.absent'] } },
        },
      },
    });
    const resp = await invokeHandler(handlers, { action: 'chatgpt:cancel' });
    expect(resp.success).toBe(true);
    expect((resp.data as { stopped: boolean }).stopped).toBe(false);
  });

  it('submitPrompt EMPTY_TEXT khi text rỗng', async () => {
    const { handlers } = await setupHandlers();
    const resp = await invokeHandler(handlers, {
      action: 'chatgpt:submitPrompt',
      payload: { text: '' },
    });
    expect(resp.success).toBe(false);
    expect(resp.error).toBe('EMPTY_TEXT');
  });

  it('UNKNOWN_ACTION cho action không hỗ trợ', async () => {
    const { handlers } = await setupHandlers();
    const resp = await invokeHandler(handlers, { action: 'chatgpt:noSuchAction' });
    expect(resp.success).toBe(false);
    expect(resp.error).toBe('UNKNOWN_ACTION');
  });
});
