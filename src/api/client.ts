/**
 * api/client.ts — Sidebar / popup facing HTTP client.
 *
 * Layer: API
 * Owner: api
 *
 * Every call goes through the background `apiRequest` proxy so we bypass
 * CORS, centralise HMAC signing, and keep a single audit point. Sidebar code
 * uses `request()` exclusively — never `fetch()` directly.
 */

import type { ApiEnvelope, ApiSuccess, PaginationMeta } from '@/types/api.types';
import type { ApiRequestMessage } from '@/types/messages.types';
import { setCloneDetected } from '@/core/cloneDetection';
import { maybeMockRequest } from './mock';
import { ApiError } from './errors';

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Path under `apiBaseUrl`. Leading slash optional. */
  endpoint: string;
  /** JSON body. Will be `JSON.stringify`-ed by the background. */
  data?: unknown;
  /** Auth token. Pass `null` to make the call explicitly anonymous. */
  token?: string | null;
  /** Extra headers (X-Fingerprint, X-Locale, etc.). */
  headers?: Record<string, string>;
  /** Override apiBaseUrl for this single call (used by self-heal probe). */
  apiBaseUrl?: string;
}

export interface RequestResult<T> {
  data: T;
  meta?: PaginationMeta;
  httpStatus: number;
}

/**
 * Issue an authenticated HTTP request via the background proxy.
 *
 * Throws `ApiError` on any non-2xx response (or network failure). Use
 * `requestRaw()` if you want to inspect the envelope yourself.
 */
export async function request<T = unknown>(opts: RequestOptions): Promise<RequestResult<T>> {
  const env = await requestRaw<T>(opts);
  if (!env.success) throw new ApiError(env);
  return { data: env.data, meta: env.meta, httpStatus: env.httpStatus };
}

/** Like `request` but returns the raw envelope. */
export async function requestRaw<T = unknown>(opts: RequestOptions): Promise<ApiEnvelope<T>> {
  const msg: ApiRequestMessage = {
    action: 'apiRequest',
    method: opts.method,
    endpoint: opts.endpoint,
    data: opts.data,
    token: opts.token ?? null,
    headers: opts.headers,
    apiBaseUrl: opts.apiBaseUrl,
  };
  const env = await dispatchRequest<T>(msg);

  // Anti-clone side-effect: any 403 EXTENSION_NOT_AUTHORIZED flips the
  // global flag which the CloneDetectedOverlay subscribes to. Cleared by
  // the background self-heal probe (alarm) once access is restored.
  if (!env.success && env.error.code === 'EXTENSION_NOT_AUTHORIZED') {
    void setCloneDetected(true);
  }
  return env;
}

/**
 * Choose between the background-proxy path (running as extension) and the
 * in-page mock path (running in a plain browser tab — see "Browser preview
 * mode" in docs/MOCK-API.md).
 */
async function dispatchRequest<T>(msg: ApiRequestMessage): Promise<ApiEnvelope<T>> {
  if (isExtensionContext()) {
    return sendBackgroundRequest<T>(msg);
  }
  // Not in an extension context — call the mock dispatcher directly so the
  // sidebar still works when served at e.g. http://localhost:5173/sidebar.html.
  const mocked = await maybeMockRequest<T>(msg);
  if (mocked) return mocked;
  return {
    success: false,
    httpStatus: 0,
    error: {
      code: 'NETWORK_ERROR',
      message:
        `Cannot reach background or mock for ${msg.method} ${msg.endpoint}. ` +
        `Either run as an extension or enable VITE_USE_MOCK.`,
    },
  };
}

/**
 * `chrome.runtime.id` is undefined in regular web pages but defined inside
 * every extension context (sidebar, popup, content script, background SW).
 * Reading via `globalThis` keeps TypeScript from pre-resolving the chrome
 * type and complaining the value is always defined.
 */
function isExtensionContext(): boolean {
  try {
    const g = globalThis as { chrome?: { runtime?: { id?: string } } };
    return typeof g.chrome?.runtime?.id === 'string';
  } catch {
    return false;
  }
}

function sendBackgroundRequest<T>(msg: ApiRequestMessage): Promise<ApiEnvelope<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response: unknown) => {
      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          httpStatus: 0,
          error: {
            code: 'NO_BACKGROUND_RESPONSE',
            message: chrome.runtime.lastError.message ?? 'No background',
          },
        });
        return;
      }
      if (!response) {
        resolve({
          success: false,
          httpStatus: 0,
          error: {
            code: 'NO_BACKGROUND_RESPONSE',
            message: 'Background returned no response',
          },
        });
        return;
      }
      resolve(response as ApiEnvelope<T>);
    });
  });
}

// Re-export helper for call sites that only care about success.
export type { ApiSuccess };
