/**
 * ImageStore — 3-tier blob store backed by Dexie.
 *
 * Layer: Storage
 * Owner: storage
 *
 * Spec: docs/07-storage-schema.md §1 (`image_blobs` table). Behaviour
 * reference: reference-ext/src/core/ImageStore.js.
 *
 * Tier semantics (the consumer picks):
 *   - thumbnail: ≤50KB preview, base64-friendly, longest TTL
 *   - medium: 1200px WebP @ 0.85 quality, used in grids / inline viewer
 *   - original: full-resolution from the provider CDN
 */

import { BLOB_TTL, db, type BlobTier, type ImageBlob } from '../db';

function key(imageId: string, tier: BlobTier): string {
  return `${imageId}__${tier}`;
}

export const ImageStore = {
  async put(imageId: string, tier: BlobTier, blob: Blob): Promise<void> {
    const record: ImageBlob = {
      key: key(imageId, tier),
      blob,
      size: blob.size,
      mime: blob.type || 'application/octet-stream',
      tier,
      cached_at: Date.now(),
    };
    await db.image_blobs.put(record);
  },

  async get(imageId: string, tier: BlobTier): Promise<ImageBlob | undefined> {
    return db.image_blobs.get(key(imageId, tier));
  },

  async getBlob(imageId: string, tier: BlobTier): Promise<Blob | undefined> {
    return (await ImageStore.get(imageId, tier))?.blob;
  },

  async delete(imageId: string, tier?: BlobTier): Promise<number> {
    if (tier) {
      await db.image_blobs.delete(key(imageId, tier));
      return 1;
    }
    return db.image_blobs.where('key').startsWith(`${imageId}__`).delete();
  },

  /**
   * Remove tier-by-tier anything older than the configured TTL. Call on
   * sidebar boot so the store doesn't grow without bound.
   */
  async cleanupExpired(now = Date.now()): Promise<number> {
    let total = 0;
    for (const tier of ['thumbnail', 'medium', 'original'] as const) {
      const cutoff = now - BLOB_TTL[tier];
      const removed = await db.image_blobs
        .where('tier')
        .equals(tier)
        .filter((b) => b.cached_at < cutoff)
        .delete();
      total += removed;
    }
    return total;
  },

  /** Aggregate stats for the Settings → Storage tab. */
  async stats(): Promise<{ count: number; size: number; byTier: Record<BlobTier, number> }> {
    const all = await db.image_blobs.toArray();
    const byTier: Record<BlobTier, number> = { thumbnail: 0, medium: 0, original: 0 };
    let size = 0;
    for (const b of all) {
      size += b.size;
      byTier[b.tier] += b.size;
    }
    return { count: all.length, size, byTier };
  },
};
