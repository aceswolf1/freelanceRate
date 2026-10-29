/**
 * Global setup — runs once before the whole suite.
 *
 *  1. Creates the E2E database (`freelancer_invoices_e2e`) when it is missing.
 *  2. Proves that the environment handed to `backend/` resolves to the E2E
 *     database — `backend/.env` points at the development database, which holds
 *     the user's real invoices and must never be written to.
 *  3. Compiles the backend when `dist/` is missing or stale.
 *  4. Migrates and seeds the E2E database (Acme Corp $130/h, Starlight Media
 *     $100/h, Internal Tools standalone $95/h, current Mon–Sun week with 34.5 h).
 *  5. Starts the suite's own backend (:4410) and frontend (:3300) and records
 *     their PIDs, so the teardown stops exactly what this suite started.
 *
 * The development stack (its own API and frontend, and above all its database)
 * is never touched.
 */
import {
  assertBackendChildUsesE2eDatabase,
  buildBackendIfStale,
  ensureServers,
  migrateDatabase,
  seedDatabase,
} from './helpers/servers'
import { assertServerIsE2eDatabase, ensureDatabaseExists } from './helpers/db'
import { API_BASE, BACKEND_URL, FRONTEND_URL } from './helpers/paths'

export default async function globalSetup(): Promise<void> {
  console.log('[e2e] creating the E2E database (if missing)…')
  ensureDatabaseExists()
  assertServerIsE2eDatabase()

  // Fail loudly *before* anything destructive if backend/.env could win.
  assertBackendChildUsesE2eDatabase()

  console.log('[e2e] building the backend if needed…')
  buildBackendIfStale()

  console.log('[e2e] migrating the E2E database…')
  migrateDatabase()

  console.log('[e2e] seeding the E2E database…')
  seedDatabase()

  const started = await ensureServers()
  if (started.length > 0) {
    console.log(`[e2e] started: ${started.map(s => `${s.name}(pid ${s.pid})`).join(', ')}`)
  }
  else {
    console.log('[e2e] the suite\'s backend + frontend were already running — reusing them')
  }

  console.log(`[e2e] frontend=${FRONTEND_URL} api=${API_BASE} backend=${BACKEND_URL}`)
}
