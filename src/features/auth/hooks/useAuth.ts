/**
 * features/auth/hooks/useAuth.ts — Sidebar-facing auth hook.
 *
 * Layer: Hook
 * Owner: features/auth
 *
 * Thin wrapper around the auth store + AuthService. Components should depend
 * on this — never reach into the store directly so we can swap the backing
 * implementation without rippling.
 */

import { useCallback } from 'react';
import { useAuthStore } from '../store/auth.store';
import { AuthService } from '../services/AuthService';
import type { LoginPayload, RegisterPayload } from '@/types/user.types';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);

  const login = useCallback((payload: LoginPayload) => AuthService.login(payload), []);
  const register = useCallback((payload: RegisterPayload) => AuthService.register(payload), []);
  const logout = useCallback(() => AuthService.logout(), []);
  const forgotPassword = useCallback((email: string) => AuthService.forgotPassword(email), []);
  const startGoogleOAuth = useCallback(() => AuthService.startGoogleOAuth(), []);

  return {
    user,
    token,
    status,
    error,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    login,
    register,
    logout,
    forgotPassword,
    startGoogleOAuth,
  };
}
