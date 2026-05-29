/**
 * features/auth/hooks/useAuthBootstrap.ts — One-time hydration + session verify.
 *
 * Layer: Hook
 * Owner: features/auth
 *
 * Mount in the root `<App />` of every entry (sidebar, popups, settings). It:
 *   1. Hydrates auth state from chrome.storage (synchronous-feeling because
 *      Zustand updates re-render).
 *   2. Wires cross-context storage sync once.
 *   3. Optionally calls /auth/me to verify the token is still valid — skipped
 *      in popup contexts because they trust the sidebar's state (mirrors
 *      reference-ext AuthManager.init).
 */

import { useEffect } from 'react';
import { useAuthStore, wireAuthCrossContextSync } from '../store/auth.store';
import { AuthService } from '../services/AuthService';

export interface UseAuthBootstrapOptions {
  /** Sidebar should verify the token with /auth/me; popups should not. */
  verifyOnMount?: boolean;
}

export function useAuthBootstrap({ verifyOnMount = false }: UseAuthBootstrapOptions = {}): void {
  useEffect(() => {
    let cancelled = false;
    wireAuthCrossContextSync();
    (async () => {
      await useAuthStore.getState().hydrate();
      if (!cancelled && verifyOnMount) {
        try {
          await AuthService.restoreSession();
        } catch (err) {
          console.warn('[h2-flow] restoreSession failed', err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verifyOnMount]);
}
