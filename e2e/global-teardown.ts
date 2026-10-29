/**
 * Global teardown — runs once after the whole suite.
 *
 *  1. Re-seeds the **E2E** database so it is left exactly as it was found
 *     (open seeded week, no invoices, no extra records). The development
 *     database is never touched.
 *  2. Stops the suite's own backend + frontend — and only the PIDs this suite
 *     recorded in `e2e/.state/servers.json`.
 */
import { seedDatabase, stopServers } from './helpers/servers'

export default async function globalTeardown(): Promise<void> {
  console.log('[e2e] restoring the E2E database…')
  seedDatabase()
  stopServers()
  console.log('[e2e] teardown complete')
}
