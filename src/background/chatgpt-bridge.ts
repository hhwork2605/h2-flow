/**
 * background/chatgpt-bridge.ts — Background handler cho `chatgpt:*` actions.
 *
 * Layer: Infra (Service Worker)
 * Owner: background
 *
 * Trách nhiệm (mirror `reference-ext/background.js` cho ChatGPT):
 *  - Quản lý tab chatgpt.com: find/create + activate + cleanup khi closed.
 *  - Relay messages từ sidebar → content script qua `chrome.tabs.sendMessage`.
 *  - Broadcast events từ content script → sidebar (tab closed, navigated).
 *
 * Phase 4 P4.1d scope:
 *  - Handlers: findOrCreateTab, ensureActive, injectScript (verify-by-ping),
 *    checkLogin, activateImageMode, selectRatio, submitPrompt, cancel.
 *  - Tab lifecycle: `chrome.tabs.onRemoved` → broadcast `chatgpt:tabClosed`.
 *  - Content navigated event: nhận `chatgpt:navigated` từ content → re-broadcast
 *    thành `chatgpt:navigatedBroadcast`.
 *
 * Content script đã đăng ký static qua `manifest.config.ts content_scripts`
 * cho `*://chatgpt.com/*` → KHÔNG cần `chrome.scripting.executeScript` manual.
 * Verify-by-ping đủ: nếu content chưa response → đợi page load xong.
 */

const CHATGPT_URL = 'https://chatgpt.com/';
const TAB_QUERY_PATTERN = '*://chatgpt.com/*';
const PING_TIMEOUT_MS = 8_000;
const PING_RETRY_INTERVAL_MS = 400;

/* ─── Types ───────────────────────────────────────────────────────────── */

export type ChatGPTBgAction =
  | 'chatgpt:findOrCreateTab'
  | 'chatgpt:ensureActive'
  | 'chatgpt:injectScript'
  | 'chatgpt:checkLogin'
  | 'chatgpt:activateImageMode'
  | 'chatgpt:selectRatio'
  | 'chatgpt:submitPrompt'
  | 'chatgpt:cancel'
  | 'chatgpt:navigated'; // FROM content script (in-bound only)

export interface ChatGPTBgRequest {
  action: ChatGPTBgAction;
  tabId?: number;
  payload?: unknown;
  url?: string;
}

export interface ChatGPTBgResponse<T = unknown> {
  success: boolean;
  error?: string;
  tabId?: number;
  ready?: boolean;
  activated?: boolean;
  ratioControlAvailable?: boolean;
  data?: T;
}

/* ─── Chrome API surface (injectable cho test) ───────────────────────── */

export interface ChromeBgSurface {
  tabs: {
    query: typeof chrome.tabs.query;
    create: typeof chrome.tabs.create;
    update: typeof chrome.tabs.update;
    sendMessage: typeof chrome.tabs.sendMessage;
    onRemoved: typeof chrome.tabs.onRemoved;
  };
  windows: {
    update: typeof chrome.windows.update;
  };
  runtime: {
    sendMessage: typeof chrome.runtime.sendMessage;
    lastError?: typeof chrome.runtime.lastError;
  };
}

function getChromeApi(): ChromeBgSurface | null {
  if (typeof chrome === 'undefined') return null;
  if (!chrome.tabs || !chrome.windows || !chrome.runtime) return null;
  return chrome as unknown as ChromeBgSurface;
}

/* ─── Public entry ────────────────────────────────────────────────────── */

let _registered = false;

/**
 * Đăng ký listener cho `chrome.tabs.onRemoved` để broadcast `chatgpt:tabClosed`
 * tới sidebar. Gọi 1 lần ở `background/index.ts` boot.
 */
export function registerChatGPTBridge(api?: ChromeBgSurface): void {
  if (_registered) return;
  const chromeApi = api ?? getChromeApi();
  if (!chromeApi) {
    console.warn('[h2flow:bg:chatgpt] chrome API unavailable — skip register');
    return;
  }
  _registered = true;
  chromeApi.tabs.onRemoved.addListener((tabId) => {
    void broadcast(chromeApi, { action: 'chatgpt:tabClosed', tabId });
  });
}

/**
 * Dispatch `chatgpt:*` request từ sidebar. Returns response sẽ gửi lại sidebar.
 * Gọi từ `background/index.ts` dispatcher.
 */
