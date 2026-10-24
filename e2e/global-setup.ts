/**
 * Global setup — runs once before the whole suite.
 *
 *  1. Re-seeds the dev database so every run starts from the known dataset
 *     (Acme Corp $130/h, Starlight Media $100/h, Internal Tools standalone $95/h,
 *     current Mon–Sun week carrying 34.5 h).
 *  2. Starts the CORS proxy (:4401) and the production frontend (:3300) if they
 *     are not already running, and remembers the PIDs so the teardown can stop
 *     exactly what this suite started.
 *
 * The API on :4400 is owned by the team lead — this suite never starts or stops it.
 */
import { ensureServers, seedDatabase } from './helpers/servers'
import { API_BASE, FRONTEND_URL, PROXY_URL } from './helpers/paths'

export default async function globalSetup(): Promise<void> {
  const started = await ensureServers()
  if (started.length > 0) {
    console.log(`[e2e] started: ${started.map(s => `${s.name}(pid ${s.pid})`).join(', ')}`)
  }
  else {
    console.log('[e2e] frontend + proxy were already running — reusing them')
  }

  // Seed AFTER the servers are up so the first request already sees the data.
  console.log('[e2e] seeding the dev database…')
  seedDatabase()

  console.log(`[e2e] frontend=${FRONTEND_URL} proxy=${PROXY_URL} api=${API_BASE}`)
}
