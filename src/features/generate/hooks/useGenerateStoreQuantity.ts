/**
 * Tiny convenience selector so PromptArea can derive output count without
 * re-rendering when other generate store fields change.
 */

import { useGenerateStore } from '../store/generate.store';

export function useGenerateStoreQuantity(): number {
  return useGenerateStore((s) => s.quantity);
}
