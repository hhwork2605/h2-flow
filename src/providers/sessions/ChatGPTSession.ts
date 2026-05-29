/**
 * ChatGPTSession — quản lý 1 tab chat.openai.com / chatgpt.com cho generation.
 *
 * Layer: Service
 * Owner: providers/sessions
 *
 * Port từ `reference-ext/src/core/ChatGPTSession.js` (static singleton class)
 * sang TS instance + AbortSignal. Mỗi P4.1 adapter giữ 1 instance.
 *
 * Responsibilities (mirror reference-ext):
 *  - Tìm/tạo tab ChatGPT qua background (chrome.tabs API).
 *  - Activate tab (Chrome throttle inactive tab → React không tick).
 *  - Inject content script on-demand (KHÔNG static manifest content_scripts
 *    để tránh injection trên non-chat URL).
 *  - Cache login state + image mode 60s (TTL).
 *  - Image mode activation + ratio select. Fallback prefix mode khi
 *    activate fail 2 lần liên tiếp.
 *  - Phát events qua listener (replace `window.eventBus` của reference).
 *
 * Trạng thái non-extension (Phase 4 P4.1a):
 *  - Lớp này CHỈ gọi background qua `chrome.runtime.sendMessage`. KHI chạy
 *    trong web mode (npm run dev:web), background message sẽ fail.
 *  - Test qua vitest mocking chrome API. End-to-end manual với extension thật
 *    sẽ làm ở P4.1e.
 */

import {
  CHATGPT_RATIO_TO_ARIA,
  ChatGPTError,
  type ChatGPTBgAction,
  type ChatGPTBgRequest,
  type ChatGPTBgResponse,
  type ChatGPTErrorCode,
  type ChatGPTEventMap,
  type ChatGPTEventName,
  type ChatGPTRatio,
  type ChatGPTSubmitOptions,
  type ChatGPTSubmitResult,
  VALID_CHATGPT_RATIOS,
} from './chatgpt.types';

const READY_TTL_MS = 60_000;
const FALLBACK_WINDOW_MS = 5 * 60_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const FALLBACK_PREFIX = 'Generate an image of: ';

export interface ChatGPTSessionConfig {
  /** Inject `chrome` cho test (default: globalThis.chrome). */
  chromeApi?: typeof chrome;
}

/**
 * Type guard giúp ép kiểu response.data về type cụ thể mà không cần `as`.
 */
type DataOf<R> = R extends ChatGPTBgResponse<infer D> ? D : never;

export class ChatGPTSession {
  /* ─── State (instance-level — mỗi instance riêng) ─────────────────── */

  private _tabId: number | null = null;
  private _ready = false;
  private _lastReadyCheck = 0;

  private _imageModeActive = false;
  private _currentRatio: ChatGPTRatio | null = null;

  private _activateFailCount = 0;
  private _fallbackPrefixMode = false;
  private _fallbackUntil = 0;

  private _disposed = false;
  private _runtimeListenerBound = false;

  /* ─── Event subscribers ─────────────────────────────────────────────── */

  private _listeners = new Map<ChatGPTEventName, Set<(payload: unknown) => void>>();

  /* ─── Chrome API handle (test injection point) ─────────────────────── */

  private readonly _chrome: typeof chrome | undefined;

  constructor(config: ChatGPTSessionConfig = {}) {
    this._chrome = config.chromeApi ?? (globalThis as { chrome?: typeof chrome }).chrome;
  }

  /* ─── Public API ────────────────────────────────────────────────────── */

