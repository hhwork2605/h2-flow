/**
 * messages.types.ts — chrome.runtime message contracts.
 *
 * Layer: Types
 * Owner: shared
 *
 * Background script is the single proxy for HTTP: every API call from sidebar
 * / popup / content scripts goes through `apiRequest`. Shape matches
 * reference-ext/background.js so the wire format is stable.
 */

import type { ApiEnvelope } from './api.types';

/**
 * Generic API call forwarded to background. `endpoint` is the path under
 * `apiBaseUrl` (no leading slash needed). `token` is forwarded as Bearer if
 * the call needs auth (background does NOT read it from storage to keep the
 * sidebar in control of session state during login/register/logout).
 */
export interface ApiRequestMessage {
  action: 'apiRequest';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  data?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  /** Override apiBaseUrl for this single call. Used by the self-heal probe. */
  apiBaseUrl?: string;
}

export interface PingMessage {
  action: 'ping';
}

/** Sidebar tells background "I'm authenticated now". Background can use this
 *  to bootstrap SSE / enrollment refresh. */
export interface AuthChangedMessage {
  action: 'auth:changed';
  hasToken: boolean;
}

/** OAuth bridge content script → background. Background writes `af_auth`,
 *  the sidebar's storage listener picks it up. */
export interface AuthGoogleCallbackMessage {
  action: 'auth:google-callback';
  token: string;
  user: unknown; // shape verified by background before persisting
}

export type ExtensionMessage =
  | ApiRequestMessage
  | PingMessage
  | AuthChangedMessage
  | AuthGoogleCallbackMessage;

/** Response shape for `apiRequest`. */
export type ApiResponseMessage<T = unknown> = ApiEnvelope<T>;
