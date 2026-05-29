/**
 * background/request-signer.ts — HMAC-SHA256 signature headers.
 *
 * Layer: Infra (background)
 * Owner: api
 *
 * Contract — ground truth: reference-ext/src/core/RequestSigner.js +
 * reference-ext/background.js `_buildSignatureHeaders`.
 *
 *   timestamp = floor(Date.now() / 1000)            // SECONDS, not ms
 *   message   = `${ts}:${METHOD}:${path}:${sha256(body)}`
 *   signature = HMAC-SHA256(enrollment.secret, message)  // hex lowercase
 *
 *   Headers: X-Client-Id, X-Timestamp, X-Signature
 *
 * The `path` is the URL pathname including any `/api/v1/` prefix — see
 * how it is computed in `apiRequest` handler from the full URL.
 *
 * NOTE: docs/08-api-contract.md describes a *different* contract (X-Ext-*,
 * base64, ms timestamp). Production uses this one — per CLAUDE.md rule
 * "behaviour conflicts → follow reference-ext".
 */

import { getEnrollment } from './enrollment';

const encoder = new TextEncoder();

export async function buildSignatureHeaders(
  method: string,
  path: string,
  body: string,
): Promise<Record<string, string>> {
  const enrollment = await getEnrollment();
  if (!enrollment) return {};

  const ts = Math.floor(Date.now() / 1000);
  const normalizedPath = `/${path.replace(/^\/+/, '')}`;
  const bodyHash = await sha256Hex(body);
  const message = `${ts}:${method.toUpperCase()}:${normalizedPath}:${bodyHash}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(enrollment.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  return {
    'X-Client-Id': enrollment.client_id,
    'X-Timestamp': String(ts),
    'X-Signature': toHex(sigBuffer),
  };
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return toHex(buf);
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
