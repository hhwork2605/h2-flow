/**
 * useRefImages — Add/remove reference images with proper lifecycle.
 *
 * Layer: Hook
 * Owner: features/generate
 *
 * Each ref image:
 *   1. Saved to ImageStore (Dexie) at `thumbnail` tier — survives refresh.
 *   2. Acquires a blob URL via BlobUrlManager → displayable in <img>.
 *   3. Released (URL revoked + blob deleted) when removed from the picker.
 */

import { useCallback } from 'react';
import { ImageStore } from '@/storage/stores/ImageStore';
import { BlobUrlManager } from '@/storage/stores/BlobUrlManager';
import { useGenerateStore, type RefImage } from '../store/generate.store';

function newId(): string {
  return `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readImageSize(blob: Blob): Promise<{ width: number; height: number } | null> {
  try {
    if ('createImageBitmap' in window) {
      const bitmap = await createImageBitmap(blob);
      const dim = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return dim;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function useRefImages() {
  const refImages = useGenerateStore((s) => s.refImages);
  const addRefImage = useGenerateStore((s) => s.addRefImage);
  const removeRefImage = useGenerateStore((s) => s.removeRefImage);

  const add = useCallback(
    async (file: File | Blob, suggestedFilename?: string): Promise<RefImage | null> => {
      if (!file.type.startsWith('image/')) {
        console.warn('[h2-flow] refImage: ignoring non-image file', file.type);
        return null;
      }
      const id = newId();
      const filename = suggestedFilename ?? ('name' in file && file.name ? file.name : `ref_${id}.png`);
      const dims = await readImageSize(file);

      // File extends Blob, so this is already storable as-is.
      const blob: Blob = file;
      await ImageStore.put(id, 'thumbnail', blob);
      const blobUrl = BlobUrlManager.acquire(blob, id);

      const ref: RefImage = {
        id,
        filename,
        mime: blob.type,
        size: blob.size,
        blobUrl,
        width: dims?.width,
        height: dims?.height,
      };
      addRefImage(ref);
      return ref;
    },
    [addRefImage],
  );

  const remove = useCallback(
    async (id: string) => {
      const target = useGenerateStore.getState().refImages.find((r) => r.id === id);
      if (target) BlobUrlManager.release(target.blobUrl);
      await ImageStore.delete(id);
      removeRefImage(id);
    },
    [removeRefImage],
  );

  return { refImages, add, remove };
}
