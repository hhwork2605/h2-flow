/**
 * vitest.config.ts — unit test config.
 *
 * Layer: Test tooling
 * Owner: project root
 *
 * Default `node` env cho store / executor / session tests. Content script
 * tests opt-in `jsdom` qua docblock `// @vitest-environment jsdom`.
 *
 * Tests e2e (Playwright) chạy riêng qua `npm run test:e2e` (xem
 * playwright.config.ts).
 */

import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    // Reset Zustand store + global state between files.
    isolate: true,
  },
});
