/**
 * api.types.ts — HTTP envelope shared between sidebar ↔ background ↔ backend.
 *
 * Layer: Types
 * Owner: api
 *
 * Spec: docs/08-api-contract.md (response envelope + error codes).
 * Behaviour ground truth: reference-ext/background.js apiRequest handler
 * unwraps the HTTP response into {success, data, error, httpStatus, meta?}
 * so sidebar callers don't deal with raw HTTP bodies.
 */

export type ApiErrorCode =
  | 'OK'
  | 'RATE_LIMITED'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'EXTENSION_NOT_AUTHORIZED'
  | 'QUOTA_EXCEEDED'
  | 'GLOBAL_QUOTA_EXCEEDED'
  | 'FEATURE_DISABLED'
  | 'PLAN_EXPIRED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'MAINTENANCE'
  | 'NETWORK_ERROR' // client-synthesized when fetch itself rejects
  | 'NO_BACKGROUND_RESPONSE'
  | 'EMAIL_NOT_VERIFIED';

/**
 * Success envelope returned by `apiRequest` message handler.
 */
export interface ApiSuccess<T = unknown> {
  success: true;
  httpStatus: number;
  data: T;
  meta?: PaginationMeta;
  headers?: Record<string, string>;
}

/**
 * Error envelope returned by `apiRequest` message handler.
 */
export interface ApiFailure {
  success: false;
  httpStatus: number;
  error: {
    code: ApiErrorCode | string;
    message: string;
    details?: Record<string, string[]> | null;
    exception?: string | null;
  };
  data?: Record<string, unknown>;
  retry_after?: number; // seconds, from Retry-After header on 429
  headers?: Record<string, string>;
}

export type ApiEnvelope<T = unknown> = ApiSuccess<T> | ApiFailure;

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}
