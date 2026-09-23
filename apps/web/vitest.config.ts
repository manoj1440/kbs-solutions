import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit tests only; Playwright specs in e2e/ run with `pnpm test:e2e` (F-901).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  test: { include: ['test/**/*.test.{ts,tsx}'], exclude: ['e2e/**', 'node_modules/**'] },
});
