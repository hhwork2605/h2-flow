/**
 * background/enrollment.ts — Anti-clone enrollment helper.
 *
 * Layer: Infra (background only)
 * Owner: background
 *
 * Each install enrolls once with the backend → receives `{client_id, secret,
 * expires_at}` and persists under `toby_client_enrollment`. All subsequent
 * authenticated calls are HMAC-signed with this secret.
 *
 * Phase 1 scope:
 *   - Read enrollment from storage (write happens in Phase 6 when real
 *     /enrollment/enroll endpoint lands).
 *   - Dev fallback: use `VITE_EXT_ID` + `VITE_EXT_SECRET` from .env.local so
 *     the signing path can be exercised without a real backend.
 *   - Returns `null` when neither is available → caller skips signing.
 *
 * Reference: reference-ext/background.js (search for "Enrollment").
 */

export interface Enrollment {
  client_id: string;
  secret: string;
  expires_at: number | null;
  device_fingerprint?: string;
}

const ENROLLMENT_KEY = 'toby_client_enrollment';

let cached: Enrollment | null = null;
let cacheLoaded = false;

export async function getEnrollment(): Promise<Enrollment | null> {
  if (cacheLoaded) return cached;

  try {
    const stored = await chrome.storage.local.get(ENROLLMENT_KEY);
    const value = stored[ENROLLMENT_KEY] as Enrollment | undefined;
    if (value?.client_id && value.secret) {
      cached = value;
      cacheLoaded = true;
      return cached;
    }
  } catch (err) {
    console.warn('[h2-flow] enrollment read failed', err);
  }

  // Dev fallback. Strip out at production time by clearing env vars.
  const devId = import.meta.env.VITE_EXT_ID;
  const devSecret = import.meta.env.VITE_EXT_SECRET;
  if (devId && devSecret) {
    cached = { client_id: devId, secret: devSecret, expires_at: null };
  } else {
    cached = null;
  }
  cacheLoaded = true;
  return cached;
}

// Invalidate cache when storage updates (e.g. real enrollment lands).
chrome.storage?.onChanged?.addListener?.((changes, area) => {
  if (area !== 'local') return;
  if (changes[ENROLLMENT_KEY]) {
    const newValue = changes[ENROLLMENT_KEY].newValue as Enrollment | undefined;
    cached = newValue?.client_id && newValue.secret ? newValue : null;
    cacheLoaded = true;
  }
});
