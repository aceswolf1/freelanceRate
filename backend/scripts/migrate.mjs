#!/usr/bin/env node
/**
 * Runs database migrations in BOTH environments:
 *   - dev  (tsx + src/db/migrate.ts)   — `npm run db:migrate`
 *   - prod (node + dist/db/migrate.js) — Docker, after `npm run build`
 *
 * Prefers the compiled build when it exists so a production image needs no
 * TypeScript toolchain, and falls back to tsx when only sources are present.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const distEntry = resolve(root, 'dist/db/migrate.js');
const srcEntry = resolve(root, 'src/db/migrate.ts');

async function loadModule() {
  if (existsSync(distEntry)) {
    console.log('[migrate] using compiled dist/db/migrate.js');
    return import(pathToFileURL(distEntry).href);
  }
  if (!existsSync(srcEntry)) {
    throw new Error('neither dist/db/migrate.js nor src/db/migrate.ts found — run `npm run build`');
  }
  console.log('[migrate] using src/db/migrate.ts (tsx)');
  const { register } = await import('tsx/esm/api');
  register();
  return import(pathToFileURL(srcEntry).href);
}

loadModule()
  .then(async ({ runMigrations, migrationsPath }) => {
    await runMigrations();
    console.log(`[migrate] migrations applied from ${migrationsPath()}`);
  })
  .catch((error) => {
    console.error('[migrate] failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });