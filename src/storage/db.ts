/**
 * storage/db.ts — Dexie database.
 *
 * Layer: Storage
 * Owner: storage
 *
 * Schema per docs/07-storage-schema.md §1. Phase 2 adds `image_blobs`
 * (3-tier: thumbnail / medium / original) and `album_images`. The Phase 0
 * skeleton tables (`images`, `albums`, `thumbnails`) remain as v1 — v2
 * upgrade drops them in favour of the proper tables below.
 *
 * Reference: reference-ext/src/core/ImageStore.js + AlbumStore.js.
 */

import Dexie, { type EntityTable } from 'dexie';
import type { WorkflowDocument } from '@/types/workflow.types';

export type BlobTier = 'thumbnail' | 'medium' | 'original';

/**
 * Workflow row — v3 schema. Toàn bộ doc JSON store dưới `data`, các field index
 * (id / updated_at / project_id) duplicate ra cấp top-level cho query nhanh.
 */
export interface WorkflowRow {
  id: string;
  name: string;
  project_id: string | null;
  updated_at: number;
  created_at: number;
  node_count: number;
  sync_state: WorkflowDocument['sync_state'];
  /** Full doc — bao gồm nodes/edges/viewport. Phase 4 có thể tách bảng nếu nặng. */
  data: WorkflowDocument;
}

export interface ImageBlob {
  /** `${imageId}__${tier}` */
  key: string;
  blob: Blob;
  size: number;
  mime: string;
  tier: BlobTier;
  cached_at: number;
}

export interface AlbumImage {
  id: string;
  album_id?: string;
  /** Provider-assigned file id (Flow UUID, ChatGPT synthetic, …). */
  file_name?: string;
  /** Original prompt that produced this image. */
  prompt: string;
  ref_image_ids?: string[];
  /** Tiny base64 thumb so the grid renders instantly. */
  thumbnail_data_url?: string;
  provider: string;
  model: string;
  ratio: string;
  width?: number;
  height?: number;
  type: 'image' | 'video';
  created_at: number;
  expires_at?: number;
}

export interface AlbumRecord {
  id: string;
  name: string;
  cover_image_id?: string;
  image_count: number;
  created_at: number;
  updated_at: number;
}

export class H2FlowDatabase extends Dexie {
  // v2+ tables
  image_blobs!: EntityTable<ImageBlob, 'key'>;
  album_images!: EntityTable<AlbumImage, 'id'>;
  albums!: EntityTable<AlbumRecord, 'id'>;
  // v3
  workflows!: EntityTable<WorkflowRow, 'id'>;

  constructor() {
    super('h2-flow');
    // v1 — Phase 0 stub, kept so existing dev DBs upgrade cleanly.
    this.version(1).stores({
      images: 'id, createdAt',
      albums: 'id, createdAt',
      thumbnails: 'id, createdAt',
    });
    // v2 — real Phase 2 schema. Drop stub tables, add real ones.
    this.version(2)
      .stores({
        images: null,
        thumbnails: null,
        image_blobs: 'key, cached_at, tier',
        album_images: 'id, album_id, file_name, created_at',
        albums: 'id, name, updated_at',
      })
      .upgrade(async () => {
        // Phase 0 stub had no real data; nothing to migrate.
      });
    // v3 — Phase 3 P3.10. Thêm bảng `workflows`. Migration từ localStorage
    // chạy ở `persistence.ts` (cần access localStorage — không nằm trong
    // upgrade context của Dexie).
    this.version(3).stores({
      workflows: 'id, project_id, updated_at, created_at',
    });
  }
}

export const db = new H2FlowDatabase();

/** TTL defaults (ms) per tier — see docs/07 §1 "Cleanup policy". */
export const BLOB_TTL: Record<BlobTier, number> = {
  thumbnail: 30 * 24 * 3600_000, // 30 days
  medium: 7 * 24 * 3600_000, //  7 days
  original: 3 * 24 * 3600_000, //  3 days
};
