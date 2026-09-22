import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts', 'src/seed.ts'],
  format: ['esm', 'cjs'],
  dts: { entry: ['src/index.ts', 'src/seed.ts'] },
  sourcemap: true,
  clean: true,
  shims: true,
  target: 'node22',
  platform: 'node',
  external: ['@prisma/client', '@prisma/adapter-pg', 'pg', '@kbs/shared', 'dotenv'],
});
