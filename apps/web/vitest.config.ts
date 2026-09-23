import { defineConfig } from 'vitest/config';

// Unit tests only; Playwright specs in e2e/ run with `pnpm test:e2e` (F-901).
export default defineConfig({ test: { include: ['test/**/*.test.ts'], exclude: ['e2e/**', 'node_modules/**'] } });
