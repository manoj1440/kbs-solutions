import { defineConfig } from 'tsup';
// ponytail: clean off in watch (keeps dist present for consumers); onSuccess regenerates tokens.css per rebuild
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  onSuccess: options.watch ? 'node scripts/emit-css.mjs' : undefined,
  target: 'es2022',
}));
