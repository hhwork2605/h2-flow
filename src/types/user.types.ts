/**
 * user.types.ts — User & Auth domain types.
 *
 * Layer: Types
 * Owner: shared
 *
 * Spec: docs/06-data-models.md §1. Behaviour ground truth:
 * reference-ext/src/core/AuthManager.js (af_auth shape, apiBaseUrl override).
 */

export type PlanKey = 'free' | 'pro' | 'team' | 'trial';

export type Locale = 'vi' | 'en';
export type Currency = 'VND' | 'USD' | 'THB' | 'JPY';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  email_verified: boolean;
  google_linked: boolean;
  preferred_locale: Locale;
  preferred_currency: Currency;
  created_at: string;

  // Plan info
  plan: PlanKey;
  plan_slug?: string; // reference-ext also reads plan_slug — keep both for compat
  plan_expires_at: string | null;
  trial_active: boolean;
  trial_ends_at: string | null;

  // Admin
  role?: string;
  is_admin?: boolean;

  // Referral
  referral_code: string;
  referral_stats: {
    registered: number;
    converted: number;
  };
}

/**
 * Persisted in `chrome.storage.local.af_auth`. Shape matches
 * reference-ext/src/core/AuthManager.js so users migrating from production
 * keep their session.
 */
export interface AuthSession {
  token: string;
  user: User;
  apiBaseUrl?: string; // admin can override per-user
  savedAt: number; // ms epoch
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  referred_by?: string;
}

export interface ForgotPasswordPayload {
  email: string;
}
