#!/usr/bin/env node
/**
 * Seed runner with the same dev/prod dual-mode behaviour as scripts/migrate.mjs.
 * Usage: `npm run db:seed`
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const distEntry = resolve(root, 'dist/db/seed.js');
const srcEntry = resolve(root, 'src/db/seed.ts');

async function loadModule() {
  if (existsSync(distEntry)) {
    console.log('[seed] using compiled dist/db/seed.js');
    return import(pathToFileURL(distEntry).href);
  }
  const { register } = await import('tsx/esm/api');
  register();
  return import(pathToFileURL(srcEntry).href);
}

loadModule()
  .then(async ({ runSeed }) => {
    await runSeed();
  })
  .catch((error) => {
    console.error('[seed] failed:', error instanceof Error ? error.stack : error);
    process.exit(1);
  });