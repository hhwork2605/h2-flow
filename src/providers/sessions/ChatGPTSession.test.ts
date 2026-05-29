/**
 * ChatGPTSession.test.ts — unit tests cho session class (P4.1a).
 *
 * Test strategy: mock `chrome.runtime.sendMessage` để simulate background
 * responses. KHÔNG cần real browser → chạy nhanh, deterministic.
 *
 * Acceptance criteria covered:
 *  - ensureReady happy path (find tab → activate → inject → check login)
 *  - ensureReady cache hit trong 60s
 *  - ensureReady fail when background no tab
 *  - activateImageMode fallback sau 2 lần fail liên tiếp
 *  - selectRatio tự activate image mode trước
 *  - submitPrompt throws khi ensureReady fail
 *  - submitPrompt fallback prefix khi useFallbackPrefix='always'
 *  - submitPrompt aborts qua AbortController
 *  - cancel no-op khi chưa có tab
 *  - dispose prevents further calls
 *  - Event listener emit + unsubscribe
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTError, type ChatGPTBgResponse } from './chatgpt.types';
import { ChatGPTSession } from './ChatGPTSession';

interface MockMessage {
  action: string;
  tabId?: number;
  payload?: unknown;
}

/** Build a stub chrome API với queue response per action. */
function makeChromeStub() {
  type RespHandler = (msg: MockMessage) => ChatGPTBgResponse;
  const handlers = new Map<string, RespHandler>();
  const calls: MockMessage[] = [];
  const listeners: Array<(msg: unknown) => void> = [];

  const chromeApi = {
    runtime: {
      lastError: undefined as { message: string } | undefined,
      sendMessage: vi.fn(
        (
          message: MockMessage,
          callback: (resp: ChatGPTBgResponse | undefined) => void,
        ) => {
          calls.push(message);
          const handler = handlers.get(message.action);
          const resp = handler
            ? handler(message)
            : { success: false, error: 'NO_HANDLER' };
          // Async để gần với real chrome behaviour.
          queueMicrotask(() => callback(resp));
        },
      ),
      onMessage: {
        addListener: (fn: (msg: unknown) => void) => listeners.push(fn),
      },
    },
  } as unknown as typeof chrome;

  return {
    chromeApi,
    setHandler: (action: string, handler: RespHandler) => handlers.set(action, handler),
    calls,
    /** Simulate background → sidebar broadcast. */
    broadcast: (msg: unknown) => listeners.forEach((l) => l(msg)),
  };
}

/* ─── Helpers cho happy-path stub ────────────────────────────────────── */

function stubReadyPath(stub: ReturnType<typeof makeChromeStub>, tabId = 42) {
  stub.setHandler('chatgpt:findOrCreateTab', () => ({ success: true, tabId }));
  stub.setHandler('chatgpt:ensureActive', () => ({ success: true }));
  stub.setHandler('chatgpt:injectScript', () => ({ success: true }));
  stub.setHandler('chatgpt:checkLogin', () => ({ success: true, ready: true }));
}

