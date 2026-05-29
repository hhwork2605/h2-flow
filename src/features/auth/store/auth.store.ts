/**
 * features/auth/store/auth.store.ts — Auth session state.
 *
 * Layer: State
 * Owner: features/auth
 *
 * Persists to `chrome.storage.local.af_auth` (shape matches reference-ext
 * AuthManager so an existing user's session keeps working after migration).
 * Cross-context sync via `chrome.storage.onChanged` so sidebar + popups +
 * settings page agree on the current session.
 */

import { create } from 'zustand';
import { getStorage, onStorageChange, removeStorage, setStorage } from '@/storage/chrome-storage';
import { setApiBaseUrlOverride } from '@/api/config';
import type { AuthSession, User } from '@/types/user.types';

const AUTH_KEY = 'af_auth';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  token: string | null;
  user: User | null;
  apiBaseUrl: string | null;
  status: AuthStatus;
  error: string | null;

  // Internal flags mirroring reference-ext AuthManager — used by error guards
  // in api/endpoints to short-circuit during logout/refresh races.
  sessionInvalid: boolean;
  loggingOut: boolean;
  refreshing: boolean;

  /** Hydrate from chrome.storage.local on mount. */
  hydrate: () => Promise<void>;

  /** Replace the session (after login/register/refresh). */
  setSession: (session: AuthSession) => Promise<void>;

  /** Clear session (after logout or refresh failure). */
  clearSession: () => Promise<void>;

  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  setLoggingOut: (value: boolean) => void;
  setRefreshing: (value: boolean) => void;
  setSessionInvalid: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  apiBaseUrl: null,
  status: 'idle',
  error: null,
  sessionInvalid: false,
  loggingOut: false,
  refreshing: false,

  hydrate: async () => {
    set({ status: 'loading' });
    const stored = await getStorage<AuthSession>(AUTH_KEY);
    if (stored?.token && stored.user) {
      setApiBaseUrlOverride(stored.apiBaseUrl ?? null);
      set({
        token: stored.token,
        user: stored.user,
        apiBaseUrl: stored.apiBaseUrl ?? null,
        status: 'authenticated',
        sessionInvalid: false,
      });
    } else {
      set({
        token: null,
        user: null,
        apiBaseUrl: null,
        status: 'unauthenticated',
      });
    }
  },

  setSession: async (session) => {
    setApiBaseUrlOverride(session.apiBaseUrl ?? null);
    set({
      token: session.token,
      user: session.user,
      apiBaseUrl: session.apiBaseUrl ?? null,
      status: 'authenticated',
      error: null,
      sessionInvalid: false,
      loggingOut: false,
    });
    await setStorage(AUTH_KEY, {
      ...session,
      savedAt: Date.now(),
    } satisfies AuthSession);
  },

  clearSession: async () => {
    setApiBaseUrlOverride(null);
    set({
      token: null,
      user: null,
      apiBaseUrl: null,
      status: 'unauthenticated',
      error: null,
    });
    await removeStorage(AUTH_KEY);
  },

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setLoggingOut: (value) => set({ loggingOut: value }),
  setRefreshing: (value) => set({ refreshing: value }),
  setSessionInvalid: (value) => set({ sessionInvalid: value }),
}));

/** Cross-context sync: another context (popup, settings tab) updated `af_auth`. */
let crossContextSyncWired = false;
export function wireAuthCrossContextSync(): void {
  if (crossContextSyncWired) return;
  crossContextSyncWired = true;
  onStorageChange<AuthSession>(AUTH_KEY, (newValue) => {
    const state = useAuthStore.getState();
    if (!newValue) {
      if (state.token != null) void state.clearSession();
      return;
    }
    if (newValue.token !== state.token) {
      void state.setSession(newValue);
    }
  });
}
