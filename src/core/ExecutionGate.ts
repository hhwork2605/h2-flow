/**
 * ExecutionGate — Server-authoritative quota gate.
 *
 * Layer: Service
 * Owner: core
 *
 * Spec: docs/08 §4. Behaviour ground truth:
 * reference-ext/src/core/ExecutionGate.js. Every runnable action (generate,
 * task_run, workflow_run, …) MUST acquire a token first, then call
 * `complete()` (success/failed) or `cancel()` so the server accounting
 * stays consistent.
 *
 * Idempotency:
 *   - `complete(token)` is a no-op when the token was already completed
 *     (in-flight error + executor finally block both calling it).
 *   - `cancel(token)` removes the token before firing → safe to call twice.
 */

import { ApiError } from '@/api/errors';
import { request } from '@/api/client';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import type {
  ExecutionAction,
  ExecutionCancelPayload,
  ExecutionCompletePayload,
  ExecutionGrant,
  ExecutionRequestPayload,
} from '@/types/execution.types';

const activeTokens = new Map<string, { action: ExecutionAction; startedAt: number }>();
const completedTokens = new Set<string>();

export interface RequestResult {
  allowed: boolean;
  grant?: ExecutionGrant;
  /** Failure path: server reason + raw error so UI can decide what dialog to show. */
  reason?: string;
  error?: ApiError;
}

function token(): string | null {
  return useAuthStore.getState().token;
}

export const ExecutionGate = {
  /**
   * Ask the server for permission to run `action` for `promptCount` prompts.
   * Returns `allowed: false` on QUOTA_EXCEEDED / FEATURE_DISABLED / etc. so
   * the UI can branch — only throws on unexpected network errors.
   */
  async request(
    action: ExecutionAction,
    promptCount = 1,
    metadata: ExecutionRequestPayload['metadata'] = {},
  ): Promise<RequestResult> {
    const payload: ExecutionRequestPayload = { action, prompt_count: promptCount, metadata };
    try {
      const { data } = await request<ExecutionGrant>({
        method: 'POST',
        endpoint: 'execution/request',
        data: payload,
        token: token(),
      });
      activeTokens.set(data.execution_token, { action, startedAt: Date.now() });
      return { allowed: true, grant: data };
    } catch (err) {
      if (err instanceof ApiError) {
        if (
          err.code === 'QUOTA_EXCEEDED' ||
          err.code === 'GLOBAL_QUOTA_EXCEEDED' ||
          err.code === 'FEATURE_DISABLED' ||
          err.code === 'PLAN_EXPIRED' ||
          err.code === 'SUBSCRIPTION_REQUIRED'
        ) {
          return { allowed: false, reason: err.code, error: err };
        }
      }
      // Unexpected — surface for caller's catch.
      throw err;
    }
  },

  async complete(
    executionToken: string | null | undefined,
    status: 'success' | 'failed' = 'success',
    actualCount?: number,
  ): Promise<void> {
    if (!executionToken) return;
    if (completedTokens.has(executionToken)) return;

    completedTokens.add(executionToken);
    activeTokens.delete(executionToken);

    const payload: ExecutionCompletePayload = {
      execution_token: executionToken,
      status,
      actual_count: actualCount,
    };
    try {
      await request({
        method: 'POST',
        endpoint: 'execution/complete',
        data: payload,
        token: token(),
      });
    } catch (err) {
      // Non-blocking: server can reconcile from heartbeat data, no point bubbling.
      console.warn('[h2-flow] ExecutionGate.complete failed', err);
    }
  },

  async cancel(executionToken: string | null | undefined): Promise<void> {
    if (!executionToken) return;
    activeTokens.delete(executionToken);

    const payload: ExecutionCancelPayload = { execution_token: executionToken };
    try {
      await request({
        method: 'POST',
        endpoint: 'execution/cancel',
        data: payload,
        token: token(),
      });
    } catch (err) {
      console.warn('[h2-flow] ExecutionGate.cancel failed', err);
    }
  },

  /**
   * Cancel every in-flight token. Called when user stops a workflow / closes
   * the sidebar mid-run — see reference-ext ExecutionGate.cancelAll.
   */
  async cancelAll(): Promise<number> {
    const tokens = Array.from(activeTokens.keys());
    await Promise.allSettled(tokens.map((t) => ExecutionGate.cancel(t)));
    return tokens.length;
  },

  /** For debugging / test inspection. */
  _activeTokens(): readonly string[] {
    return [...activeTokens.keys()];
  },
};

/**
 * Hook variant that also invalidates the entitlements cache after each call —
 * keeps the quota indicator fresh without waiting for the 30s stale window.
 */
export function useExecutionGate() {
  const queryClient = useQueryClient();
  return {
    request: async (
      action: ExecutionAction,
      promptCount?: number,
      metadata?: ExecutionRequestPayload['metadata'],
    ) => {
      const res = await ExecutionGate.request(action, promptCount, metadata);
      void queryClient.invalidateQueries({ queryKey: ['entitlements'] });
      return res;
    },
    complete: async (
      token: string | null | undefined,
      status?: 'success' | 'failed',
      actualCount?: number,
    ) => {
      await ExecutionGate.complete(token, status, actualCount);
      void queryClient.invalidateQueries({ queryKey: ['entitlements'] });
    },
    cancel: async (token: string | null | undefined) => {
      await ExecutionGate.cancel(token);
      void queryClient.invalidateQueries({ queryKey: ['entitlements'] });
    },
    cancelAll: ExecutionGate.cancelAll,
  };
}
