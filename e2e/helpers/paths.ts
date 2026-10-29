/**
 * Shared paths and ports for the BillFlow E2E suite.
 *
 * The suite drives a **fully isolated** stack of its own — nothing it touches
 * is shared with the development environment:
 *
 *  · Database `freelancer_invoices_e2e` (see `helpers/db.ts`) — created,
 *    migrated and seeded by the suite itself. The development database holds
 *    the user's real invoices and is never written to.
 *  · API on `http://127.0.0.1:4410` — started by this suite from the compiled
 *    backend, bound to the E2E database. The development API keeps running on
 *    its own port and is never stopped by this suite.
 *  · Frontend on `http://127.0.0.1:3300` — the production Nuxt build, started
 *    by this suite with `NUXT_API_INTERNAL_BASE` pointing at the E2E API.
 *
 * The browser talks to the **same origin** (`/api` on the frontend), which
 * Nitro forwards to the backend. There is no CORS proxy any more: the old
 * forwarder only existed to work around the development API's single-origin
 * CORS policy, and the same-origin `/api` proxy makes it obsolete.
 *
 * Nothing in this file touches product code.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** Absolute fallback — the project root as agreed in the task assignment. */
const FALLBACK_PROJECT_ROOT = '/Users/cace/Desktop/cloud-copy/projects/freelancerRate'

/**
 * Walk up from the current working directory looking for the project root
 * (the folder that owns both `backend/` and `frontend/`). Falls back to the
 * known absolute path so `npx playwright test` works from anywhere.
 */
export function findProjectRoot(): string {
  const fromEnv = process.env.E2E_PROJECT_ROOT
  if (fromEnv && existsSync(resolve(fromEnv, 'backend/package.json'))) {
    return resolve(fromEnv)
  }

  let dir = process.cwd()
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(dir, 'backend/package.json')) && existsSync(resolve(dir, 'frontend/package.json'))) {
      return dir
    }
    const parent = resolve(dir, '..')
    if (parent === dir) {
      break
    }
    dir = parent
  }

  return FALLBACK_PROJECT_ROOT
}

export const PROJECT_ROOT = findProjectRoot()
export const BACKEND_DIR = resolve(PROJECT_ROOT, 'backend')
export const FRONTEND_DIR = resolve(PROJECT_ROOT, 'frontend')
export const E2E_DIR = resolve(PROJECT_ROOT, 'e2e')

/** Port the suite's own API listens on. */
export const E2E_BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 4410)
/** The suite's own API — started and stopped by this suite. */
export const BACKEND_URL = `http://127.0.0.1:${E2E_BACKEND_PORT}`
/** Direct API base used by the `request` fixture in the specs. */
export const API_BASE = `${BACKEND_URL}/api`

/** Port the suite's own frontend listens on (:3000 is occupied by a foreign app). */
export const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 3300)
/** The suite's own frontend — the browser's base URL. */
export const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`
/**
 * What the browser is told to use as its API base: the **same origin**.
 * The frontend proxies `/api/*` to the E2E backend, so no CORS policy and no
 * extra proxy process are involved.
 */
export const BROWSER_API_BASE = '/api'

/** Where the 12 design-comparison screenshots are written. */
export const SCREENSHOT_DIR = resolve(
  PROJECT_ROOT,
  'development/freelancer-invoices/tasks/W5-qa/screens',
)