describe('ChatGPTSession.ensureReady', () => {
  let stub: ReturnType<typeof makeChromeStub>;
  let session: ChatGPTSession;

  beforeEach(() => {
    stub = makeChromeStub();
    session = new ChatGPTSession({ chromeApi: stub.chromeApi });
  });

  afterEach(() => session.dispose());

  it('returns ready=true and caches tabId on happy path', async () => {
    stubReadyPath(stub);
    const result = await session.ensureReady();
    expect(result.ready).toBe(true);
    expect(result.tabId).toBe(42);
    expect(session._peekState().ready).toBe(true);
  });

  it('cache hit within 60s skips background calls', async () => {
    stubReadyPath(stub);
    await session.ensureReady();
    const firstCallCount = stub.calls.length;
    await session.ensureReady();
    // Cache hit chỉ ensureActive — KHÔNG findOrCreateTab/inject/checkLogin nữa.
    const newCalls = stub.calls.slice(firstCallCount);
    expect(newCalls.every((c) => c.action === 'chatgpt:ensureActive')).toBe(true);
  });

  it('fails with NO_TAB when findOrCreateTab returns no tabId', async () => {
    stub.setHandler('chatgpt:findOrCreateTab', () => ({ success: false }));
    const result = await session.ensureReady();
    expect(result.ready).toBe(false);
    expect(result.error).toBe('NO_TAB');
  });

  it('fails with NOT_LOGGED_IN when checkLogin returns not ready', async () => {
    stub.setHandler('chatgpt:findOrCreateTab', () => ({ success: true, tabId: 1 }));
    stub.setHandler('chatgpt:ensureActive', () => ({ success: true }));
    stub.setHandler('chatgpt:injectScript', () => ({ success: true }));
    stub.setHandler('chatgpt:checkLogin', () => ({ success: true, ready: false }));
    let loginRequiredFired = false;
    session.on('login_required', () => {
      loginRequiredFired = true;
    });
    const result = await session.ensureReady();
    expect(result.ready).toBe(false);
    expect(result.error).toBe('NOT_LOGGED_IN');
    expect(loginRequiredFired).toBe(true);
  });

  it('silent=true skips login_required event', async () => {
    stub.setHandler('chatgpt:findOrCreateTab', () => ({ success: true, tabId: 1 }));
    stub.setHandler('chatgpt:ensureActive', () => ({ success: true }));
    stub.setHandler('chatgpt:injectScript', () => ({ success: true }));
    stub.setHandler('chatgpt:checkLogin', () => ({ success: true, ready: false }));
    let loginRequiredFired = false;
    session.on('login_required', () => {
      loginRequiredFired = true;
    });
    await session.ensureReady({ silent: true });
    expect(loginRequiredFired).toBe(false);
  });
});

describe('ChatGPTSession.activateImageMode', () => {
  let stub: ReturnType<typeof makeChromeStub>;
  let session: ChatGPTSession;

  beforeEach(() => {
    stub = makeChromeStub();
    session = new ChatGPTSession({ chromeApi: stub.chromeApi });
  });

  afterEach(() => session.dispose());

  it('activates image mode and reports ratioControlAvailable', async () => {
    stubReadyPath(stub);
    stub.setHandler('chatgpt:activateImageMode', () => ({
      success: true,
      activated: true,
      ratioControlAvailable: true,
    }));
    await session.ensureReady();
    const result = await session.activateImageMode();
    expect(result.activated).toBe(true);
    expect(result.ratioControlAvailable).toBe(true);
  });

  it('enters fallback prefix mode after 2 consecutive failures', async () => {
    stubReadyPath(stub);
    stub.setHandler('chatgpt:activateImageMode', () => ({
      success: false,
      error: 'ACTIVATE_FAILED',
    }));
    let fallbackEvent: { untilMs: number } | null = null;
    session.on('fallback_mode_entered', (e) => {
      fallbackEvent = e;
    });
    await session.ensureReady();

    await session.activateImageMode(); // fail 1
    expect(session._peekState().fallbackPrefixMode).toBe(false);
    await session.activateImageMode(); // fail 2 → fallback
    expect(session._peekState().fallbackPrefixMode).toBe(true);
    expect(fallbackEvent).not.toBeNull();

    // 3rd call → FALLBACK_PREFIX_ACTIVE without calling background again.
    const callsBefore = stub.calls.length;
    const result = await session.activateImageMode();
    expect(result.error).toBe('FALLBACK_PREFIX_ACTIVE');
    expect(stub.calls.length).toBe(callsBefore); // no extra calls
  });
});

describe('ChatGPTSession.selectRatio', () => {
  let stub: ReturnType<typeof makeChromeStub>;
  let session: ChatGPTSession;

  beforeEach(() => {
    stub = makeChromeStub();
    session = new ChatGPTSession({ chromeApi: stub.chromeApi });
  });

  afterEach(() => session.dispose());

  it('auto-activates image mode if not already active', async () => {
    stubReadyPath(stub);
    stub.setHandler('chatgpt:activateImageMode', () => ({
      success: true,
      activated: true,
      ratioControlAvailable: true,
    }));
    stub.setHandler('chatgpt:selectRatio', () => ({ success: true }));
    await session.ensureReady();
    const result = await session.selectRatio('widescreen');
    expect(result.success).toBe(true);
    // Verify both activate + select were called.
    const actions = stub.calls.map((c) => c.action);
    expect(actions).toContain('chatgpt:activateImageMode');
    expect(actions).toContain('chatgpt:selectRatio');
  });
});

