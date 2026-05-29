/**
 * mock/index.ts — Mock dispatcher.
 *
 * Layer: Mock backend
 * Owner: background/mock
 *
 * Dispatch entry called from `api-proxy.handleApiRequest`. Returns an
 * `ApiEnvelope` if the request matches a mock route, or `null` to let the
 * real fetch path run.
 *
 * Toggle: env var `VITE_USE_MOCK`. Defaults to ON (`true`) when unset so a
 * fresh checkout works without configuration. Set `VITE_USE_MOCK=false` in
 * `.env.local` when pointing at a real backend.
 */

import type { ApiEnvelope } from '@/types/api.types';
import type { ApiRequestMessage } from '@/types/messages.types';
import { findMockHandler, MOCK_ROUTE_KEYS } from './handlers';

const MIN_LATENCY_MS = 120;
const MAX_LATENCY_MS = 380;

let warned = false;

export function isMockEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_MOCK;
  if (flag === undefined || flag === null || flag === '') return true; // default ON
  return String(flag).toLowerCase() !== 'false';
}

function warnOnce(): void {
  if (warned) return;
  warned = true;
  console.info(
    `%c[h2-flow] Mock backend ENABLED %c(${MOCK_ROUTE_KEYS.length} routes). Set VITE_USE_MOCK=false in .env.local to use real backend.`,
    'background:#3186FF;color:#fff;padding:2px 6px;border-radius:3px',
    'color:#888',
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function jitteredLatency(): number {
  return Math.floor(MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS));
}

export async function maybeMockRequest<T>(
  req: ApiRequestMessage,
): Promise<ApiEnvelope<T> | null> {
  if (!isMockEnabled()) return null;
  warnOnce();

  const handler = findMockHandler(req.method, req.endpoint);
  if (!handler) {
    // Mock is ON but no route matched → return a clear 404 so callers see the
    // gap instead of silently hitting the (placeholder) real URL.
    await sleep(jitteredLatency());
    console.warn(
      '[h2-flow][mock] no handler for',
      req.method,
      req.endpoint,
      '— add one in src/background/mock/handlers.ts',
    );
    return {
      success: false,
      httpStatus: 404,
      error: {
        code: 'NOT_FOUND',
        message: `Mock backend: chưa có route cho ${req.method} ${req.endpoint}`,
      },
    } satisfies ApiEnvelope<T>;
  }

  await sleep(jitteredLatency());
  return (await handler(req)) as ApiEnvelope<T>;
}
