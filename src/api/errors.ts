/**
 * api/errors.ts — Typed ApiError class.
 *
 * Layer: API
 * Owner: api
 *
 * Throw on any failed API call so call sites can branch on `.code` and
 * `.httpStatus` instead of inspecting raw envelopes.
 */

import type { ApiErrorCode, ApiFailure } from '@/types/api.types';

export class ApiError extends Error {
  readonly code: ApiErrorCode | string;
  readonly httpStatus: number;
  readonly details: Record<string, string[]> | null;
  readonly serverData: Record<string, unknown>;
  readonly retryAfter?: number;
  readonly exception: string | null;

  constructor(failure: ApiFailure) {
    super(failure.error.message);
    this.name = 'ApiError';
    this.code = failure.error.code;
    this.httpStatus = failure.httpStatus;
    this.details = failure.error.details ?? null;
    this.serverData = failure.data ?? {};
    this.retryAfter = failure.retry_after;
    this.exception = failure.error.exception ?? null;
  }
}

/**
 * Synthesize an ApiError when the request never reached the server
 * (network error, no background response, etc.).
 */
export function networkError(message: string): ApiError {
  return new ApiError({
    success: false,
    httpStatus: 0,
    error: { code: 'NETWORK_ERROR', message },
  });
}

export function backgroundUnavailable(): ApiError {
  return new ApiError({
    success: false,
    httpStatus: 0,
    error: { code: 'NO_BACKGROUND_RESPONSE', message: 'No response from background script' },
  });
}
