/**
 * Global teardown — runs once after the whole suite.
 *
 *  1. Re-seeds the dev database so the shared dev environment is left exactly as
 *     it was found (open seeded week, no invoices, no extra records).
 *  2. Stops the frontend + CORS proxy **only** if this suite started them.
 *
 * The API on :4400 belongs to the team lead and is never touched.
 */
import { seedDatabase, stopServers } from './helpers/servers'

export default async function globalTeardown(): Promise<void> {
  console.log('[e2e] restoring the dev database…')
  seedDatabase()
  stopServers()
  console.log('[e2e] teardown complete')
}
