/**
 * execution.types.ts — Server-authoritative quota gate contracts.
 *
 * Layer: Types
 * Owner: shared
 *
 * Spec: docs/08-api-contract.md §4. Behaviour ground truth:
 * reference-ext/src/core/ExecutionGate.js.
 */

export type ExecutionAction =
  | 'generate'
  | 'task_run'
  | 'workflow_run'
  | 'angles_run'
  | 'effects_run';

export type ExecutionReason =
  | 'SERVER_APPROVED'
  | 'SERVER_DENIED'
  | 'QUOTA_EXCEEDED'
  | 'GLOBAL_QUOTA_EXCEEDED'
  | 'FEATURE_DISABLED'
  | 'PLAN_EXPIRED'
  | 'EXTENSION_NOT_AUTHORIZED'
  | 'RATE_LIMITED'
  | 'MAINTENANCE';

export interface ExecutionRequestPayload {
  action: ExecutionAction;
  prompt_count: number;
  metadata?: {
    owner?: 'generate' | 'task' | 'workflow' | 'single_node' | 'angles' | 'effects';
    label?: string;
    wf_id?: string;
    node_id?: string;
  };
}

export interface ExecutionGrant {
  execution_token: string;
  expires_in: number;
  remaining: number;
  limit: number;
  used: number;
  global?: {
    remaining: number;
    limit: number;
    used: number;
  };
}

export interface ExecutionCompletePayload {
  execution_token: string;
  status: 'success' | 'failed';
  actual_count?: number;
}

export interface ExecutionCancelPayload {
  execution_token: string;
}
