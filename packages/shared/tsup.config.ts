import { resolve } from 'node:path';
import { defineConfig } from 'tsup';
// ponytail: clean off in watch — wiping dist mid-session wedges consumers' module resolution
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: !options.watch,
  onSuccess: options.watch ? `node ${resolve(process.cwd(), '../../scripts/dev-bump-api.mjs')}` : undefined,
  target: 'es2022',
}));