  /**
   * Đảm bảo tab sẵn sàng (tìm/tạo + activate + inject + check login).
   * Cache 60s để tránh check liên tục.
   */
  async ensureReady(
    options: { createIfMissing?: boolean; activate?: boolean; silent?: boolean } = {},
  ): Promise<{ ready: boolean; tabId?: number; error?: ChatGPTErrorCode }> {
    this._assertNotDisposed();
    this._bindRuntimeListenerOnce();

    const { createIfMissing = true, activate = true, silent = false } = options;

    // Cache hit
    if (this._ready && this._tabId && Date.now() - this._lastReadyCheck < READY_TTL_MS) {
      if (activate) {
        // Best-effort activate, ignore lỗi.
        await this._sendBg('chatgpt:ensureActive', { tabId: this._tabId }).catch(() => {});
      }
      return { ready: true, tabId: this._tabId };
    }

    try {
      // 1. Find/create tab
      const findResp = await this._sendBg('chatgpt:findOrCreateTab', {
        payload: { createIfMissing, activate },
      });
      if (!findResp.success || !findResp.tabId) {
        const error = (findResp.error as ChatGPTErrorCode) ?? 'NO_TAB';
        this._emit('error', { error });
        return { ready: false, error };
      }
      this._tabId = findResp.tabId;

      // 2. Activate
      if (activate) {
        await this._sendBg('chatgpt:ensureActive', { tabId: this._tabId }).catch((err) => {
          console.warn('[ChatGPTSession] activate failed', err);
        });
      }

      // 3. Inject content script
      const injectResp = await this._sendBg('chatgpt:injectScript', { tabId: this._tabId });
      if (!injectResp.success) {
        const error = (injectResp.error as ChatGPTErrorCode) ?? 'INJECT_FAILED';
        this._emit('error', { error });
        return { ready: false, error, tabId: this._tabId };
      }

      // 4. Check login
      const loginResp = await this._sendBg('chatgpt:checkLogin', { tabId: this._tabId });
      if (!loginResp.success || !loginResp.ready) {
        const error = (loginResp.error as ChatGPTErrorCode) ?? 'NOT_LOGGED_IN';
        if (!silent) {
          if (error === 'NOT_LOGGED_IN') {
            this._emit('login_required', { tabId: this._tabId });
          } else {
            this._emit('error', { error });
          }
        }
        return { ready: false, error, tabId: this._tabId };
      }

      this._ready = true;
      this._lastReadyCheck = Date.now();
      this._emit('ready', { tabId: this._tabId });
      return { ready: true, tabId: this._tabId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ChatGPTSession] ensureReady', message);
      this._emit('error', { error: message });
      return { ready: false, error: 'UNKNOWN' };
    }
  }

  /**
   * Bật image mode. Sau 2 lần fail liên tiếp → bật fallback prefix 5 phút.
   */
  async activateImageMode(): Promise<{
    activated: boolean;
    ratioControlAvailable: boolean;
    error?: ChatGPTErrorCode;
  }> {
    this._assertNotDisposed();

    if (this._fallbackPrefixMode && Date.now() < this._fallbackUntil) {
      return { activated: false, ratioControlAvailable: false, error: 'FALLBACK_PREFIX_ACTIVE' };
    }
    if (this._imageModeActive && this._tabId) {
      return { activated: true, ratioControlAvailable: true };
    }
    if (!this._tabId) {
      return { activated: false, ratioControlAvailable: false, error: 'NO_TAB' };
    }

    try {
      const resp = await this._sendBg('chatgpt:activateImageMode', { tabId: this._tabId });
      if (!resp.success) {
        this._handleActivateFailure();
        return {
          activated: false,
          ratioControlAvailable: false,
          error: (resp.error as ChatGPTErrorCode) ?? 'ACTIVATE_FAILED',
        };
      }
      // Reset fail counter
      this._activateFailCount = 0;
      this._fallbackPrefixMode = false;
      this._fallbackUntil = 0;
      this._imageModeActive = !!resp.activated;
      const ratioControlAvailable = !!resp.ratioControlAvailable;
      if (this._imageModeActive) {
        this._emit('image_mode_activated', { ratioControlAvailable });
      }
      return { activated: this._imageModeActive, ratioControlAvailable };
    } catch (err) {
      this._handleActivateFailure();
      const message = err instanceof Error ? err.message : String(err);
      this._emit('error', { error: message });
      return { activated: false, ratioControlAvailable: false, error: 'ACTIVATE_FAILED' };
    }
  }

