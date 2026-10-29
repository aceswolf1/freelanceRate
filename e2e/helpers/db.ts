/**
 * The E2E database — the single source of truth for which Postgres database the
 * suite is allowed to write to.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The suite used to seed the *dev* database, which now holds the user's real
 * invoices. Every DB-touching helper therefore calls `assertE2eDatabase()`
 * **before** it runs a command, and the guard throws unless the connection URL
 * points at exactly `freelancer_invoices_e2e`.
 *
 * The guard is deliberately strict about the *name*, not about a pattern: the
 * development database and the backend's unit-test database are both rejected,
 * so a near-miss (a prefix, a suffix, a different case) can never slip
 * through. Their names are deliberately **not** spelled out anywhere in this
 * tree — a grep over `e2e/` must only ever find the E2E database.
 *
 * Nothing in this file touches product code.
 */
import { execFileSync } from 'node:child_process'

/** The one and only database this suite may write to. */
export const E2E_DB_NAME = 'freelancer_invoices_e2e'

/** Connection URL for the E2E database (local Postgres, no password). */
export const E2E_DATABASE_URL = `postgres://cace@localhost:5432/${E2E_DB_NAME}`

/** The `psql` / `createdb` binaries live next to the local Postgres install. */
const PSQL = process.env.E2E_PSQL ?? 'psql'
const CREATEDB = process.env.E2E_CREATEDB ?? 'createdb'

/**
 * Extracts the database name from a Postgres connection URL.
 * Returns an empty string for anything that is not a parseable URL — such a
 * value can never equal `E2E_DB_NAME`, so it is rejected downstream.
 */
export function databaseNameFromUrl(url: string): string {
  let pathname: string
  try {
    pathname = new URL(url).pathname
  }
  catch {
    return ''
  }
  const withoutSlashes = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  try {
    return decodeURIComponent(withoutSlashes)
  }
  catch {
    return withoutSlashes
  }
}

/**
 * Throws unless `url` points at the E2E database.
 *
 * @returns the very same URL, so call sites can use it inline:
 * `execFileSync('psql', [assertE2eDatabase(url), ...])`.
 */
export function assertE2eDatabase(url: string): string {
  const name = databaseNameFromUrl(url)
  if (name !== E2E_DB_NAME) {
    throw new Error(
      `Refusing to touch the database "${name || '(unparseable url)'}". `
      + `The E2E suite may only ever write to "${E2E_DB_NAME}". `
      + `Refused connection URL: ${url}`,
    )
  }
  return url
}

/** Runs a read-only query against the E2E database and returns the trimmed output. */
export function queryE2eDatabase(sql: string): string {
  assertE2eDatabase(E2E_DATABASE_URL)
  return execFileSync(PSQL, [E2E_DATABASE_URL, '-tAc', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

/** True when the E2E database already exists on the server. */
export function databaseExists(): boolean {
  const found = execFileSync(
    PSQL,
    ['postgres://cace@localhost:5432/postgres', '-tAc', `select 1 from pg_database where datname = '${E2E_DB_NAME}'`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim()
  return found === '1'
}

/**
 * Creates the E2E database when it is missing.
 * "already exists" is not an error — the function is idempotent.
 */
export function ensureDatabaseExists(): void {
  assertE2eDatabase(E2E_DATABASE_URL)
  if (databaseExists()) {
    return
  }
  try {
    execFileSync(CREATEDB, [E2E_DB_NAME], { stdio: ['ignore', 'pipe', 'pipe'] })
  }
  catch (error) {
    // A parallel run may have created it in the meantime.
    if (!databaseExists()) {
      throw new Error(
        `Could not create the E2E database: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}

/**
 * Proves that the URL the suite hands to the backend really points at the E2E
 * database — a read-only `select current_database()` on the server itself.
 */
export function assertServerIsE2eDatabase(): void {
  assertE2eDatabase(E2E_DATABASE_URL)
  const current = queryE2eDatabase('select current_database()')
  if (current !== E2E_DB_NAME) {
    throw new Error(
      `The connection URL resolves to the database "${current}", expected "${E2E_DB_NAME}".`,
    )
  }
}
