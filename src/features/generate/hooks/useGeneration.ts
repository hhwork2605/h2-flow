/**
 * useGeneration — Drives the generate pipeline.
 *
 * Layer: Hook
 * Owner: features/generate
 *
 * Flow per docs/09 + reference-ext FlowAdapter / ExecutionGate:
 *   1. ExecutionGate.request('generate', promptCount) → token or denial
 *   2. Initialise per-prompt runs (status='pending').
 *   3. Sequential or parallel: each prompt → adapter.submitPrompt → record
 *      tiles → tick run status. Delay between prompts honours `delayBetweenMs`.
 *   4. ExecutionGate.complete(token, 'success'|'failed').
 *   5. On user Stop → abort handle short-circuits the loop + ExecutionGate.cancel.
 */

import { useCallback, useRef } from 'react';
import { ApiError } from '@/api/errors';
import { ExecutionGate, useExecutionGate } from '@/core/ExecutionGate';
import { forceRelease, tryAcquire } from '@/core/ExecutionLock';
import { ProviderRegistry } from '@/providers/ProviderRegistry';
import {
  parsePrompts,
  useGenerateStore,
  type PromptRun,
} from '../store/generate.store';

export function useGeneration() {
  const gate = useExecutionGate();
  const abortRef = useRef<{ aborted: boolean } | null>(null);

  const start = useCallback(async () => {
    const state = useGenerateStore.getState();
    const prompts = parsePrompts(state.promptText, state.multiPrompt);
    if (prompts.length === 0) return;

    // Local single-runner lock — prevent double-click double-fire.
    const lock = tryAcquire();
    if (!lock) {
      console.warn('[h2-flow] generation already in flight, ignoring');
      return;
    }

    const abort = { aborted: false };
    abortRef.current = abort;

    const initialRuns: PromptRun[] = prompts.map((text, index) => ({
      index,
      text,
      status: 'pending',
      tiles: [],
    }));
    useGenerateStore.getState().startRun(initialRuns, {
      abort: () => {
        abort.aborted = true;
      },
    });

    // ExecutionGate.request — server-authoritative quota check.
    let execToken: string | null = null;
    try {
      const res = await gate.request('generate', prompts.length, { owner: 'generate' });
      if (!res.allowed) {
        // QUOTA_EXCEEDED / FEATURE_DISABLED / PLAN_EXPIRED — mark all as failed,
        // surface the reason via run.errorMessage.
        const reason = res.reason ?? 'denied';
        for (const r of initialRuns) {
          useGenerateStore
            .getState()
            .updateRun(r.index, { status: 'failed', errorMessage: reason });
        }
        useGenerateStore.getState().finishRun();
        lock.release();
        abortRef.current = null;
        return;
      }
      execToken = res.grant?.execution_token ?? null;
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error ? err.message : 'Execution request failed';
      for (const r of initialRuns) {
        useGenerateStore
          .getState()
          .updateRun(r.index, { status: 'failed', errorMessage: message });
      }
      useGenerateStore.getState().finishRun();
      lock.release();
      abortRef.current = null;
      return;
    }

    const adapter = ProviderRegistry.get(state.provider);
    if (!adapter) {
      for (const r of initialRuns) {
        useGenerateStore
          .getState()
          .updateRun(r.index, { status: 'failed', errorMessage: `No adapter for ${state.provider}` });
      }
      await gate.complete(execToken, 'failed');
      useGenerateStore.getState().finishRun();
      lock.release();
      abortRef.current = null;
      return;
    }

    let anyFailed = false;
    const runOne = async (run: PromptRun): Promise<void> => {
      if (abort.aborted) {
        useGenerateStore.getState().updateRun(run.index, { status: 'cancelled' });
        return;
      }
      useGenerateStore
        .getState()
        .updateRun(run.index, { status: 'running', startedAt: Date.now() });
      try {
        const result = await adapter.submitPrompt({
          prompt: run.text,
          model: state.model,
          mediaType: state.mediaType,
          ratio: state.ratio,
          quantity: state.quantity,
          refFileIds: state.refImages.map((r) => r.id),
        });
        useGenerateStore.getState().updateRun(run.index, {
          status: 'completed',
          completedAt: Date.now(),
          tiles: result.fileIds.map((id) => ({
            fileId: id,
            thumbnailUrl: result.thumbnails[id]?.url ?? '',
            type: result.thumbnails[id]?.type ?? state.mediaType,
          })),
        });
      } catch (err) {
        anyFailed = true;
        const message = err instanceof Error ? err.message : 'Generation failed';
        useGenerateStore
          .getState()
          .updateRun(run.index, { status: 'failed', errorMessage: message });
      }
    };

    try {
      if (state.runMode === 'parallel') {
        await Promise.all(initialRuns.map(runOne));
      } else {
        for (const run of initialRuns) {
          if (abort.aborted) break;
          await runOne(run);
          if (abort.aborted) break;
          if (state.delayBetweenMs > 0 && run.index < initialRuns.length - 1) {
            await sleep(state.delayBetweenMs);
          }
        }
      }
    } finally {
      if (abort.aborted) {
        // Refund unused capacity via cancel — server treats it as no-op when
        // already completed.
        await ExecutionGate.cancel(execToken);
      } else {
        await gate.complete(execToken, anyFailed ? 'failed' : 'success');
      }
      useGenerateStore.getState().finishRun();
      lock.release();
      abortRef.current = null;
    }
  }, [gate]);

  const stop = useCallback(() => {
    const handle = useGenerateStore.getState().cancelHandle;
    handle?.abort();
    forceRelease();
  }, []);

  return { start, stop };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
