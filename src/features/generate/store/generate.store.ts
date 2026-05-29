/**
 * generate.store.ts — Generate tab state.
 *
 * Layer: State
 * Owner: features/generate
 *
 * Holds user input (prompts, refs, config) + per-prompt run state. Result
 * thumbnails are kept in this store directly for the Phase 2 mock pipeline;
 * once ImageStore (Dexie) lands, large blobs move there and the store keeps
 * only ids.
 */

import { create } from 'zustand';
import type { MediaType, ProviderSlug } from '@/types/provider.types';

export const RATIOS = ['16:9', '1:1', '9:16', '4:3', '3:4'] as const;
export type Ratio = (typeof RATIOS)[number];

export type GenStatus = 'idle' | 'running' | 'completed';
export type PromptStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface PromptResultTile {
  fileId: string;
  thumbnailUrl: string;
  type: MediaType;
}

export interface PromptRun {
  index: number;
  text: string;
  status: PromptStatus;
  errorMessage?: string;
  tiles: PromptResultTile[];
  startedAt?: number;
  completedAt?: number;
}

export interface RefImage {
  id: string;
  filename: string;
  mime: string;
  size: number;
  /** Blob URL acquired from BlobUrlManager — stable while this ref exists. */
  blobUrl: string;
  width?: number;
  height?: number;
}

interface GenerateState {
  // Inputs
  promptText: string; // raw textarea content
  /** When false, the textarea is treated as one prompt regardless of newlines. */
  multiPrompt: boolean;
  provider: ProviderSlug;
  mediaType: MediaType;
  model: string;
  ratio: Ratio;
  quantity: number;
  runMode: 'sequential' | 'parallel';
  delayBetweenMs: number;
  autoDownload: boolean;
  downloadFolder: string;
  downloadResolution: '1K' | '2K' | '4K';
  /** Optional style preset key (mock — see StyleSelector). */
  stylePreset: string | null;
  refImages: RefImage[];

  // Runtime
  status: GenStatus;
  runs: PromptRun[];
  /** Set by mock pipeline so RunControls can fire cancel. */
  cancelHandle: { abort: () => void } | null;

  // Actions
  setPromptText: (text: string) => void;
  setMultiPrompt: (v: boolean) => void;
  setProvider: (provider: ProviderSlug) => void;
  setMediaType: (mediaType: MediaType) => void;
  setModel: (model: string) => void;
  setRatio: (ratio: Ratio) => void;
  setQuantity: (quantity: number) => void;
  setRunMode: (mode: 'sequential' | 'parallel') => void;
  setDelay: (ms: number) => void;
  setAutoDownload: (v: boolean) => void;
  setDownloadFolder: (folder: string) => void;
  setDownloadResolution: (resolution: '1K' | '2K' | '4K') => void;
  setStylePreset: (key: string | null) => void;
  addRefImage: (image: RefImage) => void;
  removeRefImage: (id: string) => void;
  clearRefImages: () => void;

  // Runtime mutations
  startRun: (runs: PromptRun[], cancelHandle: { abort: () => void }) => void;
  updateRun: (index: number, patch: Partial<PromptRun>) => void;
  finishRun: () => void;
  resetRuns: () => void;
}

const DEFAULTS = {
  promptText: '',
  multiPrompt: false,
  provider: 'flow' as ProviderSlug,
  mediaType: 'image' as MediaType,
  model: 'imagen-3',
  ratio: '1:1' as Ratio,
  quantity: 4,
  runMode: 'sequential' as const,
  delayBetweenMs: 1500,
  autoDownload: false,
  downloadFolder: 'h2flow-01',
  downloadResolution: '1K' as const,
  stylePreset: null as string | null,
};

export const useGenerateStore = create<GenerateState>((set) => ({
  ...DEFAULTS,
  refImages: [],
  status: 'idle',
  runs: [],
  cancelHandle: null,

  setPromptText: (text) => set({ promptText: text }),
  setMultiPrompt: (multiPrompt) => set({ multiPrompt }),
  setProvider: (provider) => set({ provider }),
  setMediaType: (mediaType) => set({ mediaType }),
  setModel: (model) => set({ model }),
  setRatio: (ratio) => set({ ratio }),
  setQuantity: (quantity) => set({ quantity }),
  setRunMode: (runMode) => set({ runMode }),
  setDelay: (delayBetweenMs) => set({ delayBetweenMs }),
  setAutoDownload: (autoDownload) => set({ autoDownload }),
  setDownloadFolder: (downloadFolder) => set({ downloadFolder }),
  setDownloadResolution: (downloadResolution) => set({ downloadResolution }),
  setStylePreset: (stylePreset) => set({ stylePreset }),
  addRefImage: (image) => set((s) => ({ refImages: [...s.refImages, image] })),
  removeRefImage: (id) => set((s) => ({ refImages: s.refImages.filter((r) => r.id !== id) })),
  clearRefImages: () => set({ refImages: [] }),

  startRun: (runs, cancelHandle) => set({ runs, status: 'running', cancelHandle }),
  updateRun: (index, patch) =>
    set((state) => ({
      runs: state.runs.map((r) => (r.index === index ? { ...r, ...patch } : r)),
    })),
  finishRun: () => set({ status: 'completed', cancelHandle: null }),
  resetRuns: () => set({ status: 'idle', runs: [], cancelHandle: null }),
}));

/**
 * Parse the textarea according to the current Multi-Prompt mode.
 * - Multi ON  → 1 prompt per non-empty line.
 * - Multi OFF → entire textarea as a single prompt (preserve newlines).
 */
export function parsePrompts(text: string, multi = true): string[] {
  if (!multi) {
    const trimmed = text.trim();
    return trimmed ? [trimmed] : [];
  }
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
