/**
 * storage/chrome-storage.ts — Typed wrapper around chrome.storage.local.
 *
 * Layer: Storage
 * Owner: shared
 *
 * Falls back to localStorage when not running inside the extension context
 * (e.g. Vite dev preview in a regular browser tab) so the UI stays usable
 * during development. See docs/07-storage-schema.md for the full key catalog.
 */

/**
 * Any JSON-serialisable value is acceptable. We don't enforce a tight type
 * here because the variety of payloads (themes, sessions, settings…) all
 * round-trip through JSON.
 */
type Json = unknown;

const inExtension = typeof chrome !== 'undefined' && !!chrome.storage?.local;

export async function getStorage<T = Json>(key: string): Promise<T | undefined> {
  if (inExtension) {
    const res = await chrome.storage.local.get(key);
    return res[key] as T | undefined;
  }
  const raw = localStorage.getItem(key);
  return raw == null ? undefined : (JSON.parse(raw) as T);
}

export async function setStorage(key: string, value: Json): Promise<void> {
  if (inExtension) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export async function removeStorage(key: string): Promise<void> {
  if (inExtension) {
    await chrome.storage.local.remove(key);
    return;
  }
  localStorage.removeItem(key);
}

/**
 * Subscribe to value changes for a single key. Returns an unsubscribe fn.
 * Outside the extension context this is a no-op listener — adequate for the
 * Phase 0 dev preview because only the originating tab changes the value.
 */
export function onStorageChange<T = Json>(
  key: string,
  callback: (newValue: T | undefined, oldValue: T | undefined) => void,
): () => void {
  if (!inExtension) {
    return () => {
      /* no-op */
    };
  }
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) => {
    if (areaName !== 'local') return;
    const change = changes[key];
    if (!change) return;
    callback(change.newValue as T | undefined, change.oldValue as T | undefined);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
