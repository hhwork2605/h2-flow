/**
 * background/api-proxy.ts — CORS-free fetch handler for `apiRequest`.
 *
 * Layer: Infra (background)
 * Owner: api
 *
 * Reference: reference-ext/background.js search "case 'apiRequest'".
 * Differences kept INTENTIONALLY:
 *   - Sidebar passes the token (not background) so logout/refresh races are
 *     deterministic.
 *   - HMAC contract follows reference-ext, NOT docs/08 — see request-signer.ts
 *     for the divergence note.
 *   - 401 refresh-retry is handled in the sidebar (auth.store) rather than
 *     background, mirroring how AuthManager._apiCall does it.
 */

import { buildApiUrl } from '@/api/config';
import type { ApiEnvelope, ApiErrorCode } from '@/types/api.types';
import type { ApiRequestMessage } from '@/types/messages.types';
import { maybeMockRequest } from '@/api/mock';
import { buildSignatureHeaders } from './request-signer';

const JSON_HEADER = 'application/json';

export async function handleApiRequest<T = unknown>(
  message: ApiRequestMessage,
): Promise<ApiEnvelope<T>> {
  // Short-circuit to the in-process mock when VITE_USE_MOCK is on. See
  // `src/background/mock/index.ts` and docs/MOCK-API.md.
  const mocked = await maybeMockRequest<T>(message);
  if (mocked) return mocked;

  const url = buildApiUrl(message.endpoint, message.apiBaseUrl);
  const pathname = new URL(url).pathname;
  const bodyStr =
    message.data == null ? '' : typeof message.data === 'string' ? message.data : JSON.stringify(message.data);

  const headers: Record<string, string> = {
    Accept: JSON_HEADER,
    ...(message.headers ?? {}),
  };
  if (bodyStr) headers['Content-Type'] = JSON_HEADER;
  if (message.token) headers['Authorization'] = `Bearer ${message.token}`;

  const sigHeaders = await buildSignatureHeaders(message.method, pathname, bodyStr);
  Object.assign(headers, sigHeaders);

  let response: Response;
  try {
    response = await fetch(url, {
      method: message.method,
      headers,
      body: bodyStr || undefined,
      credentials: 'omit',
    });
  } catch (err) {
    return {
      success: false,
      httpStatus: 0,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error',
      },
    };
  }

  return await parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const headers = Object.fromEntries(response.headers.entries());
  const httpStatus = response.status;

  // Empty body (204 No Content, etc.)
  if (httpStatus === 204) {
    return { success: true, httpStatus, data: undefined as T, headers };
  }

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON (HTML error page, gateway timeout, etc.).
    return {
      success: false,
      httpStatus,
      error: {
        code: mapStatusToCode(httpStatus),
        message: `Unexpected ${httpStatus} ${response.statusText}`,
      },
      headers,
    };
  }

  // Server envelope: { success, data, code?, message?, meta?, error? }
  const envelope = body as Record<string, unknown> | null;

  if (response.ok && envelope?.success !== false) {
    const data = (envelope?.data ?? envelope ?? null) as T;
    const meta = envelope?.meta as ApiEnvelope<T>['meta' & keyof ApiEnvelope<T>] | undefined;
    return { success: true, httpStatus, data, meta, headers };
  }

  // Failure envelope.
  const retryAfterRaw = headers['retry-after'] ?? headers['Retry-After'];
  const retryAfter = retryAfterRaw ? Number(retryAfterRaw) : undefined;
  const errorField = (envelope?.error ?? null) as Record<string, unknown> | null;

  return {
    success: false,
    httpStatus,
    error: {
      code: (errorField?.code as string) ?? (envelope?.code as string) ?? mapStatusToCode(httpStatus),
      message:
        (errorField?.message as string) ??
        (envelope?.message as string) ??
        `Request failed with status ${httpStatus}`,
      details: (errorField?.details as Record<string, string[]>) ?? null,
      exception: (errorField?.exception as string) ?? null,
    },
    data: (envelope?.data as Record<string, unknown>) ?? undefined,
    retry_after: Number.isFinite(retryAfter) ? retryAfter : undefined,
    headers,
  };
}

function mapStatusToCode(status: number): ApiErrorCode {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'EXTENSION_NOT_AUTHORIZED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 422) return 'VALIDATION_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'MAINTENANCE';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'INTERNAL_ERROR';
}
