/**
 * chatgpt-bridge.test.ts — unit tests cho background ChatGPT handler (P4.1d).
 *
 * Strategy: mock toàn bộ chrome.tabs / chrome.windows / chrome.runtime API.
 * KHÔNG mock real Chrome — chỉ test logic dispatch + flow.
 *
 * Acceptance criteria P4.1d:
 *  - findOrCreateTab returns existing tab khi đã có
 *  - findOrCreateTab tạo tab mới khi missing + createIfMissing=true
 *  - findOrCreateTab NO_TAB khi missing + createIfMissing=false
 *  - ensureActive gọi chrome.tabs.update với active=true
 *  - verifyByPing return success khi content trả về ping resp
 *  - verifyByPing INJECT_FAILED sau timeout
 *  - relay forward checkLogin / submitPrompt sang tab + return content response
 *  - relay NO_TAB khi không có tabId
 *  - onRemoved listener broadcast `chatgpt:tabClosed`
 *  - navigated từ content → broadcast `chatgpt:navigatedBroadcast`
 *  - UNKNOWN_ACTION cho action không hỗ trợ
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __test,
  handleChatGPTBgMessage,
  registerChatGPTBridge,
  type ChromeBgSurface,
} from './chatgpt-bridge';

/* ─── Mock chrome surface ────────────────────────────────────────────── */

interface TabRecord {
  id: number;
  url: string;
  active?: boolean;
  windowId?: number;
}

function makeChromeStub() {
  const tabs: TabRecord[] = [];
  const tabMessages: Array<{ tabId: number; message: unknown }> = [];
  const broadcasts: unknown[] = [];
  const tabRemovedListeners: Array<(tabId: number, info: unknown) => void> = [];
  /** Per-tab response handlers — set qua `setTabResponse(tabId, handler)`. */
  const tabResponseHandlers = new Map<number, (msg: unknown) => unknown>();

  const api = {
    tabs: {
      query: vi.fn((q: chrome.tabs.QueryInfo, cb: (tabs: chrome.tabs.Tab[]) => void) => {
        const result = tabs.filter((t) => {
          if (!q.url) return true;
          const patterns = Array.isArray(q.url) ? q.url : [q.url];
          return patterns.some((p) => {
            const re = new RegExp(
              '^' +
                String(p)
                  .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                  .replace(/\*/g, '.*') +
                '$',
            );
            return re.test(t.url);
          });
        });
        queueMicrotask(() => cb(result as chrome.tabs.Tab[]));
      }),
      create: vi.fn((opts: chrome.tabs.CreateProperties, cb: (tab: chrome.tabs.Tab) => void) => {
        const id = (tabs.length + 1) * 100;
        const tab: TabRecord = {
          id,
          url: opts.url ?? '',
          active: opts.active ?? false,
          windowId: 1,
        };
        tabs.push(tab);
        queueMicrotask(() => cb(tab as unknown as chrome.tabs.Tab));
      }),
      update: vi.fn(
        (tabId: number, props: chrome.tabs.UpdateProperties, cb: (tab: chrome.tabs.Tab) => void) => {
          const tab = tabs.find((t) => t.id === tabId);
          if (tab && props.active !== undefined) tab.active = props.active;
          queueMicrotask(() => cb(tab as unknown as chrome.tabs.Tab));
        },
      ),
      sendMessage: vi.fn((tabId: number, message: unknown, cb: (resp: unknown) => void) => {
        tabMessages.push({ tabId, message });
        const handler = tabResponseHandlers.get(tabId);
        const resp = handler ? handler(message) : undefined;
        queueMicrotask(() => cb(resp));
      }),
      onRemoved: {
        addListener: vi.fn((fn: (tabId: number, info: unknown) => void) => {
          tabRemovedListeners.push(fn);
        }),
      },
    },
    windows: {
      update: vi.fn(
        (
          _windowId: number,
          _props: chrome.windows.UpdateInfo,
          cb?: (w: chrome.windows.Window) => void,
        ) => {
          queueMicrotask(() => cb?.({} as chrome.windows.Window));
        },
      ),
    },
    runtime: {
      sendMessage: vi.fn((message: unknown, cb?: (resp: unknown) => void) => {
        broadcasts.push(message);
        queueMicrotask(() => cb?.(undefined));
      }),
      lastError: undefined as { message: string } | undefined,
    },
  } as unknown as ChromeBgSurface;

  return {
    api,
    tabs,
    tabMessages,
    broadcasts,
    tabRemovedListeners,
    setTabResponse(tabId: number, handler: (msg: unknown) => unknown) {
      tabResponseHandlers.set(tabId, handler);
    },
    addTab(url: string): TabRecord {
      const id = (tabs.length + 1) * 100;
      const tab: TabRecord = { id, url, windowId: 1 };
      tabs.push(tab);
      return tab;
    },
    fireTabRemoved(tabId: number) {
      for (const l of tabRemovedListeners) l(tabId, { isWindowClosing: false });
    },
  };
}

