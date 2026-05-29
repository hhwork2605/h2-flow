# Mock API — testing without a backend

Phase 1 ships a built-in mock backend so you can exercise the UI (login, register, logout, public configs…) without spinning up a real server. The mock dispatches in **two contexts**:

- **Extension build** (`npm run build` → load `dist/` in Chrome): mock lives inside the background service worker. Every `apiRequest` from the sidebar / popup goes through `chrome.runtime.sendMessage` → background → mock.
- **Browser preview** (`npm run dev:web` → open `http://localhost:5173/sidebar.html`): no background available, so the sidebar dispatches the mock directly in-page. Same fixtures, same envelope, same latency.

> **Where it lives**: [`src/api/mock/`](../src/api/mock/). The dispatcher is wired into both [`src/background/api-proxy.ts`](../src/background/api-proxy.ts) (extension) and [`src/api/client.ts`](../src/api/client.ts) (in-page fallback).

---

## 1. Quick start — two ways

### A. Browser preview (no extension install)

Fastest iteration loop — just a regular browser tab. Storage falls back to
`localStorage`, API calls dispatch the mock in-page.

```bash
npm run dev:web
```

Vite opens `http://localhost:5173/sidebar.html` automatically. HMR works.
Other entries (visit URL manually):

- `http://localhost:5173/sidebar.html`
- `http://localhost:5173/workflow-editor.html`
- `http://localhost:5173/settings.html`
- `http://localhost:5173/angles-editor.html`
- `http://localhost:5173/effects-editor.html`

**Tip**: open Chrome DevTools → Device toolbar (Ctrl+Shift+M) → set
width 380px to mimic the real Chrome side panel.

**Caveats** in this mode:
- `chrome.tabs.create` (Google OAuth, Chrome Web Store link) just `console.warn`s.
- `chrome.sidePanel` / `chrome.alarms` not available — anti-clone self-heal probe runs only in the extension SW.

### B. Extension build (production-like)

Full extension context — background SW, side panel, content scripts.

1. Copy `.env.example` → `.env.local` (defaults are mock-friendly).
2. `npm run build`.
3. Load `dist/` in `chrome://extensions/` (Developer mode → Load unpacked).
4. Click the h2-flow icon → side panel opens → click **Đăng nhập**.

### Test accounts (both modes)

Use any account in §3 below. The first mock call logs a one-time banner in
the DevTools console (background SW for extension mode, page console for
browser preview):

```
[h2-flow] Mock backend ENABLED (17 routes). Set VITE_USE_MOCK=false in .env.local to use real backend.
```

---

## 2. Toggle on / off

| `.env.local`           | Behaviour                                                                |
| ---------------------- | ------------------------------------------------------------------------ |
| `VITE_USE_MOCK=true`   | (default) Mock intercepts every request. Real `VITE_API_BASE_URL` ignored. |
| `VITE_USE_MOCK=false`  | No interception — calls go to `VITE_API_BASE_URL` as normal.             |
| (unset)                | Treated as `true`.                                                       |

Mocks are bundled into the background SW at build time — to switch, edit `.env.local` and rebuild.

---

## 3. Test accounts

Five fixtures live in [`src/api/mock/data.ts`](../src/api/mock/data.ts). Password is always **`password`** so you can swap accounts quickly while testing.

| Email                       | Plan  | Verified | Use for                                                  |
| --------------------------- | ----- | -------- | -------------------------------------------------------- |
| `pro@example.com`           | pro   | ✅       | Default — Pro features unlocked                          |
| `free@example.com`          | free  | ✅       | Quota / feature-gate denied flows                        |
| `trial@example.com`         | trial | ✅       | Trial expiry banner                                      |
| `unverified@example.com`    | free  | ❌       | `EMAIL_NOT_VERIFIED` 403 on login → resend-verify flow   |
| `admin@example.com`         | team  | ✅       | Admin-only screens (templates manager…)                  |

Register form also works — newly created users get a 7-day trial automatically (`plan: 'free'`, `trial_active: true`).

---

## 4. Mocked routes (17)

All paths are relative to `VITE_API_BASE_URL`. Format follows [`docs/08-api-contract.md`](08-api-contract.md) — refer to that for the full real-backend contract.

### Auth

