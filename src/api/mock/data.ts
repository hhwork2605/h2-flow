/**
 * mock/data.ts — Mock fixtures.
 *
 * Layer: Mock backend
 * Owner: background/mock
 *
 * Add/edit fixtures here; handlers consume these by reference. Keep data
 * shape aligned with `src/types/*` so swapping mock → real backend is a
 * no-op for the sidebar.
 */

import type { User } from '@/types/user.types';

export interface MockCredential {
  email: string;
  password: string;
  user: User;
}

function makeUser(overrides: Partial<User> & Pick<User, 'id' | 'email' | 'name' | 'plan'>): User {
  return {
    avatar_url: undefined,
    email_verified: true,
    google_linked: false,
    preferred_locale: 'vi',
    preferred_currency: 'VND',
    created_at: '2026-01-01T00:00:00Z',
    plan_expires_at: null,
    trial_active: false,
    trial_ends_at: null,
    referral_code: 'MOCK1234',
    referral_stats: { registered: 0, converted: 0 },
    ...overrides,
  };
}

/**
 * Built-in test accounts. Login with any of these to exercise different
 * plan / verification states. See docs/MOCK-API.md for the full list.
 */
export const MOCK_USERS: MockCredential[] = [
  {
    email: 'pro@example.com',
    password: 'password',
    user: makeUser({
      id: 'usr_pro',
      email: 'pro@example.com',
      name: 'Pro Tester',
      plan: 'pro',
      plan_slug: 'pro',
      plan_expires_at: '2027-01-01T00:00:00Z',
    }),
  },
  {
    email: 'free@example.com',
    password: 'password',
    user: makeUser({
      id: 'usr_free',
      email: 'free@example.com',
      name: 'Free Tester',
      plan: 'free',
      plan_slug: 'free',
    }),
  },
  {
    email: 'trial@example.com',
    password: 'password',
    user: makeUser({
      id: 'usr_trial',
      email: 'trial@example.com',
      name: 'Trial Tester',
      plan: 'trial',
      plan_slug: 'trial',
      trial_active: true,
      trial_ends_at: '2026-06-15T00:00:00Z',
    }),
  },
  {
    email: 'unverified@example.com',
    password: 'password',
    user: makeUser({
      id: 'usr_unverified',
      email: 'unverified@example.com',
      name: 'Unverified Tester',
      plan: 'free',
      plan_slug: 'free',
      email_verified: false,
    }),
  },
  {
    email: 'admin@example.com',
    password: 'password',
    user: makeUser({
      id: 'usr_admin',
      email: 'admin@example.com',
      name: 'Admin Tester',
      plan: 'team',
      plan_slug: 'team',
      role: 'admin',
      is_admin: true,
    }),
  },
];

/**
 * Mock tokens — token → userId mapping. Persist vào localStorage để survive
 * page reload (bug: user đăng nhập + reload → mock SW restart → in-memory
 * Map reset → fetchMe 401 → AuthService.restoreSession clearSession → logout).
 *
 * Persistence shape trong localStorage:
 *   af_mock_tokens: { [token]: userId }
 *   af_mock_dyn_users: { [userId]: User }
 *   af_mock_revoked_tokens: string[]
 *
 * Trong background SW context, localStorage không tồn tại — fallback in-memory.
 * Production thực sự dùng DB backend → bug này CHỈ ảnh hưởng dev/preview mode.
 */
const TOKENS_KEY = 'af_mock_tokens';
const DYN_USERS_KEY = 'af_mock_dyn_users';
const REVOKED_KEY = 'af_mock_revoked_tokens';

const inBrowser = typeof localStorage !== 'undefined';

