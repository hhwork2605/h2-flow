/**
 * AIProviderAdapter — Abstract base for every provider integration.
 *
 * Layer: Adapter
 * Owner: providers
 *
 * Phase 2 scope: defines the interface. FlowAdapter ships a skeleton
 * (mock-aware). ChatGPT / Grok / Gemini adapters land in Phase 4.
 *
 * Reference: reference-ext/src/core/providers/AIProviderAdapter.js.
 */

import type { MediaType, ProviderSlug } from '@/types/provider.types';

export interface SubmitInput {
  prompt: string;
  model: string;
  mediaType: MediaType;
  ratio?: string;
  quantity?: number;
  /** Reference image IDs (Flow file_names / ChatGPT data URIs / …). */
  refFileIds?: string[];
}

export interface SubmitResult {
  /** Provider-specific file names (Flow UUIDs / synthetic IDs for others). */
  fileIds: string[];
  /** Thumbnails (blob URLs or remote URLs) keyed by fileId. */
  thumbnails: Record<string, { url: string; type: MediaType; width?: number; height?: number }>;
  durationMs: number;
}

export abstract class AIProviderAdapter {
  abstract readonly provider: ProviderSlug;

  /**
   * Make sure a provider tab is open + reachable. Returns the tab id, or
   * `null` when running in a context with no tab access (e.g. browser
   * preview mode — caller falls back to the mock path).
   */
  abstract ensureTab(): Promise<number | null>;

  /** Submit one prompt + wait for result. */
  abstract submitPrompt(input: SubmitInput): Promise<SubmitResult>;
}
