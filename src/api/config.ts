/**
 * api/config.ts — Single source of truth for the API base URL.
 *
 * Layer: API
 * Owner: api
 *
 * Order of precedence (highest wins):
 *   1. `apiBaseUrl` field saved inside `af_auth` (admin can override per-user
 *      via login response — see reference-ext AuthManager.init).
 *   2. `VITE_API_BASE_URL` env var (set in `.env.local`).
 *   3. Hard-coded fallback (clearly fake so prod misconfigs surface fast).
 */

export const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://your-backend.example.com/api/v1';

let runtimeOverride: string | null = null;

export function setApiBaseUrlOverride(url: string | null): void {
  runtimeOverride = url;
}

export function getApiBaseUrl(): string {
  return runtimeOverride ?? DEFAULT_API_BASE_URL;
}

/** Strip trailing slash + join endpoint. Accepts endpoint with or without leading `/`. */
export function buildApiUrl(endpoint: string, baseUrlOverride?: string): string {
  const base = (baseUrlOverride ?? getApiBaseUrl()).replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}
