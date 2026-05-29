/**
 * chatgpt.types.ts — Message contracts giữa sidebar / background / content
 * script cho ChatGPT integration.
 *
 * Layer: Types
 * Owner: providers/sessions
 *
 * Reference: `reference-ext/src/core/ChatGPTSession.js` + `chat-content-chatgpt.js`.
 * Naming convention: action prefix `chatgpt:` để tách bạch với các provider khác.
 */

/* ─── Ratio (image generation) ───────────────────────────────────────── */

export type ChatGPTRatio = 'story' | 'portrait' | 'square' | 'landscape' | 'widescreen';

/** Aria-label tương ứng trong UI ChatGPT (xem `background.js ARIA_LABEL_MAP`). */
export const CHATGPT_RATIO_TO_ARIA: Record<ChatGPTRatio, string> = {
  story: '9:16',
  portrait: '3:4',
  square: '1:1',
  landscape: '4:3',
  widescreen: '16:9',
};

export const VALID_CHATGPT_RATIOS: ChatGPTRatio[] = [
  'story',
  'portrait',
  'square',
  'landscape',
  'widescreen',
];

/* ─── Submission options ─────────────────────────────────────────────── */

export interface ChatGPTSubmitOptions {
  /** Văn bản prompt. Bắt buộc. */
  text: string;
  /** Tỉ lệ ảnh (chỉ image mode). */
  ratio?: ChatGPTRatio;
  /** Mode: image (Create image) | text (LLM text-only). */
  mode?: 'image' | 'text';
  /**
   * Strategy khi không bật được image mode:
   *  - 'auto': thử activate, nếu fail → fallback prefix "Generate an image of: …"
   *  - 'always': luôn dùng prefix (skip activate)
   *  - 'never': bắt buộc activate, fail thì throw
   */
  useFallbackPrefix?: 'auto' | 'always' | 'never';
  /** Reference image file IDs (đã upload via tRPC trước đó). */
  refFileIds?: string[];
  /** Abort signal — caller hold để cancel. */
  signal?: AbortSignal;
  /** Timeout overall (ms). Mặc định 120s. */
  timeoutMs?: number;
}

export interface ChatGPTSubmitResult {
  /** URL ảnh (CDN ChatGPT) — image mode. */
  imageUrls?: string[];
  /** Văn bản phản hồi — text mode. */
  text?: string;
  /** Đã rơi vào fallback prefix mode không. */
  usedFallbackPrefix: boolean;
  /** Tổng thời gian (ms). */
  durationMs: number;
}

/* ─── Error codes (theo `reference-ext`) ──────────────────────────────── */

export type ChatGPTErrorCode =
  | 'NO_TAB'
  | 'TAB_CLOSED'
  | 'NOT_LOGGED_IN'
  | 'INJECT_FAILED'
  | 'ACTIVATE_FAILED'
  | 'RATE_LIMIT'
  | 'CONTENT_BLOCKED'
  | 'IMAGE_GEN_FAILED'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'FALLBACK_PREFIX_ACTIVE'
  | 'CHALLENGE_REQUIRED'
  | 'UNKNOWN';

export class ChatGPTError extends Error {
  code: ChatGPTErrorCode;
  constructor(code: ChatGPTErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ChatGPTError';
    this.code = code;
  }
}

/* ─── Background ↔ Content script message protocol ───────────────────── */

/**
 * Sidebar → Background actions. Background sẽ forward / xử lý qua chrome.tabs +
 * chrome.scripting API hoặc gọi back vào content script qua chrome.tabs.sendMessage.
 */
export type ChatGPTBgAction =
  | 'chatgpt:findOrCreateTab'
  | 'chatgpt:ensureActive'
  | 'chatgpt:injectScript'
  | 'chatgpt:checkLogin'
  | 'chatgpt:activateImageMode'
  | 'chatgpt:selectRatio'
  | 'chatgpt:submitPrompt'
  | 'chatgpt:cancel'
  | 'chatgpt:uploadRefImages'
  | 'chatgpt:deactivateImageMode';

export interface ChatGPTBgRequest<P = unknown> {
  action: ChatGPTBgAction;
  tabId?: number;
  payload?: P;
}

export interface ChatGPTBgResponse<R = unknown> {
  success: boolean;
  error?: ChatGPTErrorCode | string;
  tabId?: number;
  data?: R;
  /** Một số response có flag riêng (vd: activated, ratioControlAvailable). */
  activated?: boolean;
  ratioControlAvailable?: boolean;
  ready?: boolean;
}

/**
 * Background → Sidebar broadcast events (chrome.runtime broadcast).
 * Sidebar subscribe qua chrome.runtime.onMessage.
 */
export type ChatGPTBroadcast =
  | { action: 'chatgpt:tabClosed'; tabId: number }
  | { action: 'chatgpt:navigatedBroadcast'; tabId: number; url: string }
  | { action: 'chatgpt:loginStateChanged'; tabId: number; loggedIn: boolean }
  | { action: 'chatgpt:challengeDetected'; tabId: number };

/* ─── Session event bus (sidebar-side) ───────────────────────────────── */

export type ChatGPTEventName =
  | 'ready'
  | 'error'
  | 'login_required'
  | 'image_mode_activated'
  | 'fallback_mode_entered'
  | 'submit_started'
  | 'submit_progress'
  | 'submit_completed';

export interface ChatGPTEventMap {
  ready: { tabId: number };
  error: { error: ChatGPTErrorCode | string };
  login_required: { tabId: number };
  image_mode_activated: { ratioControlAvailable: boolean };
  fallback_mode_entered: { untilMs: number };
  submit_started: { promptLength: number };
  submit_progress: { stage: string };
  submit_completed: { imageUrls?: string[]; text?: string };
}