let stub: ReturnType<typeof makeChromeStub>;

beforeEach(() => {
  __test.reset();
  stub = makeChromeStub();
});

afterEach(() => {
  vi.clearAllMocks();
});

/* ─── Tests ──────────────────────────────────────────────────────────── */

describe('findOrCreateTab', () => {
  it('returns existing tab khi đã có chatgpt.com tab', async () => {
    stub.addTab('https://chatgpt.com/');
    const resp = await handleChatGPTBgMessage(
      { action: 'chatgpt:findOrCreateTab', payload: { createIfMissing: false } },
      stub.api,
    );
    expect(resp.success).toBe(true);
    expect(resp.tabId).toBe(100);
  });

  it('creates new tab khi missing + createIfMissing=true', async () => {
    const resp = await handleChatGPTBgMessage(
      { action: 'chatgpt:findOrCreateTab', payload: { createIfMissing: true } },
      stub.api,
    );
    expect(resp.success).toBe(true);
    expect(stub.tabs).toHaveLength(1);
    expect(stub.tabs[0]!.url).toBe('https://chatgpt.com/');
  });

  it('returns NO_TAB khi missing + createIfMissing=false', async () => {
    const resp = await handleChatGPTBgMessage(
      { action: 'chatgpt:findOrCreateTab', payload: { createIfMissing: false } },
      stub.api,
    );
    expect(resp.success).toBe(false);
    expect(resp.error).toBe('NO_TAB');
  });

  it('activates existing tab khi activate=true', async () => {
    stub.addTab('https://chatgpt.com/c/abc');
    await handleChatGPTBgMessage(
      { action: 'chatgpt:findOrCreateTab', payload: { activate: true } },
      stub.api,
    );
    expect(stub.tabs[0]!.active).toBe(true);
  });
});

describe('ensureActive', () => {
  it('returns NO_TAB khi không có tabId', async () => {
    const resp = await handleChatGPTBgMessage({ action: 'chatgpt:ensureActive' }, stub.api);
    expect(resp.success).toBe(false);
    expect(resp.error).toBe('NO_TAB');
  });

  it('sets tab active=true', async () => {
    const tab = stub.addTab('https://chatgpt.com/');
    const resp = await handleChatGPTBgMessage(
      { action: 'chatgpt:ensureActive', tabId: tab.id },
      stub.api,
    );
    expect(resp.success).toBe(true);
    expect(tab.active).toBe(true);
  });
});

describe('verifyByPing (injectScript)', () => {
  it('returns success khi content trả về ping resp', async () => {
    const tab = stub.addTab('https://chatgpt.com/');
    stub.setTabResponse(tab.id, () => ({ success: true, data: { loaded: true } }));
    const resp = await handleChatGPTBgMessage(
      { action: 'chatgpt:injectScript', tabId: tab.id },
      stub.api,
    );
    expect(resp.success).toBe(true);
    expect(resp.tabId).toBe(tab.id);
  });

  it('returns INJECT_FAILED sau timeout (content không respond)', async () => {
    const tab = stub.addTab('https://chatgpt.com/');
    // Không set response handler → trả undefined → mọi ping fail.
    // Test timeout 8s — quá lâu. Override qua patching sendMessage to return error fast.
    stub.api.tabs.sendMessage = vi.fn((_tabId, _msg, cb) => {
      queueMicrotask(() => cb(undefined));
    }) as unknown as typeof chrome.tabs.sendMessage;
    // Vẫn đợi PING_TIMEOUT — chỉ vừa qua loop ~20 iter × 400ms = 8s. Speed up bằng fake timers? Hơi phức tạp. Skip retry loop bằng giảm timeout — nhưng không expose. Bỏ qua test này hoặc chấp nhận chậm 8s.
    // → set short retry để test chạy nhanh: dùng module timer? Khó. Approach khác: pre-fail-loop và check error.
    // Lựa chọn: gấp test với timer thật + nhỏ deadline check ở runtime. Hiện bridge dùng 8s — chấp nhận test mất ~8s.
    const start = Date.now();
    const resp = await handleChatGPTBgMessage(
      { action: 'chatgpt:injectScript', tabId: tab.id },
      stub.api,
    );
    const elapsed = Date.now() - start;
    expect(resp.success).toBe(false);
    expect(resp.error).toBe('INJECT_FAILED');
    // Soft assert thời gian (đảm bảo loop ran nhiều iter).
    expect(elapsed).toBeGreaterThan(2_000);
  }, 15_000);
});

