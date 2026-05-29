/**
 * mock/handlers.ts — Mock endpoint handlers.
 *
 * Layer: Mock backend
 * Owner: background/mock
 *
 * Each handler returns an `ApiEnvelope` directly — same shape the real
 * backend produces — so the sidebar can't tell mock from real.
 */

import type { ApiEnvelope } from '@/types/api.types';
import type { ApiRequestMessage } from '@/types/messages.types';
import type { User } from '@/types/user.types';
import {
  MOCK_DEFAULT_SETTINGS,
  MOCK_DYNAMIC_USERS,
  registerDynamicUser,
  MOCK_EXECUTIONS,
  MOCK_LOCATION,
  MOCK_MODELS,
  MOCK_PROVIDER_API_CONFIGS,
  MOCK_PROVIDER_DOM_SELECTORS,
  MOCK_PROVIDERS,
  MOCK_QUOTA_USED,
  MOCK_SYSTEM_SETTINGS,
  entitlementsForPlan,
  findUserByEmail,
  issueExecutionToken,
  issueToken,
  revokeToken,
  userFromToken,
} from './data';

type MockHandler = (req: ApiRequestMessage) => ApiEnvelope | Promise<ApiEnvelope>;

const ok = <T>(data: T, httpStatus = 200): ApiEnvelope<T> => ({
  success: true,
  httpStatus,
  data,
});

const fail = (
  code: string,
  message: string,
  httpStatus: number,
  details?: Record<string, string[]>,
): ApiEnvelope => ({
  success: false,
  httpStatus,
  error: { code, message, details: details ?? null, exception: null },
});

const validation = (details: Record<string, string[]>): ApiEnvelope =>
  fail('VALIDATION_ERROR', 'Validation failed', 422, details);

