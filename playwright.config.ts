/**
 * Playwright config — e2e tests cho h2-flow web mode.
 *
 * Strategy: dùng `dev:web` (Vite dev server với sidebar.html ở root) để test
 * như SPA thường. KHÔNG load extension thật — extension testing phức tạp hơn
 * và sẽ scope vào sau khi product ổn.
 *
 * Mỗi test PHẢI:
 *   - Cleanup localStorage / IndexedDB ở `beforeEach` để isolated.
 *   - KHÔNG depend vào order — chạy `--shard` không vỡ.
 *   - Comment rõ "Done = ALL true" tương ứng từ PROGRESS.md (nếu test cho 1 chunk).
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // Mỗi test 30s là quá đủ cho UI interaction.
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Trace + screenshot khi fail — debug dễ hơn.
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Auto-spawn Vite dev server. Reuse nếu đã chạy (developer workflow).
  // CRXJS plugin chậm cold start (~60s) — set timeout 120s. Khi dev đã có
  // `npm run dev` chạy sẵn, Playwright sẽ reuse.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/sidebar.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  // Chỉ chạy Chromium — extension target là Chrome, không cần multi-browser.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // CI hardening.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
});
