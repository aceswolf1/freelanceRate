/**
 * Applies every SQL file in `backend/drizzle` in order, tracked by drizzle-kit's
 * `__drizzle_migrations` table. Safe to re-run.
 *
 * Run via `npm run db:migrate` — the launcher script picks this file (tsx) in
 * dev and `dist/db/migrate.js` (plain node) in the production image.
 */
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDbHandle } from './client.js';

// Resolves to `backend/drizzle` from both `src/db/migrate.ts` and `dist/db/migrate.js`.
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations(databaseUrl?: string): Promise<void> {
  const { db, pool } = createDbHandle(databaseUrl);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

export function migrationsPath(): string {
  return migrationsFolder;
}

/** True when this file is the process entry point (i.e. `tsx src/db/migrate.ts`). */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && pathToFileURL(resolve(entry)).href === import.meta.url;
}

if (isEntryPoint()) {
  runMigrations()
    .then(() => console.log(`[migrate] migrations applied from ${migrationsFolder}`))
    .catch((error: unknown) => {
      console.error('[migrate] failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}