#!/usr/bin/env node
/**
 * Offline incremental migration SQL: schema-to-schema diff with the WASM schema engine (no DB introspection,
 * no native engine download). Used when `prisma migrate dev` cannot run (restricted egress).
 *
 *   node scripts/wasm-diff.mjs <old-schema.prisma> [new-schema.prisma]   # prints SQL
 *   git show HEAD:packages/db/prisma/schema.prisma > /tmp/old.prisma && node scripts/wasm-diff.mjs /tmp/old.prisma
 *
 * Review the output: make NOT NULL additions safe for non-empty tables, keep semicolons out of SQL comments
 * (the runner splits on them) and put partial indexes that use new enum values in a follow-up migration.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [oldP, newP = path.join(root, 'prisma', 'schema.prisma')] = process.argv.slice(2);
if (!oldP) {
  console.error('usage: wasm-diff.mjs <old-schema.prisma> [new-schema.prisma]');
  process.exit(1);
}
const bgPath = require.resolve('@prisma/schema-engine-wasm/schema_engine_bg');
const bg = await import(bgPath);
const inst = new WebAssembly.Instance(new WebAssembly.Module(readFileSync(path.join(path.dirname(bgPath), 'schema_engine_bg.wasm'))), { './schema_engine_bg.js': bg });
bg.__wbg_set_wasm(inst.exports);
inst.exports.__wbindgen_start();
const { PrismaPg } = await import('@prisma/adapter-pg');
const { bindMigrationAwareSqlAdapterFactory } = await import('@prisma/driver-adapter-utils');
// The engine opens a connection on start (any reachable DB; it is not read or modified by a schema-to-schema diff).
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required (any reachable database; it is not modified)');
  process.exit(1);
}
const adapter = bindMigrationAwareSqlAdapterFactory(new PrismaPg({ connectionString: process.env.DATABASE_URL }));
const newC = readFileSync(newP, 'utf8');
const engine = await bg.SchemaEngine.new({ datamodels: [[newP, newC]] }, () => {}, adapter);
try {
  const out = await engine.diff({ from: { tag: 'schemaDatamodel', files: [{ path: oldP, content: readFileSync(oldP, 'utf8') }] }, to: { tag: 'schemaDatamodel', files: [{ path: newP, content: newC }] }, script: true, exitCode: true, filters: { externalTables: [], externalEnums: [] } });
  process.stdout.write(out.stdout ?? '');
} finally {
  engine.free();
}