describe('relay actions', () => {
  it('forwards chatgpt:checkLogin to tab', async () => {
    const tab = stub.addTab('https://chatgpt.com/');
    stub.setTabResponse(tab.id, () => ({ success: true, data: { ready: true } }));
    const resp = await handleChatGPTBgMessage(
      { action: 'chatgpt:checkLogin', tabId: tab.id },
      stub.api,
    );
    expect(resp.success).toBe(true);
    expect((resp.data as { ready: boolean }).ready).toBe(true);
    expect(stub.tabMessages[0]!.message).toEqual({
      action: 'chatgpt:checkLogin',
      payload: undefined,
    });
  });

  it('forwards chatgpt:submitPrompt payload', async () => {
    const tab = stub.addTab('https://chatgpt.com/');
    stub.setTabResponse(tab.id, () => ({
      success: true,
      data: { imageUrls: ['https://cdn.openai.com/x.png'] },
    }));
    const resp = await handleChatGPTBgMessage(
      {
        action: 'chatgpt:submitPrompt',
        tabId: tab.id,
        payload: { text: 'a cat', timeoutMs: 60_000 },
      },
      stub.api,
    );
    expect(resp.success).toBe(true);
    expect((stub.tabMessages[0]!.message as { payload: unknown }).payload).toEqual({
      text: 'a cat',
      timeoutMs: 60_000,
    });
  });

  it('returns NO_TAB khi không có tabId', async () => {
    const resp = await handleChatGPTBgMessage({ action: 'chatgpt:cancel' }, stub.api);
    expect(resp.success).toBe(false);
    expect(resp.error).toBe('NO_TAB');
  });
});

describe('navigated broadcast', () => {
  it('relays content chatgpt:navigated → broadcast chatgpt:navigatedBroadcast', async () => {
    const resp = await handleChatGPTBgMessage(
      { action: 'chatgpt:navigated', tabId: 42, url: 'https://chatgpt.com/c/new' },
      stub.api,
    );
    expect(resp.success).toBe(true);
    expect(stub.broadcasts[0]).toEqual({
      action: 'chatgpt:navigatedBroadcast',
      tabId: 42,
      url: 'https://chatgpt.com/c/new',
    });
  });
});

describe('tab onRemoved listener', () => {
  it('broadcasts chatgpt:tabClosed when tab removed', async () => {
    registerChatGPTBridge(stub.api);
    stub.fireTabRemoved(99);
    // Wait for queueMicrotask broadcast.
    await new Promise((r) => setTimeout(r, 5));
    expect(stub.broadcasts[0]).toEqual({ action: 'chatgpt:tabClosed', tabId: 99 });
  });
});

describe('error paths', () => {
  it('UNKNOWN_ACTION cho action không hỗ trợ', async () => {
    const resp = await handleChatGPTBgMessage(
      { action: 'chatgpt:noSuchAction' as never },
      stub.api,
    );
    expect(resp.success).toBe(false);
    expect(resp.error).toBe('UNKNOWN_ACTION');
  });

  it('CHROME_API_UNAVAILABLE khi không truyền api + globalThis.chrome missing', async () => {
    const savedChrome = (globalThis as unknown as { chrome?: unknown }).chrome;
    (globalThis as unknown as { chrome?: unknown }).chrome = undefined;
    const resp = await handleChatGPTBgMessage({ action: 'chatgpt:findOrCreateTab' });
    expect(resp.success).toBe(false);
    expect(resp.error).toBe('CHROME_API_UNAVAILABLE');
    (globalThis as unknown as { chrome?: unknown }).chrome = savedChrome;
  });
});
