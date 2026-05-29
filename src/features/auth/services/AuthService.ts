/**
 * features/auth/services/AuthService.ts — Auth orchestration.
 *
 * Layer: Service
 * Owner: features/auth
 *
 * Sits between the auth store and the API endpoints. Handles:
 *   - login / register → save session
 *   - logout → revoke server-side, clear local state
 *   - refresh → swap tokens with single-flight protection
 *   - restore on mount → fetchMe to verify token still valid
 *
 * Reference flow: reference-ext/src/core/AuthManager.js.
 */

import * as AuthApi from '@/api/endpoints/auth';
import { ApiError } from '@/api/errors';
import { useAuthStore } from '../store/auth.store';
import type { LoginPayload, RegisterPayload, User } from '@/types/user.types';

let refreshInFlight: Promise<void> | null = null;

export const AuthService = {
  async login(payload: LoginPayload): Promise<User> {
    const store = useAuthStore.getState();
    store.setStatus('loading');
    store.setError(null);
    try {
      const res = await AuthApi.login(payload);
      if (!res.token) {
        throw new Error('Login response missing token');
      }
      await store.setSession({
        token: res.token,
        user: res.user,
        apiBaseUrl: res.apiBaseUrl,
        savedAt: Date.now(),
      });
      void notifyBackgroundAuthChanged(true);
      return res.user;
    } catch (err) {
      store.setStatus('unauthenticated');
      store.setError(toMessage(err));
      throw err;
    }
  },

  async register(payload: RegisterPayload): Promise<User | null> {
    const store = useAuthStore.getState();
    store.setStatus('loading');
    store.setError(null);
    try {
      const res = await AuthApi.register(payload);
      if (res.token && res.user) {
        await store.setSession({
          token: res.token,
          user: res.user,
          savedAt: Date.now(),
        });
        void notifyBackgroundAuthChanged(true);
        return res.user;
      }
      // Server is in "email-verification-required" mode → user must click the
      // verification link before logging in.
      store.setStatus('unauthenticated');
      return null;
    } catch (err) {
      store.setStatus('unauthenticated');
      store.setError(toMessage(err));
      throw err;
    }
  },

  async logout(): Promise<void> {
    const store = useAuthStore.getState();
    const token = store.token;
    store.setLoggingOut(true);
    try {
      if (token) {
        try {
          await AuthApi.logout(token);
        } catch (err) {
          // Best-effort — even if the server returns 401 we still clear local state.
          console.warn('[h2-flow] logout API call failed', err);
        }
      }
      await store.clearSession();
      store.setSessionInvalid(true);
      void notifyBackgroundAuthChanged(false);
    } finally {
      store.setLoggingOut(false);
    }
  },

  /** Single-flight refresh. Subsequent callers piggy-back on the in-flight promise. */
  async refresh(): Promise<void> {
    if (refreshInFlight) return refreshInFlight;
    const store = useAuthStore.getState();
    const token = store.token;
    if (!token) {
      throw new Error('No token to refresh');
    }

    store.setRefreshing(true);
    refreshInFlight = (async () => {
      try {
        const res = await AuthApi.refresh(token);
        if (!res.token) throw new Error('Refresh response missing token');
        await store.setSession({
          token: res.token,
          user: res.user ?? store.user!,
          apiBaseUrl: store.apiBaseUrl ?? undefined,
          savedAt: Date.now(),
        });
      } finally {
        store.setRefreshing(false);
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  },

  /**
   * Verify token still works by calling /auth/me. Call on sidebar mount after
   * hydrate(). Refreshes once if `/me` returns 401.
   */
  async restoreSession(): Promise<User | null> {
    const store = useAuthStore.getState();
    if (!store.token) return null;

    try {
      const user = await AuthApi.fetchMe(store.token);
      await store.setSession({
        token: store.token,
        user,
        apiBaseUrl: store.apiBaseUrl ?? undefined,
        savedAt: Date.now(),
      });
      return user;
    } catch (err) {
      if (err instanceof ApiError && err.httpStatus === 401) {
        try {
          await AuthService.refresh();
          const newToken = useAuthStore.getState().token;
          if (newToken) {
            const user = await AuthApi.fetchMe(newToken);
            await store.setSession({
              token: newToken,
              user,
              apiBaseUrl: store.apiBaseUrl ?? undefined,
              savedAt: Date.now(),
            });
            return user;
          }
        } catch {
          await store.clearSession();
          return null;
        }
      }
      // RATE_LIMITED / EXTENSION_NOT_AUTHORIZED / network: keep session, surface to UI.
      console.warn('[h2-flow] restoreSession failed', err);
      return store.user;
    }
  },

  async forgotPassword(email: string): Promise<void> {
    await AuthApi.forgotPassword({ email });
  },

  async startGoogleOAuth(): Promise<void> {
    const url = await AuthApi.googleAuthUrl();
    if (!url) throw new Error('Google auth URL missing');
    chrome.tabs?.create({ url });
  },
};

function toMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

function notifyBackgroundAuthChanged(hasToken: boolean): Promise<void> {
  return new Promise((resolve) => {
    if (!chrome.runtime?.sendMessage) {
      resolve();
      return;
    }
    chrome.runtime.sendMessage({ action: 'auth:changed', hasToken }, () => resolve());
  });
}