export async function handleChatGPTBgMessage(
  request: ChatGPTBgRequest,
  api?: ChromeBgSurface,
): Promise<ChatGPTBgResponse> {
  const chromeApi = api ?? getChromeApi();
  if (!chromeApi) {
    return { success: false, error: 'CHROME_API_UNAVAILABLE' };
  }
  try {
    switch (request.action) {
      case 'chatgpt:findOrCreateTab':
        return findOrCreateTab(chromeApi, request);
      case 'chatgpt:ensureActive':
        return ensureActive(chromeApi, request);
      case 'chatgpt:injectScript':
        return verifyByPing(chromeApi, request);

      // Relay actions — forward straight tới content script.
      case 'chatgpt:checkLogin':
      case 'chatgpt:activateImageMode':
      case 'chatgpt:selectRatio':
      case 'chatgpt:submitPrompt':
      case 'chatgpt:cancel':
        return relay(chromeApi, request);

      // Inbound từ content script — relay broadcast tới sidebar.
      case 'chatgpt:navigated': {
        await broadcast(chromeApi, {
          action: 'chatgpt:navigatedBroadcast',
          tabId: request.tabId ?? null,
          url: request.url ?? null,
        });
        return { success: true };
      }

      default:
        return { success: false, error: 'UNKNOWN_ACTION' };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[h2flow:bg:chatgpt] dispatch error', message);
    return { success: false, error: message };
  }
}

/* ─── Handlers ────────────────────────────────────────────────────────── */

async function findOrCreateTab(
  api: ChromeBgSurface,
  request: ChatGPTBgRequest,
): Promise<ChatGPTBgResponse> {
  const payload = (request.payload ?? {}) as { createIfMissing?: boolean; activate?: boolean };
  const createIfMissing = payload.createIfMissing ?? true;
  const activate = payload.activate ?? true;

  const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
    api.tabs.query({ url: TAB_QUERY_PATTERN }, (result) => resolve(result ?? []));
  });

  if (tabs.length > 0) {
    const tab = tabs[0]!;
    const tabId = tab.id!;
    if (activate && tab.id) {
      await new Promise<void>((resolve) => {
        api.tabs.update(tabId, { active: true }, () => resolve());
      });
    }
    return { success: true, tabId };
  }

  if (!createIfMissing) {
    return { success: false, error: 'NO_TAB' };
  }

  const newTab = await new Promise<chrome.tabs.Tab>((resolve) => {
    api.tabs.create({ url: CHATGPT_URL, active: activate }, (tab) => resolve(tab));
  });
  return { success: true, tabId: newTab.id };
}

async function ensureActive(
  api: ChromeBgSurface,
  request: ChatGPTBgRequest,
): Promise<ChatGPTBgResponse> {
  if (!request.tabId) return { success: false, error: 'NO_TAB' };
  await new Promise<void>((resolve) => {
    api.tabs.update(request.tabId!, { active: true }, () => resolve());
  });
  const payload = (request.payload ?? {}) as { focusWindow?: boolean };
  if (payload.focusWindow) {
    try {
      const tab = await new Promise<chrome.tabs.Tab>((resolve) => {
        api.tabs.query({ url: TAB_QUERY_PATTERN }, (result) =>
          resolve(result?.[0] ?? ({} as chrome.tabs.Tab)),
        );
      });
      if (tab.windowId) {
        await new Promise<void>((resolve) => {
          api.windows.update(tab.windowId!, { focused: true }, () => resolve());
        });
      }
    } catch {
      /* non-fatal */
    }
  }
  return { success: true };
}

/**
 * Verify content script loaded bằng cách ping. Nếu fail (timeout) → coi như
 * `INJECT_FAILED` — caller có thể retry sau hoặc reload tab.
 *
 * KHÔNG dùng `chrome.scripting.executeScript` để inject thủ công — content
 * script đã static-registered trong manifest cho `*://chatgpt.com/*`.
 */
async function verifyByPing(
  api: ChromeBgSurface,
  request: ChatGPTBgRequest,
): Promise<ChatGPTBgResponse> {
  if (!request.tabId) return { success: false, error: 'NO_TAB' };
  const deadline = Date.now() + PING_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const resp = await sendToTab(api, request.tabId, { action: 'chatgpt:ping' });
    if (resp.success) return { success: true, tabId: request.tabId };
    await new Promise((r) => setTimeout(r, PING_RETRY_INTERVAL_MS));
  }
  return { success: false, error: 'INJECT_FAILED' };
}

async function relay(
  api: ChromeBgSurface,
  request: ChatGPTBgRequest,
): Promise<ChatGPTBgResponse> {
  if (!request.tabId) return { success: false, error: 'NO_TAB' };
  return sendToTab(api, request.tabId, {
    action: request.action,
    payload: request.payload,
  });
}

/* ─── Wire helpers ────────────────────────────────────────────────────── */

interface TabMessage {
  action: string;
  payload?: unknown;
}

function sendToTab(
  api: ChromeBgSurface,
  tabId: number,
  message: TabMessage,
): Promise<ChatGPTBgResponse> {
  return new Promise((resolve) => {
    try {
      api.tabs.sendMessage(tabId, message, (resp: unknown) => {
        const lastErr = api.runtime.lastError;
        if (lastErr) {
          resolve({ success: false, error: lastErr.message ?? 'TAB_MESSAGE_FAIL' });
          return;
        }
        if (!resp) {
          resolve({ success: false, error: 'NO_RESPONSE' });
          return;
        }
        resolve(resp as ChatGPTBgResponse);
      });
    } catch (err) {
      resolve({
        success: false,
        error: err instanceof Error ? err.message : 'SEND_FAIL',
      });
    }
  });
}

function broadcast(api: ChromeBgSurface, message: unknown): Promise<void> {
  return new Promise((resolve) => {
    try {
      api.runtime.sendMessage(message, () => {
        // ignore lastError — sidebar có thể chưa mở
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

/* ─── Test introspection ─────────────────────────────────────────────── */

export const __test = {
  reset() {
    _registered = false;
  },
};