  /** Chọn ratio. Tự activate image mode nếu chưa. */
  async selectRatio(ratio: ChatGPTRatio): Promise<{ success: boolean; error?: ChatGPTErrorCode }> {
    this._assertNotDisposed();
    if (!VALID_CHATGPT_RATIOS.includes(ratio)) {
      return { success: false, error: 'UNKNOWN' };
    }
    if (!this._imageModeActive) {
      const act = await this.activateImageMode();
      if (!act.activated) return { success: false, error: act.error };
    }
    if (this._currentRatio === ratio) {
      return { success: true };
    }
    if (!this._tabId) return { success: false, error: 'NO_TAB' };
    const resp = await this._sendBg('chatgpt:selectRatio', {
      tabId: this._tabId,
      payload: { ratio, ariaLabel: CHATGPT_RATIO_TO_ARIA[ratio] },
    });
    if (!resp.success) {
      return { success: false, error: (resp.error as ChatGPTErrorCode) ?? 'UNKNOWN' };
    }
    this._currentRatio = ratio;
    return { success: true };
  }

  /**
   * Submit prompt. Caller hold `signal` từ AbortController để cancel.
   *
   * State machine:
   *   1. ensureReady (cache 60s) → throw nếu fail
   *   2. Determine final text (raw vs fallback prefix vs image-mode native)
   *   3. (optional) upload ref images (defer to P4.1b)
   *   4. submitPrompt → wait CDN image (image mode) hoặc text (text mode)
   *   5. Map response → ChatGPTSubmitResult
   *   6. Cleanup (delete last assistant message) — defer to P4.1c
   */
  async submitPrompt(options: ChatGPTSubmitOptions): Promise<ChatGPTSubmitResult> {
    this._assertNotDisposed();
    const startedAt = Date.now();
    const {
      text,
      ratio,
      mode = 'image',
      useFallbackPrefix = 'auto',
      refFileIds = [],
      signal,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    } = options;

    if (!text.trim()) throw new ChatGPTError('UNKNOWN', 'empty prompt');

    const checkAbort = () => {
      if (signal?.aborted) throw new ChatGPTError('ABORTED');
    };

    checkAbort();
    this._emit('submit_started', { promptLength: text.length });

    // 1. Ensure ready
    const ready = await this.ensureReady();
    if (!ready.ready) throw new ChatGPTError(ready.error ?? 'UNKNOWN');
    checkAbort();

    let usedFallbackPrefix = false;
    let finalText = text;

    // 2. Image mode + ratio (only when mode='image')
    if (mode === 'image') {
      if (useFallbackPrefix === 'always') {
        usedFallbackPrefix = true;
        finalText = FALLBACK_PREFIX + text;
      } else {
        const act = await this.activateImageMode();
        if (!act.activated) {
          if (useFallbackPrefix === 'never') {
            throw new ChatGPTError(act.error ?? 'ACTIVATE_FAILED');
          }
          // auto → use prefix
          usedFallbackPrefix = true;
          finalText = FALLBACK_PREFIX + text;
        } else if (ratio) {
          await this.selectRatio(ratio);
        }
      }
    }
    checkAbort();

    // 3. Upload ref images (P4.1b — defer)
    if (refFileIds.length > 0) {
      console.warn('[ChatGPTSession] ref images upload chưa implement — P4.1b');
    }

    // 4. Submit + wait result (delegate vào content script qua background)
    const submitPromise = this._sendBg('chatgpt:submitPrompt', {
      tabId: this._tabId!,
      payload: { text: finalText, mode, timeoutMs },
    });

    // Race: submit vs abort vs timeout
    const result = await Promise.race([
      submitPromise,
      new Promise<never>((_, reject) => {
        const onAbort = () => reject(new ChatGPTError('ABORTED'));
        signal?.addEventListener('abort', onAbort, { once: true });
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new ChatGPTError('TIMEOUT')), timeoutMs),
      ),
    ]);

    if (!result.success) {
      throw new ChatGPTError(
        (result.error as ChatGPTErrorCode) ?? 'UNKNOWN',
        typeof result.error === 'string' ? result.error : undefined,
      );
    }