function loadJson<T>(key: string, fallback: T): T {
  if (!inBrowser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  if (!inBrowser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / unavailable — fallback no-op */
  }
}

/** In-memory mirror — hydrate từ localStorage 1 lần. */
export const MOCK_TOKENS = new Map<string, string>(
  Object.entries(loadJson<Record<string, string>>(TOKENS_KEY, {})),
);
export const MOCK_DYNAMIC_USERS = new Map<string, User>(
  Object.entries(loadJson<Record<string, User>>(DYN_USERS_KEY, {})),
);
const REVOKED_TOKENS = new Set<string>(loadJson<string[]>(REVOKED_KEY, []));

function persistTokens(): void {
  saveJson(TOKENS_KEY, Object.fromEntries(MOCK_TOKENS));
}
function persistDynUsers(): void {
  saveJson(DYN_USERS_KEY, Object.fromEntries(MOCK_DYNAMIC_USERS));
}
function persistRevoked(): void {
  saveJson(REVOKED_KEY, Array.from(REVOKED_TOKENS));
}

export function findUserByEmail(email: string): MockCredential | undefined {
  const lower = email.toLowerCase();
  return MOCK_USERS.find((u) => u.email === lower);
}

export function findUserById(id: string): User | undefined {
  const fixture = MOCK_USERS.find((u) => u.user.id === id);
  if (fixture) return fixture.user;
  return MOCK_DYNAMIC_USERS.get(id);
}

export function issueToken(userId: string): string {
  const token = `mock_${userId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  MOCK_TOKENS.set(token, userId);
  persistTokens();
  return token;
}

export function userFromToken(token: string | null | undefined): User | undefined {
  if (!token) return undefined;
  if (REVOKED_TOKENS.has(token)) return undefined;
  // Tier 1: lookup persisted map (covers fresh logins + reload).
  let userId = MOCK_TOKENS.get(token);
  // Tier 2: parse từ token string (token shape: `mock_<userId>_<ts>_<rand>`).
  // Self-heal khi localStorage bị xoá / lần đầu load token cũ.
  if (!userId && token.startsWith('mock_')) {
    const rest = token.slice('mock_'.length);
    // userId của fixture user là dạng `user_xxx` hoặc `user_${ts}_${rand}` cho dynamic.
    // Reverse-engineer: tách 2 segment cuối là ts+rand, phần đầu là userId.
    const parts = rest.split('_');
    if (parts.length >= 3) {
      userId = parts.slice(0, parts.length - 2).join('_');
      // Re-add vào map để các call sau hit cache.
      MOCK_TOKENS.set(token, userId);
      persistTokens();
    }
  }
  if (!userId) return undefined;
  return findUserById(userId);
}

export function revokeToken(token: string | null | undefined): void {
  if (!token) return;
  MOCK_TOKENS.delete(token);
  REVOKED_TOKENS.add(token);
  persistTokens();
  persistRevoked();
}

/** Caller (register handler) gọi sau khi tạo user mới để persist. */
export function registerDynamicUser(user: User): void {
  MOCK_DYNAMIC_USERS.set(user.id, user);
  persistDynUsers();
}

/* ------------------------------ Public configs ------------------------------ */

export const MOCK_DEFAULT_SETTINGS = {
  default_locale: 'vi' as const,
  supported_locales: ['vi', 'en'] as const,
};

export const MOCK_SYSTEM_SETTINGS = {
  version: 1,
  feature_flags: {
    telegram: true,
    mercure: false,
    capture: true,
    workflow: true,
  },
  limits: {
    max_workflow_nodes: 50,
    max_ref_images: 10,
    max_prompt_length: 4000,
  },
  timeouts: {
    submit_ms: 60_000,
    tile_watch_ms: 300_000,
  },
};

export const MOCK_LOCATION = {
  country: 'VN',
  currency: 'VND',
  locale_suggest: 'vi' as const,
};

export function entitlementsForPlan(plan: User['plan']) {
  const limits = {
    free: { workflow_run: 10, generate: 50, chatgpt_run: 5, task_run: 5 },
    trial: { workflow_run: 50, generate: 200, chatgpt_run: 20, task_run: 30 },
    pro: { workflow_run: 500, generate: 2000, chatgpt_run: 200, task_run: 500 },
    team: { workflow_run: 2000, generate: 10000, chatgpt_run: 1000, task_run: 2000 },
  };
  const cfg = limits[plan];
  const resetsAt = new Date(Date.now() + 24 * 3600_000).toISOString();
  const isPaid = plan !== 'free';
  const isPro = plan === 'pro' || plan === 'team';
  return {
    user_id: 'mock',
    plan,
    plan_expires_at: plan === 'free' ? null : '2027-01-01T00:00:00Z',
    features: {
      // docs/08 convention
      workflow_run: { enabled: true },
      chatgpt: { enabled: isPaid },
      grok: { enabled: isPaid },
      gemini: { enabled: isPro },
      telegram_send: { enabled: isPaid },
      auto_download: { enabled: true },
      auto_download_4k: { enabled: isPaid },
      ref_images: { enabled: true },
      save_album: { enabled: true },
      share_workflow: { enabled: isPro },
      // reference-ext convention (per CLAUDE.md rule)
      gen_enabled: { enabled: true },
      flow_enabled: { enabled: true },
      chatgpt_enabled: { enabled: isPaid },
      grok_enabled: { enabled: isPaid },
      gemini_enabled: { enabled: isPro },
      tasks_enabled: { enabled: isPaid },
      workflows_enabled: { enabled: true },
      workflow_share_enabled: { enabled: isPro },
      angles_enabled: { enabled: true },
      effects_enabled: { enabled: true },
      retry_on_fail: { enabled: isPaid },
      history_enabled: { enabled: true },
      prompt_templates_enabled: { enabled: true },
      workflow_templates_enabled: { enabled: true },
      pipeline_queue_enabled: { enabled: isPaid },
    },
    quotas: {
      workflow_run: {
        action: 'workflow_run',
        limit: cfg.workflow_run,
        used: 0,
        remaining: cfg.workflow_run,
        resets_at: resetsAt,
      },
      generate: {
        action: 'generate',
        limit: cfg.generate,
        used: 0,
        remaining: cfg.generate,
        resets_at: resetsAt,
      },
      chatgpt_run: {
        action: 'chatgpt_run',
        limit: cfg.chatgpt_run,
        used: 0,
        remaining: cfg.chatgpt_run,
        resets_at: resetsAt,
      },
      task_run: {
        action: 'task_run',
        limit: cfg.task_run,
        used: 0,
        remaining: cfg.task_run,
        resets_at: resetsAt,
      },
    },
  };
}

/* ----------------------- Providers + Models fixtures ----------------------- */

/**
 * Provider list user-facing. Gemini đã bỏ vì h2-flow tạm chưa support
 * (Phase 4 P4.3 đã defer). Khi nào thêm lại, uncomment dòng gemini bên dưới.
 */
export const MOCK_PROVIDERS = [
  { key: 'flow' as const, name: 'Google Flow', url: 'https://labs.google/fx', enabled: true, version: 1 },
  { key: 'chatgpt' as const, name: 'ChatGPT', url: 'https://chatgpt.com', enabled: true, version: 1 },
  { key: 'grok' as const, name: 'Grok', url: 'https://grok.com', enabled: true, version: 1 },
  // { key: 'gemini' as const, name: 'Gemini', url: 'https://gemini.google.com', enabled: false, version: 1 },
];

export const MOCK_MODELS = [
  // Flow — image
  { id: 1, provider: 'flow' as const, media_type: 'image' as const, name: 'Imagen 3', value: 'imagen-3', is_default: true, is_premium: false, sort_order: 1 },
  { id: 2, provider: 'flow' as const, media_type: 'image' as const, name: 'Imagen 3 Fast', value: 'imagen-3-fast', is_default: false, is_premium: false, sort_order: 2 },
  { id: 3, provider: 'flow' as const, media_type: 'image' as const, name: 'Nano Banana Pro', value: 'nano-banana-pro', is_default: false, is_premium: true, sort_order: 3 },
  // Flow — video
  { id: 4, provider: 'flow' as const, media_type: 'video' as const, name: 'Veo 2', value: 'veo-2', is_default: true, is_premium: false, sort_order: 1 },
  { id: 5, provider: 'flow' as const, media_type: 'video' as const, name: 'Veo 3.1', value: 'veo-3-1', is_default: false, is_premium: true, sort_order: 2 },
  // ChatGPT — image
  { id: 6, provider: 'chatgpt' as const, media_type: 'image' as const, name: 'GPT-4o', value: 'gpt-4o', is_default: true, is_premium: false, sort_order: 1 },
  { id: 7, provider: 'chatgpt' as const, media_type: 'image' as const, name: 'DALL-E 3', value: 'dall-e-3', is_default: false, is_premium: false, sort_order: 2 },
  // Grok — image
  { id: 8, provider: 'grok' as const, media_type: 'image' as const, name: 'Grok Image 2', value: 'grok-image-2', is_default: true, is_premium: false, sort_order: 1 },
  // Gemini — image
  { id: 9, provider: 'gemini' as const, media_type: 'image' as const, name: 'Gemini Imagen', value: 'gemini-imagen', is_default: true, is_premium: false, sort_order: 1 },
];

export const MOCK_PROVIDER_API_CONFIGS = {
  flow: {
    trpc_base: 'https://labs.google/fx/api/trpc',
    media_url_pattern: 'getMediaUrlRedirect',
    max_quantity: 4,
  },
  chatgpt: { max_quantity: 1 },
  grok: { max_quantity: 1 },
  gemini: { max_quantity: 1 },
};

/**
 * Shape: `{ [providerKey]: { selectors: { [key]: { selectors: string[] } } } }`
 *
 * Mỗi key có ARRAY selectors (priority order — first match wins). Content
 * script try từng selector cho đến khi match, skip selector invalid. Reference:
 * `reference-ext/chat-content-chatgpt.js` `_queryWithFallback`.
 */
export const MOCK_PROVIDER_DOM_SELECTORS = {
  flow: {
    selectors: {
      prompt_editor: { selectors: ["div[contenteditable='true']"] },
      submit_button: { selectors: ["button[aria-label='Generate']"] },
      tile_container: { selectors: ['[data-tile-id]'] },
    },
  },
  chatgpt: {
    selectors: {
      prompt_textarea: {
        selectors: [
          '#prompt-textarea',
          "div[contenteditable='true'][data-virtualkeyboard='true']",
          "div[contenteditable='true']",
        ],
      },
      composer: {
        selectors: ['#prompt-textarea', "div[contenteditable='true']"],
      },
      submit_button: {
        selectors: ["button[data-testid='send-button']", "button[aria-label='Send prompt']"],
      },
      stop_button: {
        selectors: ["button[data-testid='stop-button']", "button[aria-label='Stop generating']"],
      },
      login_button: {
        selectors: ["a[data-testid='login-button']", "button[data-testid='login-button']"],
      },
      composer_plus_button: {
        selectors: ["button[aria-label='Attach files']", "button[data-testid='composer-plus']"],
      },
      create_image_menu_item: {
        selectors: ["[role='menuitem']:has-text('Create image')", "div[data-testid='create-image-menu-item']"],
      },
      ratio_control: {
        selectors: ["button[data-testid='image-ratio-button']"],
      },
      cdn_image: {
        selectors: [
          "img[src*='oaiusercontent']",
          "img[src*='backend-api']",
          "img[src*='sandboxed.openai']",
          "img[alt^='Generated image']",
        ],
      },
      generating_indicator: {
        selectors: [
          "div[data-testid='generating-image-indicator']",
          "span:has-text('Generating image')",
        ],
      },
    },
  },
  grok: {
    selectors: {
      prompt_input: { selectors: ['textarea[name=prompt]', "textarea[aria-label='Ask Grok anything']"] },
      submit_button: { selectors: ['button[type=submit]', "button[aria-label='Submit']"] },
      cdn_image: { selectors: ['img.gen-result', "img[src*='x.ai']"] },
    },
  },
  gemini: {
    selectors: {
      prompt_input: { selectors: ['rich-textarea', "div[contenteditable='true']"] },
      submit_button: { selectors: ["button[aria-label='Send message']"] },
      cdn_image: { selectors: ["img[data-test-id=generated-image]"] },
    },
  },
};

/* ------------------------- Execution gate state --------------------------- */

interface ActiveExecution {
  action: string;
  promptCount: number;
  remainingAfter: number;
  limit: number;
  user_id: string | null;
}
export const MOCK_EXECUTIONS = new Map<string, ActiveExecution>();
/** Action key → used count (resets when SW reloads — fine for testing). */
export const MOCK_QUOTA_USED = new Map<string, number>();

export function issueExecutionToken(): string {
  return `exec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
