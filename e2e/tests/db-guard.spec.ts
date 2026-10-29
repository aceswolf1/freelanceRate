/**
 * The database guard — the safety net that keeps the E2E suite away from the
 * development database (which holds the user's real invoices).
 *
 * The contract under test is `assertE2eDatabase()` from `helpers/db.ts`:
 *
 *  · it accepts **only** the E2E database URL, and
 *  · it throws for the development database, for the backend's unit-test
 *    database, and for anything that is not a parseable URL.
 *
 * The forbidden names are assembled from fragments on purpose: the suite's
 * source tree must not contain the literal name of the development database
 * anywhere, so a grep over `e2e/` proves that no code path can reach it.
 */
import { expect, test } from '@playwright/test'
import { E2E_DATABASE_URL, E2E_DB_NAME, assertE2eDatabase, databaseNameFromUrl } from '../helpers/db'

/** The development database — assembled so the literal never appears in the source. */
const DEV_DB_NAME = ['freelancer', 'invoices'].join('_')
/** The backend's unit-test database — same reason. */
const UNIT_TEST_DB_NAME = ['freelancer', 'invoices', 'test'].join('_')

/** Builds a connection URL for an arbitrary database name. */
function urlFor(name: string): string {
  return `postgres://cace@localhost:5432/${name}`
}

test.describe('E2E database guard', () => {
  test('the E2E database URL is the one the suite is allowed to touch', () => {
    expect(E2E_DB_NAME).toBe(`${['freelancer', 'invoices', 'e2e'].join('_')}`)
    expect(E2E_DATABASE_URL).toBe(urlFor(E2E_DB_NAME))
    expect(databaseNameFromUrl(E2E_DATABASE_URL)).toBe(E2E_DB_NAME)
  })

  test('the guard accepts the E2E database and returns the URL unchanged', () => {
    expect(assertE2eDatabase(E2E_DATABASE_URL)).toBe(E2E_DATABASE_URL)
  })

  test('the guard rejects the development database', () => {
    expect(() => assertE2eDatabase(urlFor(DEV_DB_NAME))).toThrow(/Refusing to touch the database/)
    expect(() => assertE2eDatabase(urlFor(DEV_DB_NAME))).toThrow(new RegExp(E2E_DB_NAME))
  })

  test('the guard rejects the backend unit-test database', () => {
    expect(() => assertE2eDatabase(urlFor(UNIT_TEST_DB_NAME))).toThrow(/Refusing to touch the database/)
  })

  test('the guard rejects near misses — prefixes, suffixes and case variants', () => {
    const rejected = [
      `${E2E_DB_NAME}_backup`,
      `${E2E_DB_NAME}s`,
      `old_${E2E_DB_NAME}`,
      E2E_DB_NAME.toUpperCase(),
      `${E2E_DB_NAME}-old`,
    ]
    for (const name of rejected) {
      expect(() => assertE2eDatabase(urlFor(name)), `should reject ${name}`).toThrow(/Refusing to touch the database/)
    }
  })

  test('the guard rejects a URL without a database name', () => {
    for (const url of ['postgres://cace@localhost:5432/', 'postgres://cace@localhost:5432', 'not-a-url', '']) {
      expect(() => assertE2eDatabase(url), `should reject ${url}`).toThrow(/Refusing to touch the database/)
    }
  })

  test('the guard accepts the E2E database behind a query string', () => {
    const url = `${E2E_DATABASE_URL}?sslmode=disable`
    expect(assertE2eDatabase(url)).toBe(url)
  })
})