    const data = (result.data ?? {}) as { imageUrls?: string[]; text?: string };
    const finalResult: ChatGPTSubmitResult = {
      imageUrls: data.imageUrls,
      text: data.text,
      usedFallbackPrefix,
      durationMs: Date.now() - startedAt,
    };
    this._emit('submit_completed', {
      imageUrls: finalResult.imageUrls,
      text: finalResult.text,
    });
    return finalResult;
  }

  /** Cancel — content script click Stop button + delete last message. */
  async cancel(): Promise<void> {
    if (!this._tabId) return;
    await this._sendBg('chatgpt:cancel', { tabId: this._tabId }).catch(() => {});
  }

  /** Dispose — không gọi background nữa. */
  dispose(): void {
    this._disposed = true;
    this._listeners.clear();
  }

  /* ─── Event subscription ────────────────────────────────────────────── */

  on<K extends ChatGPTEventName>(
    event: K,
    handler: (payload: ChatGPTEventMap[K]) => void,
  ): () => void {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(handler as (payload: unknown) => void);
    return () => set!.delete(handler as (payload: unknown) => void);
  }

  /* ─── Internals ─────────────────────────────────────────────────────── */

  private _emit<K extends ChatGPTEventName>(event: K, payload: ChatGPTEventMap[K]): void {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const h of set) {
      try {
        h(payload);
      } catch (err) {
        console.error(`[ChatGPTSession] listener ${event}`, err);
      }
    }
  }

  private _bindRuntimeListenerOnce(): void {
    if (this._runtimeListenerBound) return;
    if (!this._chrome?.runtime?.onMessage) return;
    this._runtimeListenerBound = true;
    this._chrome.runtime.onMessage.addListener((message: unknown) => {
      if (!message || typeof message !== 'object') return;
      const m = message as { action?: string; tabId?: number };
      if (m.action === 'chatgpt:tabClosed') {
        if (!this._tabId || m.tabId === this._tabId) {
          this._resetCache();
          this._emit('error', { error: 'TAB_CLOSED' });
        }
      } else if (m.action === 'chatgpt:navigatedBroadcast') {
        if (this._tabId && m.tabId === this._tabId) {
          this._imageModeActive = false;
          this._currentRatio = null;
        }
      }
    });
  }

  private _resetCache(): void {
    this._tabId = null;
    this._ready = false;
    this._lastReadyCheck = 0;
    this._imageModeActive = false;
    this._currentRatio = null;
  }

  private _handleActivateFailure(): void {
    this._activateFailCount += 1;
    if (this._activateFailCount >= 2) {
      this._fallbackPrefixMode = true;
      this._fallbackUntil = Date.now() + FALLBACK_WINDOW_MS;
      this._emit('fallback_mode_entered', { untilMs: this._fallbackUntil });
    }
  }

  private _assertNotDisposed(): void {
    if (this._disposed) {
      throw new ChatGPTError('UNKNOWN', 'session disposed');
    }
  }

  /**
   * Gửi message tới background. Returns typed response.
   * KHÔNG tự throw — caller check `success`.
   */
  private _sendBg<A extends ChatGPTBgAction, R = unknown>(
    action: A,
    request: Omit<ChatGPTBgRequest, 'action'> = {},
  ): Promise<ChatGPTBgResponse<DataOf<ChatGPTBgResponse<R>>>> {
    return new Promise((resolve, reject) => {
      if (!this._chrome?.runtime?.sendMessage) {
        // Web mode / no extension — fail clean.
        resolve({
          success: false,
          error: 'NO_TAB',
        });
        return;
      }
      try {
        this._chrome.runtime.sendMessage({ action, ...request }, (resp: unknown) => {
          const lastErr = this._chrome?.runtime.lastError;
          if (lastErr) {
            reject(new Error(lastErr.message ?? 'chrome runtime error'));
            return;
          }
          if (!resp) {
            resolve({ success: false, error: 'NETWORK' });
            return;
          }
          resolve(resp as ChatGPTBgResponse<DataOf<ChatGPTBgResponse<R>>>);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /* ─── Test introspection (test-only — KHÔNG dùng trong production code) ─── */

  /** @internal — for tests. */
  _peekState() {
    return {
      tabId: this._tabId,
      ready: this._ready,
      imageModeActive: this._imageModeActive,
      currentRatio: this._currentRatio,
      activateFailCount: this._activateFailCount,
      fallbackPrefixMode: this._fallbackPrefixMode,
    };
  }
}
