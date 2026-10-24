/**
 * Shared paths and ports for the BillFlow E2E suite.
 *
 * IMPORTANT — why the suite does not use the "obvious" ports:
 *
 *  · The API lives on `http://localhost:4400` (started by the team lead).
 *  · The frontend is supposed to live on `http://localhost:3000`, but on this
 *    machine **:3000 is taken by an unrelated app** (a Next.js project), and the
 *    authorization for this task explicitly forbids killing processes we did not
 *    start. So the E2E frontend is started by this suite on **:3300**.
 *  · The API's CORS policy allows exactly one origin (`http://localhost:3000`),
 *    so a browser running on :3300 would be blocked on every cross-origin
 *    request (all mutations and every fetch+blob download). The suite therefore
 *    runs a **tiny CORS-forwarding proxy on :4401** that forwards `/api/*` to the
 *    real backend on :4400 and adds the matching `Access-Control-*` headers.
 *    All real backend logic still runs on the lead's :4400 instance.
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

/** The lead-owned API (never started or stopped by this suite). */
export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:4400'
export const API_BASE = `${BACKEND_URL}/api`

/** Port the E2E frontend listens on (:3000 is occupied by a foreign app). */
export const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 3300)
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`

/** Port the CORS-forwarding proxy listens on. */
export const PROXY_PORT = Number(process.env.E2E_PROXY_PORT ?? 4401)
export const PROXY_URL = `http://localhost:${PROXY_PORT}`
/** What the browser is told to use as its API base. */
export const BROWSER_API_BASE = `${PROXY_URL}/api`

/** Where the 12 design-comparison screenshots are written. */
export const SCREENSHOT_DIR = resolve(
  PROJECT_ROOT,
  'development/freelancer-invoices/tasks/W5-qa/screens',
)
