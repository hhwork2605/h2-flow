/**
 * ExecutionLock — Local single-runner lock.
 *
 * Layer: Infra
 * Owner: core
 *
 * Server-side quota lives in ExecutionGate; this lock is *local* (one
 * generation per context) so the UI doesn't double-fire when the user
 * clicks "Generate" twice in quick succession.
 *
 * Reference: reference-ext/src/core/ExecutionLock.js. Web Locks API would
 * be ideal but it isn't available in service workers in all Chrome builds —
 * a simple in-memory + storage flag is enough here because we only need
 * single-tab semantics, not cross-context.
 */

let memoryLock = false;

export interface ExecutionLockHandle {
  release: () => void;
}

export function tryAcquire(): ExecutionLockHandle | null {
  if (memoryLock) return null;
  memoryLock = true;
  return {
    release: () => {
      memoryLock = false;
    },
  };
}

export function isLocked(): boolean {
  return memoryLock;
}

/** Forcefully clear the lock — only call when you know nothing is running. */
export function forceRelease(): void {
  memoryLock = false;
}
