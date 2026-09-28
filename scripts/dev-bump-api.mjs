// tsc --watch misses changes inside pnpm-symlinked node_modules (watches the link path,
// fs events report the real path). Called by @kbs/shared's tsup onSuccess: rewrite a
// src file the api program owns so nest re-emits and respawns on fresh dist.
import { writeFileSync } from 'node:fs';
writeFileSync(
  new URL('../apps/api/src/watch-bump.ts', import.meta.url),
  `export {}; // @kbs/shared rebuilt ${Date.now()}\n`,
);
console.warn('watch-bump: api recompile triggered');
