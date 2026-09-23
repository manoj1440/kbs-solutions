#!/usr/bin/env node
/**
 * Offline migration runner using @prisma/schema-engine-wasm (same engine the Prisma CLI
 * uses, published as WASM). Use it when the CLI cannot download its native engine binary
 * (offline / restricted egress). Output is byte-identical to `prisma migrate dev`.
 *
 *   node scripts/wasm-migrate.mjs create <name>   # generate prisma/migrations/<ts>_<name>/migration.sql
 *   node scripts/wasm-migrate.mjs apply           # apply pending migrations (like migrate deploy)
 *   node scripts/wasm-migrate.mjs status          # diagnose history
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemaPath = path.join(root, 'prisma', 'schema.prisma');
const migrationsDir = path.join(root, 'prisma', 'migrations');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const bgPath = require.resolve('@prisma/schema-engine-wasm/schema_engine_bg');
const bg = await import(bgPath);
const wasmBytes = readFileSync(path.join(path.dirname(bgPath), 'schema_engine_bg.wasm'));
const wasmModule = new WebAssembly.Module(wasmBytes);
const instance = new WebAssembly.Instance(wasmModule, { './schema_engine_bg.js': bg });
bg.__wbg_set_wasm(instance.exports);
instance.exports.__wbindgen_start();

const { PrismaPg } = await import('@prisma/adapter-pg');
const { bindMigrationAwareSqlAdapterFactory } = await import('@prisma/driver-adapter-utils');
// The engine expects Result-wrapped, error-registry-aware adapter calls — the same binding the CLI uses.
// The pg adapter's executeScript splits on ';', which breaks semicolons inside comments and $$-quoted function
// bodies (F-903 triggers). Send each migration script as ONE simple-protocol query instead — what the Prisma CLI does.
const basePg = new PrismaPg({ connectionString: url });
const wholeScript = (a) => {
  a.executeScript = async (script) => {
    try {
      await a.client.query(script);
    } catch (error) {
      a.onError(error);
    }
  };
  return a;
};
const pgFactory = {
  provider: basePg.provider,
  adapterName: basePg.adapterName,
  connect: async () => wholeScript(await basePg.connect()),
  connectToShadowDb: async () => wholeScript(await basePg.connectToShadowDb()),
};
const adapter = bindMigrationAwareSqlAdapterFactory(pgFactory);

const schemaContent = readFileSync(schemaPath, 'utf8');
const schema = { files: [{ path: schemaPath, content: schemaContent }] };
const filters = { externalTables: [], externalEnums: [] };

function migrationList() {
  if (!existsSync(migrationsDir)) mkdirSync(migrationsDir, { recursive: true });
  const lockPath = path.join(migrationsDir, 'migration_lock.toml');
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return {
    baseDir: migrationsDir,
    lockfile: { path: 'migration_lock.toml', content: existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : null },
    shadowDbInitScript: '',
    migrationDirectories: dirs.map((name) => {
      const file = path.join(migrationsDir, name, 'migration.sql');
      return {
        path: name,
        migrationFile: {
          path: 'migration.sql',
          content: existsSync(file) ? { tag: 'ok', value: readFileSync(file, 'utf8') } : { tag: 'error', value: 'missing' },
        },
      };
    }),
  };
}

const engine = await bg.SchemaEngine.new({ datamodels: [[schemaPath, schemaContent]] }, () => {}, adapter);
const cmd = process.argv[2];
try {
  if (cmd === 'create') {
    // createMigration needs a shadow database factory the WASM build cannot open here, so we
    // diff from the live database state (which must be up to date with applied migrations) — or
    // from empty when no migrations exist — to the datamodel. Same SQL generator as the CLI.
    const name = (process.argv[3] ?? 'migration').replace(/[^a-zA-Z0-9_]/g, '_');
    const list = migrationList();
    if (list.migrationDirectories.length) {
      console.error(
        'This offline runner can only generate the FIRST migration (from an empty database). ' +
          'Introspecting a live database through the WASM engine + pg adapter is not supported in this engine version. ' +
          'Generate incremental migrations with `pnpm db:migrate:dev` (Prisma CLI) on a machine with network access.',
      );
      process.exit(1);
    }
    const from = { tag: 'empty' };
    const out = await engine.diff({ from, to: { tag: 'schemaDatamodel', ...schema }, script: true, exitCode: true, filters });
    const sql = (out.stdout ?? '').trim();
    if (!sql || out.exitCode !== 2) {
      console.warn('No schema changes — nothing to generate.');
    } else {
      const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      const dirName = `${ts}_${name}`;
      const dir = path.join(migrationsDir, dirName);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'migration.sql'), `${sql}\n`);
      const lockPath = path.join(migrationsDir, 'migration_lock.toml');
      if (!existsSync(lockPath)) {
        writeFileSync(lockPath, '# Please do not edit this file manually\n# It should be added in your version-control system (e.g., Git)\nprovider = "postgresql"\n');
      }
      console.warn(`Created ${dirName}`);
    }
  } else if (cmd === 'apply') {
    const out = await engine.applyMigrations({ migrationsList: migrationList(), filters });
    console.warn(out.appliedMigrationNames.length ? `Applied: ${out.appliedMigrationNames.join(', ')}` : 'Already up to date.');
  } else if (cmd === 'status') {
    const out = await engine.diagnoseMigrationHistory({ migrationsList: migrationList(), optInToShadowDatabase: false, filters });
    console.warn(JSON.stringify(out, null, 2));
  } else if (cmd === 'reset') {
    await engine.reset({ filter: filters });
    console.warn('Database reset.');
  } else {
    console.error('usage: wasm-migrate.mjs <create name|apply|status|reset>');
    process.exitCode = 1;
  }
} finally {
  engine.free();
}