| Method | Endpoint                            | Body / Query                                              | Mock returns                                                                  |
| ------ | ----------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| POST   | `auth/login`                        | `{ email, password }`                                     | `{ token, user }` · 401 wrong creds · 403 if `email_verified=false` · 422 validation |
| POST   | `auth/register`                     | `{ name, email, password, password_confirmation }`        | `{ token, user }` (auto-login) · 422 if email taken / mismatched confirm      |
| POST   | `auth/refresh`                      | (uses Bearer token)                                       | New `{ token, user }`. Old token revoked.                                     |
| GET    | `auth/me`                           | (uses Bearer token)                                       | `{ user }` · 401 if token invalid                                             |
| POST   | `auth/logout`                       | (uses Bearer token)                                       | `{}` · always 200                                                             |
| POST   | `auth/forgot-password`              | `{ email }`                                               | `{ message }`                                                                 |
| POST   | `auth/resend-verification-public`   | `{ email }`                                               | `{ message }`                                                                 |
| GET    | `auth/google/url`                   | —                                                         | `{ url }` (placeholder — Google OAuth doesn't actually work in mock mode)     |

### Public configs

| Method | Endpoint                  | Mock returns                                                                          |
| ------ | ------------------------- | ------------------------------------------------------------------------------------- |
| GET    | `health`                  | `{ status: 'ok', version: 'mock-1.0.0', uptime_sec: 0 }`                              |
| GET    | `default-settings`        | `{ default_locale: 'vi', supported_locales: ['vi','en','th','ja'] }`                  |
| GET    | `system-settings/public`  | feature flags + limits + timeouts (see `data.ts` `MOCK_SYSTEM_SETTINGS`)              |
| GET    | `location/me`             | `{ country: 'VN', currency: 'VND', locale_suggest: 'vi' }`                            |
| GET    | `entitlements`            | Plan-scaled quotas. Anonymous (no token) → free plan. Authenticated → user's plan.   |

### Anti-clone & i18n

| Method | Endpoint              | Mock returns                                  |
| ------ | --------------------- | --------------------------------------------- |
| GET    | `extension/authorized` | `{ authorized: true }` (never trips the overlay) |
| GET    | `i18n/vi`             | A small Vietnamese translation set            |
| GET    | `i18n/en`             | Matching English keys                         |

---

## 5. Response envelope

All mock responses follow the same envelope the real backend produces — see [`src/types/api.types.ts`](../src/types/api.types.ts):

```ts
// Success
{ success: true, httpStatus: 200, data: <payload> }

// Failure
{
  success: false,
  httpStatus: 401,
  error: { code: 'UNAUTHENTICATED', message: '...', details: null, exception: null }
}
```

422 validation errors include a `details` map:

```ts
{
  success: false,
  httpStatus: 422,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: { email: ['Email không hợp lệ'], password: ['Mật khẩu phải có ít nhất 6 ký tự'] }
  }
}
```

LoginModal / RegisterModal already pick the first `details[field][0]` to surface in the form — so 422s show a clean error message.

---

## 6. Behaviour notes

- **Latency**: every mock waits 120–380 ms before responding to mimic a real network. Edit `MIN_LATENCY_MS` / `MAX_LATENCY_MS` in [`mock/index.ts`](../src/api/mock/index.ts) to taste.
- **Tokens**: opaque `mock_<userId>_<random>` strings. Stored in an in-memory `Map` inside the background SW — they vanish when Chrome unloads the worker. The sidebar persists `af_auth` to `chrome.storage.local` so the user sees a logged-in shell until the next `/auth/me` call returns 401, after which `restoreSession` clears the session cleanly.
- **No CORS, no signing**: mock returns BEFORE the request leaves the background SW, so HMAC headers and `apiBaseUrl` are irrelevant when mocks are on.
- **Unknown routes**: when mocks are ON but the route isn't registered, the dispatcher returns a 404 `NOT_FOUND` envelope and logs a warning — much louder than silently hitting the placeholder URL.

---

## 7. Adding a new mock route

1. Add fixture data to [`src/api/mock/data.ts`](../src/api/mock/data.ts) if you need shared state.
2. Add a handler in [`src/api/mock/handlers.ts`](../src/api/mock/handlers.ts):
   ```ts
   const myEndpoint: MockHandler = (req) => {
     const body = asBody(req.data);
     if (!body.foo) return validation({ foo: ['foo is required'] });
     return ok({ result: 'hello world' });
   };
   ```
3. Register it in the `ROUTES` table at the bottom:
   ```ts
   const ROUTES: Record<string, MockHandler> = {
     // ...
     'POST workflows': myEndpoint,
   };
   ```
4. Document it here (table in §4).

That's it — `npm run build` + reload extension → the new route is live.

---

## 8. Roadmap of routes still missing

Mock currently covers the **Phase 1** endpoints only. The following phases will extend this file as they land:

- Phase 2: `provider-models`, `providers/api-configs`, `providers/dom-selectors`, `flow/tile-resolve`, `execution/*`
- Phase 3: `workflows`, `workflows/{id}/runs`, `workflows/{id}/nodes/{node_id}`
- Phase 4: SSE / Mercure mocks (will use a fake EventSource), `provider-models`
- Phase 5: `plans`, `orders`, `tip-config`, `telegram/*`
- Phase 6: `templates/*`, `photos`, `history`, `albums/*`

If you need an unmocked endpoint sooner, ping back and we'll add it.
