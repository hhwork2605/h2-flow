/**
 * api/endpoints/auth.ts — Typed wrappers for /auth/*.
 *
 * Layer: API
 * Owner: features/auth
 *
 * Spec: docs/08-api-contract.md §2. Behaviour mirrors
 * reference-ext/src/core/AuthManager.js so the wire format stays compatible
 * with the existing backend.
 */

import { request } from '@/api/client';
import type {
  LoginPayload,
  RegisterPayload,
  User,
  ForgotPasswordPayload,
} from '@/types/user.types';

export interface LoginResponse {
  token: string;
  user: User;
  refresh_token?: string;
  /** Admin can override the API base URL per user — picked up by AuthManager. */
  apiBaseUrl?: string;
}

export interface RefreshResponse {
  token: string;
  user?: User;
}

export interface GoogleUrlResponse {
  url: string;
}

export interface MeResponse {
  user: User;
}

export interface ForgotPasswordResponse {
  message?: string;
}

export interface RegisterResponse {
  /** Server may or may not auto-login on register. */
  token?: string;
  user?: User;
  message?: string;
}

/** POST /auth/login — anonymous call. */
export async function login(
  payload: LoginPayload,
  extraHeaders?: Record<string, string>,
): Promise<LoginResponse> {
  const { data } = await request<LoginResponse>({
    method: 'POST',
    endpoint: 'auth/login',
    data: payload,
    token: null,
    headers: extraHeaders,
  });
  return data;
}

/** POST /auth/register — anonymous call. */
export async function register(
  payload: RegisterPayload,
  extraHeaders?: Record<string, string>,
): Promise<RegisterResponse> {
  const { data } = await request<RegisterResponse>({
    method: 'POST',
    endpoint: 'auth/register',
    data: payload,
    token: null,
    headers: extraHeaders,
  });
  return data;
}

/** POST /auth/refresh — uses current access token to mint a new one. */
export async function refresh(token: string): Promise<RefreshResponse> {
  const { data } = await request<RefreshResponse>({
    method: 'POST',
    endpoint: 'auth/refresh',
    token,
  });
  return data;
}

/** GET /auth/me — current user. */
export async function fetchMe(token: string): Promise<User> {
  const { data } = await request<MeResponse | User>({
    method: 'GET',
    endpoint: 'auth/me',
    token,
  });
  // Server returns either { user: {...} } or the user object directly.
  return (data as MeResponse).user ?? (data as User);
}

/** POST /auth/logout — best-effort, ignore failures. */
export async function logout(token: string): Promise<void> {
  await request({
    method: 'POST',
    endpoint: 'auth/logout',
    token,
  });
}

/** POST /auth/forgot-password — anonymous. */
export async function forgotPassword(
  payload: ForgotPasswordPayload,
): Promise<ForgotPasswordResponse> {
  const { data } = await request<ForgotPasswordResponse>({
    method: 'POST',
    endpoint: 'auth/forgot-password',
    data: payload,
    token: null,
  });
  return data;
}

/** GET /auth/google/url — returns OAuth start URL. */
export async function googleAuthUrl(): Promise<string> {
  const { data } = await request<GoogleUrlResponse | string>({
    method: 'GET',
    endpoint: 'auth/google/url',
    token: null,
  });
  return typeof data === 'string' ? data : data.url;
}

/** POST /auth/resend-verification-public — anonymous, for unverified login flow. */
export async function resendVerificationPublic(email: string): Promise<void> {
  await request({
    method: 'POST',
    endpoint: 'auth/resend-verification-public',
    data: { email },
    token: null,
  });
}