function asBody(data: unknown): Record<string, unknown> {
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function emailValid(email: unknown): email is string {
  return typeof email === 'string' && /.+@.+\..+/.test(email);
}

/* ------------------------------- /auth -------------------------------------- */

const login: MockHandler = (req) => {
  const body = asBody(req.data);
  const email = body.email;
  const password = body.password;

  const errors: Record<string, string[]> = {};
  if (!emailValid(email)) errors.email = ['Email không hợp lệ'];
  if (typeof password !== 'string' || password.length < 6) {
    errors.password = ['Mật khẩu phải có ít nhất 6 ký tự'];
  }
  if (Object.keys(errors).length > 0) return validation(errors);

  const account = findUserByEmail(email as string);
  if (!account || account.password !== password) {
    return fail('UNAUTHENTICATED', 'Email hoặc mật khẩu không chính xác', 401);
  }
  if (!account.user.email_verified) {
    return fail(
      'EMAIL_NOT_VERIFIED',
      'Email chưa được xác minh. Vui lòng kiểm tra hộp thư.',
      403,
    );
  }
  const token = issueToken(account.user.id);
  return ok({ token, user: account.user });
};

const register: MockHandler = (req) => {
  const body = asBody(req.data);
  const name = body.name;
  const email = body.email;
  const password = body.password;
  const confirm = body.password_confirmation;

  const errors: Record<string, string[]> = {};
  if (typeof name !== 'string' || name.trim().length < 2) errors.name = ['Tên phải có ít nhất 2 ký tự'];
  if (!emailValid(email)) errors.email = ['Email không hợp lệ'];
  if (typeof password !== 'string' || password.length < 6) {
    errors.password = ['Mật khẩu phải có ít nhất 6 ký tự'];
  }
  if (typeof confirm !== 'string' || confirm !== password) {
    errors.password_confirmation = ['Xác nhận mật khẩu không khớp'];
  }
  if (Object.keys(errors).length > 0) return validation(errors);

  // Duplicate check vs both fixtures + dynamic.
  if (findUserByEmail(email as string)) {
    return fail('VALIDATION_ERROR', 'Email đã tồn tại', 422, {
      email: ['Email này đã được đăng ký'],
    });
  }
  for (const u of MOCK_DYNAMIC_USERS.values()) {
    if (u.email.toLowerCase() === (email as string).toLowerCase()) {
      return fail('VALIDATION_ERROR', 'Email đã tồn tại', 422, {
        email: ['Email này đã được đăng ký'],
      });
    }
  }

  const id = `usr_dyn_${Date.now().toString(36)}`;
  const user: User = {
    id,
    email: (email as string).toLowerCase(),
    name: (name as string).trim(),
    email_verified: true,
    google_linked: false,
    preferred_locale: 'vi',
    preferred_currency: 'VND',
    created_at: new Date().toISOString(),
    plan: 'free',
    plan_slug: 'free',
    plan_expires_at: null,
    trial_active: true,
    trial_ends_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    referral_code: id.slice(-6).toUpperCase(),
    referral_stats: { registered: 0, converted: 0 },
  };
  registerDynamicUser(user);
  const token = issueToken(id);
  return ok({ token, user });
};

const refresh: MockHandler = (req) => {
  const current = userFromToken(req.token);
  if (!current) return fail('UNAUTHENTICATED', 'Token không hợp lệ', 401);
  revokeToken(req.token);
  const token = issueToken(current.id);
  return ok({ token, user: current });
};

const me: MockHandler = (req) => {
  const user = userFromToken(req.token);
  if (!user) return fail('UNAUTHENTICATED', 'Token không hợp lệ', 401);
  return ok({ user });
};

const logout: MockHandler = (req) => {
  revokeToken(req.token);
  return ok({});
};

const forgotPassword: MockHandler = (req) => {
  const body = asBody(req.data);
  if (!emailValid(body.email)) return validation({ email: ['Email không hợp lệ'] });
  return ok({ message: `Đã gửi link đặt lại mật khẩu tới ${body.email}` });
};

const resendVerificationPublic: MockHandler = (req) => {
  const body = asBody(req.data);
  if (!emailValid(body.email)) return validation({ email: ['Email không hợp lệ'] });
  return ok({ message: 'Đã gửi lại email xác minh' });
};

const googleAuthUrl: MockHandler = () =>
  ok({
    url:
      'https://your-backend.example.com/auth/google/url?mock=1&note=' +
      encodeURIComponent('Mock URL — Google OAuth chưa hoạt động khi mock=true'),
  });

/* --------------------------- Public configs --------------------------------- */

const health: MockHandler = () => ok({ status: 'ok', version: 'mock-1.0.0', uptime_sec: 0 });

const defaultSettings: MockHandler = () => ok(MOCK_DEFAULT_SETTINGS);
const systemSettings: MockHandler = () => ok(MOCK_SYSTEM_SETTINGS);
const locationMe: MockHandler = () => ok(MOCK_LOCATION);

const entitlements: MockHandler = (req) => {
  const user = userFromToken(req.token);
  // Anonymous → free entitlements, paid endpoint flags disabled.
  return ok(entitlementsForPlan(user?.plan ?? 'free'));
};

/* ------------------------------ Anti-clone ---------------------------------- */

const extensionAuthorized: MockHandler = () => ok({ authorized: true });

/* --------------------------- Providers + Models ---------------------------- */

const providers: MockHandler = () => ok({ providers: MOCK_PROVIDERS });
const providerModels: MockHandler = () => ok(MOCK_MODELS);
const providerApiConfigs: MockHandler = () => ok({ configs: MOCK_PROVIDER_API_CONFIGS });
const providerDomSelectors: MockHandler = () => ok({ selectors: MOCK_PROVIDER_DOM_SELECTORS });

/* ----------------------------- Execution Gate ----------------------------- */

const executionRequest: MockHandler = (req) => {
  const body = asBody(req.data);
  const action = body.action;
  const promptCount = Number(body.prompt_count ?? 1);

  if (typeof action !== 'string' || !['generate', 'task_run', 'workflow_run', 'angles_run', 'effects_run'].includes(action)) {
    return validation({ action: ['Invalid action'] });
  }
  if (!Number.isFinite(promptCount) || promptCount < 1) {
    return validation({ prompt_count: ['prompt_count must be >= 1'] });
  }

  const user = userFromToken(req.token);
  const plan = user?.plan ?? 'free';
  const entitlements = entitlementsForPlan(plan);
  const quota = entitlements.quotas[action as keyof typeof entitlements.quotas];
  if (!quota) {
    return fail('FEATURE_DISABLED', `Action ${action} not available on plan ${plan}`, 403);
  }

  const used = MOCK_QUOTA_USED.get(action) ?? 0;
  if (used + promptCount > quota.limit) {
    return fail('QUOTA_EXCEEDED', `Đã hết quota ${action}`, 403, undefined);
  }

  MOCK_QUOTA_USED.set(action, used + promptCount);
  const remaining = quota.limit - (used + promptCount);
  const execToken = issueExecutionToken();
  MOCK_EXECUTIONS.set(execToken, {
    action,
    promptCount,
    remainingAfter: remaining,
    limit: quota.limit,
    user_id: user?.id ?? null,
  });

  return ok({
    execution_token: execToken,
    expires_in: 300,
    remaining,
    limit: quota.limit,
    used: used + promptCount,
    global: { remaining: 4500, limit: 5000, used: 500 },
  });
};

const executionComplete: MockHandler = (req) => {
  const body = asBody(req.data);
  const tokenStr = body.execution_token;
  if (typeof tokenStr !== 'string') return validation({ execution_token: ['Required'] });
  MOCK_EXECUTIONS.delete(tokenStr);
  return ok({});
};

const executionCancel: MockHandler = (req) => {
  const body = asBody(req.data);
  const tokenStr = body.execution_token;
  if (typeof tokenStr !== 'string') return validation({ execution_token: ['Required'] });
  const active = MOCK_EXECUTIONS.get(tokenStr);
  if (active) {
    // Refund cancelled prompts to the per-action used counter (matches the
    // production "cancel-without-billing" semantic — admin can override).
    const prev = MOCK_QUOTA_USED.get(active.action) ?? 0;
    MOCK_QUOTA_USED.set(active.action, Math.max(0, prev - active.promptCount));
    MOCK_EXECUTIONS.delete(tokenStr);
  }
  return ok({});
};

/* ------------------------------ i18n --------------------------------------- */

const i18nVi: MockHandler = () =>
  ok({
    version: 1,
    translations: {
      'header.signIn': 'Đăng nhập',
      'header.signOut': 'Đăng xuất',
      'header.upgrade': 'Nâng cấp',
      'header.settings': 'Cài đặt',
      'tabs.generate': 'Tạo ảnh',
      'tabs.multiTask': 'Multi-Task',
      'tabs.workflow': 'Workflow',
      'tabs.photos': 'Ảnh',
      'tabs.history': 'Lịch sử',
      'tabs.logs': 'Logs',
    },
  });

const i18nEn: MockHandler = () =>
  ok({
    version: 1,
    translations: {
      'header.signIn': 'Sign in',
      'header.signOut': 'Sign out',
      'header.upgrade': 'Upgrade',
      'header.settings': 'Settings',
      'tabs.generate': 'Generate',
      'tabs.multiTask': 'Multi-Task',
      'tabs.workflow': 'Workflow',
      'tabs.photos': 'Photos',
      'tabs.history': 'History',
      'tabs.logs': 'Logs',
    },
  });

/* ------------------------------ Routing ------------------------------------- */

/** Exact match `METHOD endpoint` → handler. */
const ROUTES: Record<string, MockHandler> = {
  // Auth
  'POST auth/login': login,
  'POST auth/register': register,
  'POST auth/refresh': refresh,
  'GET auth/me': me,
  'POST auth/logout': logout,
  'POST auth/forgot-password': forgotPassword,
  'POST auth/resend-verification-public': resendVerificationPublic,
  'GET auth/google/url': googleAuthUrl,

  // Public configs
  'GET health': health,
  'GET default-settings': defaultSettings,
  'GET system-settings/public': systemSettings,
  'GET location/me': locationMe,
  'GET entitlements': entitlements,

  // Anti-clone
  'GET extension/authorized': extensionAuthorized,

  // Providers + Models
  'GET providers': providers,
  'GET provider-models': providerModels,
  'GET providers/api-configs': providerApiConfigs,
  'GET providers/dom-selectors': providerDomSelectors,

  // Execution Gate
  'POST execution/request': executionRequest,
  'POST execution/complete': executionComplete,
  'POST execution/cancel': executionCancel,

  // i18n
  'GET i18n/vi': i18nVi,
  'GET i18n/en': i18nEn,
};

export function findMockHandler(method: string, endpoint: string): MockHandler | undefined {
  const normEndpoint = endpoint.replace(/^\/+/, '');
  return ROUTES[`${method.toUpperCase()} ${normEndpoint}`];
}

export const MOCK_ROUTE_KEYS = Object.keys(ROUTES);