describe('ChatGPTSession.submitPrompt', () => {
  let stub: ReturnType<typeof makeChromeStub>;
  let session: ChatGPTSession;

  beforeEach(() => {
    stub = makeChromeStub();
    session = new ChatGPTSession({ chromeApi: stub.chromeApi });
  });

  afterEach(() => session.dispose());

  it('returns imageUrls on success', async () => {
    stubReadyPath(stub);
    stub.setHandler('chatgpt:activateImageMode', () => ({
      success: true,
      activated: true,
      ratioControlAvailable: true,
    }));
    stub.setHandler('chatgpt:submitPrompt', () => ({
      success: true,
      data: { imageUrls: ['https://cdn.openai.com/abc.png'] },
    }));
    const result = await session.submitPrompt({ text: 'a cat', mode: 'image' });
    expect(result.imageUrls).toEqual(['https://cdn.openai.com/abc.png']);
    expect(result.usedFallbackPrefix).toBe(false);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('throws ChatGPTError when ensureReady fails', async () => {
    stub.setHandler('chatgpt:findOrCreateTab', () => ({ success: false }));
    await expect(
      session.submitPrompt({ text: 'a cat', mode: 'image' }),
    ).rejects.toBeInstanceOf(ChatGPTError);
  });

  it('uses fallback prefix when useFallbackPrefix=always', async () => {
    stubReadyPath(stub);
    let receivedText = '';
    stub.setHandler('chatgpt:submitPrompt', (msg) => {
      receivedText = (msg.payload as { text: string }).text;
      return { success: true, data: { imageUrls: ['x'] } };
    });
    const result = await session.submitPrompt({
      text: 'a cat',
      mode: 'image',
      useFallbackPrefix: 'always',
    });
    expect(result.usedFallbackPrefix).toBe(true);
    expect(receivedText).toMatch(/^Generate an image of: a cat/);
  });

  it('aborts via AbortController', async () => {
    stubReadyPath(stub);
    stub.setHandler('chatgpt:activateImageMode', () => ({
      success: true,
      activated: true,
      ratioControlAvailable: true,
    }));
    // submitPrompt handler "never resolves" — đợi abort.
    stub.setHandler('chatgpt:submitPrompt', () => ({ success: true, data: {} }));
    const ac = new AbortController();
    queueMicrotask(() => ac.abort());
    await expect(
      session.submitPrompt({ text: 'a cat', mode: 'image', signal: ac.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('throws empty prompt', async () => {
    await expect(session.submitPrompt({ text: '   ', mode: 'image' })).rejects.toBeInstanceOf(
      ChatGPTError,
    );
  });
});

describe('ChatGPTSession lifecycle + events', () => {
  it('cancel without tab is no-op (no throw)', async () => {
    const stub = makeChromeStub();
    const session = new ChatGPTSession({ chromeApi: stub.chromeApi });
    await expect(session.cancel()).resolves.toBeUndefined();
    session.dispose();
  });

  it('dispose blocks subsequent calls', async () => {
    const stub = makeChromeStub();
    const session = new ChatGPTSession({ chromeApi: stub.chromeApi });
    session.dispose();
    await expect(session.ensureReady()).rejects.toBeInstanceOf(ChatGPTError);
  });

  it('listener unsubscribe stops further events', async () => {
    const stub = makeChromeStub();
    stubReadyPath(stub);
    const session = new ChatGPTSession({ chromeApi: stub.chromeApi });
    let count = 0;
    const off = session.on('ready', () => count++);
    await session.ensureReady();
    expect(count).toBe(1);
    off();
    // Force re-check by reaching outside cache window.
    // Simulate by resetting cache via tabClosed broadcast.
    stub.broadcast({ action: 'chatgpt:tabClosed', tabId: 42 });
    await session.ensureReady();
    expect(count).toBe(1); // listener removed
    session.dispose();
  });

  it('tabClosed broadcast resets state', async () => {
    const stub = makeChromeStub();
    stubReadyPath(stub);
    const session = new ChatGPTSession({ chromeApi: stub.chromeApi });
    await session.ensureReady();
    expect(session._peekState().tabId).toBe(42);
    stub.broadcast({ action: 'chatgpt:tabClosed', tabId: 42 });
    expect(session._peekState().tabId).toBeNull();
    expect(session._peekState().ready).toBe(false);
    session.dispose();
  });
});
