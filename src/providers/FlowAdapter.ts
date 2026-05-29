/**
 * FlowAdapter — Google Flow (labs.google/fx) integration.
 *
 * Layer: Adapter
 * Owner: providers
 *
 * Phase 2 status: skeleton.
 *   - `ensureTab()` finds/opens a labs.google/fx tab when running as
 *     extension. Returns null in browser preview mode.
 *   - `submitPrompt()` falls back to a deterministic mock (returns Lorem
 *     Picsum placeholder URLs) when no real tab is reachable — gives the
 *     UI something to render during dev.
 *
 * Full DOM bridge (slate-bridge content script + tRPC tile resolution)
 * lands in a follow-up — see [reference-ext/content.js](../../reference-ext/content.js)
 * and [reference-ext/slate-bridge.js](../../reference-ext/slate-bridge.js).
 */

import type { MediaType } from '@/types/provider.types';
import { AIProviderAdapter, type SubmitInput, type SubmitResult } from './AIProviderAdapter';
import { ProviderTabLock } from './ProviderTabLock';

const FLOW_URL_PATTERN = 'https://labs.google/fx/*';
const MOCK_LATENCY_MS = 1800;

export class FlowAdapter extends AIProviderAdapter {
  readonly provider = 'flow' as const;

  async ensureTab(): Promise<number | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;
    const cached = ProviderTabLock.get('flow');
    if (cached != null) {
      try {
        const tab = await chrome.tabs.get(cached);
        if (tab?.id != null) return tab.id;
      } catch {
        ProviderTabLock.clear('flow');
      }
    }
    const tabs = await chrome.tabs.query({ url: FLOW_URL_PATTERN });
    const first = tabs[0];
    if (first?.id != null) {
      ProviderTabLock.set('flow', first.id);
      return first.id;
    }
    // Open a new tab. We intentionally don't focus it — the user might be
    // mid-generation in the sidebar.
    const opened = await chrome.tabs.create({ url: 'https://labs.google/fx', active: false });
    if (opened?.id != null) {
      ProviderTabLock.set('flow', opened.id);
      return opened.id;
    }
    return null;
  }

  async submitPrompt(input: SubmitInput): Promise<SubmitResult> {
    // TODO Phase 2 follow-up: send `gen:submit` to the Flow content script,
    // wait for `gen:result` over chrome.runtime.onMessage with the file_name
    // / tile_id returned by the tRPC submit endpoint. For now we render a
    // mock so the UI flow is exercisable end-to-end.
    return mockSubmit(input);
  }
}

/** Deterministic placeholder result — same shape the real adapter will produce. */
async function mockSubmit(input: SubmitInput): Promise<SubmitResult> {
  const quantity = clamp(input.quantity ?? 4, 1, 4);
  await sleep(MOCK_LATENCY_MS + Math.random() * 800);
  const startedAt = Date.now();
  const fileIds: string[] = [];
  const thumbnails: SubmitResult['thumbnails'] = {};
  for (let i = 0; i < quantity; i += 1) {
    const id = `mock_${input.model}_${startedAt}_${i}_${Math.random().toString(36).slice(2, 8)}`;
    fileIds.push(id);
    thumbnails[id] = {
      url: pickPlaceholderUrl(input.mediaType, input.ratio, id),
      type: input.mediaType,
      width: 1024,
      height: 1024,
    };
  }
  return { fileIds, thumbnails, durationMs: Date.now() - startedAt };
}

function pickPlaceholderUrl(media: MediaType, ratio: string | undefined, seed: string): string {
  // Lorem Picsum: deterministic image per seed, supports width/height suffix.
  const [w, h] = parseRatio(ratio);
  if (media === 'video') {
    // No good free placeholder video CDN — return a static thumbnail so the
    // UI has something to render. Phase 6 may replace with an inline svg.
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
  }
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

function parseRatio(ratio: string | undefined): [number, number] {
  if (!ratio) return [512, 512];
  const [a, b] = ratio.split(':').map((n) => Number(n));
  if (!a || !b) return [512, 512];
  const base = 480;
  return [Math.round((a / Math.max(a, b)) * base * 1.5), Math.round((b / Math.max(a, b)) * base * 1.5)];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
