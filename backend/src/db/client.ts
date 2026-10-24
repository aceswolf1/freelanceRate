import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

export interface DbHandle<TPool = pg.Pool> {
  db: Database;
  pool: TPool;
}

/**
 * Creates an isolated connection pool + Drizzle handle for `connectionString`.
 * Tests build their own handle against `DATABASE_URL_TEST`; the app uses the
 * process-wide singleton below.
 */
export function createDbHandle(connectionString: string = env.DATABASE_URL): DbHandle {
  const pool = new pg.Pool({ connectionString, max: 10 });
  return { db: drizzle(pool, { schema }), pool };
}

let handle: DbHandle | undefined;

/** Lazily-created process-wide handle (avoids opening a pool at import time). */
export function getDbHandle(): DbHandle {
  handle ??= createDbHandle();
  return handle;
}

export function getDb(): Database {
  return getDbHandle().db;
}

/**
 * Replaces the process-wide handle. Only the integration suite uses this: it
 * installs a handle bound to a single `pg.Client` whose transaction is always
 * rolled back, so running the specs leaves no data behind in any database.
 */
export function setDbHandle<TPool>(next: DbHandle<TPool>): void {
  handle = next as DbHandle;
}

export async function closeDb(): Promise<void> {
  if (!handle) return;
  const { pool } = handle;
  handle = undefined;
  await pool.end();
}

/** Raw SQL escape hatch — used by migrations and integration-test truncation. */
export async function rawQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return getDbHandle().pool.query<T>(text, values);
}

export { schema };