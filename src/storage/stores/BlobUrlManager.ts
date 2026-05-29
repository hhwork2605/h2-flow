/**
 * BlobUrlManager — `blob:` URL lifecycle.
 *
 * Layer: Storage
 * Owner: storage
 *
 * `URL.createObjectURL` leaks memory if you never call revoke. This module
 * owns every URL we hand out, refcounts them, and revokes on `release()`
 * (or on page unload as a safety net).
 *
 * Reference: reference-ext/src/core/BlobUrlManager.js.
 */

interface Entry {
  url: string;
  refs: number;
  blob: Blob;
}

const byKey = new Map<string, Entry>();
const urlToKey = new Map<string, string>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    for (const { url } of byKey.values()) URL.revokeObjectURL(url);
    byKey.clear();
    urlToKey.clear();
  });
}

export const BlobUrlManager = {
  /**
   * Acquire a `blob:` URL for the given key. Multiple acquires with the
   * same key are deduplicated (single URL, refcount++). Pass `null`/empty
   * key to opt out of dedup.
   */
  acquire(blob: Blob, key?: string | null): string {
    if (key) {
      const existing = byKey.get(key);
      if (existing) {
        existing.refs += 1;
        return existing.url;
      }
      const url = URL.createObjectURL(blob);
      byKey.set(key, { url, refs: 1, blob });
      urlToKey.set(url, key);
      return url;
    }
    return URL.createObjectURL(blob);
  },

  /**
   * Release a previously acquired URL. When the last reference drops, the
   * underlying object URL is revoked. Safe to call on URLs not managed
   * here — those just get a no-op revoke.
   */
  release(url: string): void {
    const key = urlToKey.get(url);
    if (!key) {
      URL.revokeObjectURL(url);
      return;
    }
    const entry = byKey.get(key);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0) {
      URL.revokeObjectURL(entry.url);
      byKey.delete(key);
      urlToKey.delete(url);
    }
  },

  /** For tests / debugging. */
  _size(): number {
    return byKey.size;
  },
};
