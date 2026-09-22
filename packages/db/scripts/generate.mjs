#!/usr/bin/env node
/**
 * `prisma generate` wrapper. Client generation does not execute the native schema engine, but the CLI
 * still tries to download it. In offline / egress-restricted environments that download fails, so we
 * retry with a stub binary path (safe: generate never invokes it). Migrations still need the real
 * engine — see scripts/wasm-migrate.mjs for the offline alternative.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const run = (env) => spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' });

let res = run({});
if (res.status !== 0) {
  console.warn('[db] prisma generate failed (engine download?). Retrying with stub engine path…');
  res = run({
    PRISMA_SCHEMA_ENGINE_BINARY: path.join(here, 'schema-engine-stub.sh'),
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
  });
}
process.exit(res.status ?? 1);
