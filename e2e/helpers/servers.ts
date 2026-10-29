/**
 * Process + database helpers for the E2E suite.
 *
 * Everything the suite starts, it also stops — and nothing else is touched:
 *
 *  · `ensureDatabaseExists()` — creates `freelancer_invoices_e2e` when missing.
 *  · `migrateDatabase()`     — `npm run db:migrate` against the E2E database.
 *  · `seedDatabase()`        — `npm run db:seed` against the E2E database
 *    (idempotent: truncates and rebuilds the seeded demo dataset).
 *  · `buildBackendIfStale()` — compiles `backend/` when `dist/` is missing or
 *    older than the sources.
 *  · `ensureServers()`       — starts the suite's own backend (:4410) and
 *    frontend (:3300) and records their PIDs in `e2e/.state/servers.json`, so
 *    the teardown stops **exactly** what this suite started.
 *  · `stopServers()`         — stops exactly those PIDs (the command line is
 *    verified before every kill).
 *
 * Every DB-touching command is preceded by `assertE2eDatabase()`, so no code
 * path in this suite can reach any database other than the E2E one.
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import {
  BACKEND_DIR,
  BACKEND_URL,
  E2E_BACKEND_PORT,
  E2E_DIR,
  FRONTEND_DIR,
  FRONTEND_PORT,
  FRONTEND_URL,
} from './paths'
import { E2E_DATABASE_URL, assertE2eDatabase } from './db'

const STATE_DIR = resolve(E2E_DIR, '.state')
const STATE_FILE = resolve(STATE_DIR, 'servers.json')

/** The backend entry point the suite runs. */
const BACKEND_ENTRY = 'dist/server.js'
/** The frontend entry point the suite runs. */
const FRONTEND_ENTRY = '.output/server/index.mjs'

export interface StartedServer {
  name: string
  pid: number
}

function readState(): StartedServer[] {
  if (!existsSync(STATE_FILE)) {
    return []
  }
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as StartedServer[]
  }
  catch {
    return []
  }
}

function writeState(servers: StartedServer[]): void {
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(servers, null, 2))
}

/** True when `url` answers with an HTTP status (any). */
export async function httpAlive(url: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    return response.status < 500
  }
  catch {
    return false
  }
}

async function waitFor(url: string, label: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await httpAlive(url)) {
      return
    }
    await delay(250)
  }
  throw new Error(`${label} did not become ready at ${url} within ${timeoutMs}ms`)
}

/** True when the process with this PID is still running. */
export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  }
  catch {
    return false
  }
}

/** The command line of a running process (empty when it is gone). */
function commandLine(pid: number): string {
  try {
    return execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim()
  }
  catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

/**
 * Runs an `npm run …` script in `backend/` with the E2E database URL in the
 * environment.
 *
 * The URL is passed **explicitly**; `backend/.env` points at the development
 * database and must never decide what the suite touches. `dotenv` does not
 * overwrite variables that are already set, so the explicit value wins — and
 * `assertBackendChildUsesE2eDatabase()` proves that at setup time.
 */
function runBackendScript(script: string): void {
  assertE2eDatabase(E2E_DATABASE_URL)
  try {
    execFileSync('npm', ['run', script], {
      cwd: BACKEND_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    })
  }
  catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? ''
    const stdout = (error as { stdout?: Buffer }).stdout?.toString() ?? ''
    throw new Error(
      `\`npm run ${script}\` failed against the E2E database.`
      + `\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
    )
  }
}

/**
 * Proves that the environment the suite hands to `backend/` really resolves to
 * the E2E database — `backend/.env` is loaded by `dotenv` inside the backend,
 * so this is the one place where a wrong URL could reach the development
 * database.
 */
export function assertBackendChildUsesE2eDatabase(): void {
  const dotenvEntry = resolve(BACKEND_DIR, 'node_modules/dotenv/lib/main.js')
  if (!existsSync(dotenvEntry)) {
    throw new Error(`Cannot verify the backend environment: ${dotenvEntry} is missing.`)
  }

  const script = [
    `import { config } from ${JSON.stringify(`file://${dotenvEntry}`)}`,
    'config()',
    'process.stdout.write(process.env.DATABASE_URL ?? "")',
  ].join('\n')

  let effective: string
  try {
    effective = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: BACKEND_DIR,
      env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  }
  catch (error) {
    throw new Error(
      `Could not verify the backend's effective DATABASE_URL: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (effective !== E2E_DATABASE_URL) {
    throw new Error(
      `The backend would use DATABASE_URL="${effective}" instead of the E2E database. `
      + 'Refusing to run — backend/.env must never decide what the suite touches.',
    )
  }
}

/** Applies the migrations to the E2E database. */
export function migrateDatabase(): void {
  runBackendScript('db:migrate')
}

/** Re-create the seeded demo dataset in the E2E database (truncate + insert). */
export function seedDatabase(): void {
  runBackendScript('db:seed')
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/** The newest mtime under a directory tree (0 when the tree is empty). */
function newestMtime(dir: string): number {
  if (!existsSync(dir)) {
    return 0
  }
  let newest = 0
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) {
      continue
    }
    const mtime = statSync(resolve(entry.parentPath ?? dir, entry.name)).mtimeMs
    if (mtime > newest) {
      newest = mtime
    }
  }
  return newest
}

/** True when the compiled backend is missing or older than the sources. */
export function backendBuildStale(): boolean {
  const entry = resolve(BACKEND_DIR, BACKEND_ENTRY)
  if (!existsSync(entry)) {
    return true
  }
  return newestMtime(resolve(BACKEND_DIR, 'src')) > statSync(entry).mtimeMs
}

/** Compiles the backend when `dist/` is missing or stale. */
export function buildBackendIfStale(): void {
  if (!backendBuildStale()) {
    return
  }
  try {
    execFileSync('npm', ['run', 'build'], {
      cwd: BACKEND_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? ''
    throw new Error(`\`npm run build\` failed in backend/.\n${stderr}`)
  }
}

// ---------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------

function spawnDetached(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio: 'ignore',
  })
}

/** The timezone the suite runs in — the host's, unless the caller pins one. */
function suiteTimezone(): string {
  return process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Starts the suite's own API on :4410, bound to the E2E database.
 *
 * The URL is checked by `assertE2eDatabase()` before the process is spawned —
 * there is no code path that can start the backend against another database.
 */
export function startBackend(): StartedServer {
  assertE2eDatabase(E2E_DATABASE_URL)
  const child = spawnDetached(process.execPath, [BACKEND_ENTRY], BACKEND_DIR, {
    PORT: String(E2E_BACKEND_PORT),
    HOST: '127.0.0.1',
    DATABASE_URL: E2E_DATABASE_URL,
    CORS_ORIGIN: FRONTEND_URL,
    TZ: suiteTimezone(),
  })
  child.unref()
  return { name: 'backend', pid: child.pid! }
}

/** Starts the suite's own frontend on :3300, proxying `/api` to the E2E API. */
export function startFrontend(): StartedServer {
  const child = spawnDetached(process.execPath, [FRONTEND_ENTRY], FRONTEND_DIR, {
    PORT: String(FRONTEND_PORT),
    NITRO_PORT: String(FRONTEND_PORT),
    HOST: '127.0.0.1',
    // The `/api` proxy target. `NUXT_PUBLIC_API_BASE` is deliberately NOT set:
    // the browser must use the same-origin `/api` path.
    NUXT_API_INTERNAL_BASE: BACKEND_URL,
  })
  child.unref()
  return { name: 'frontend', pid: child.pid! }
}

/**
 * Start the suite's own backend + frontend.
 *
 * A port that is already taken by a process this suite did **not** start is a
 * hard error: reusing it would point the suite at somebody else's stack.
 *
 * @returns the servers this call started (empty when everything was already up).
 */
export async function ensureServers(): Promise<StartedServer[]> {
  const started: StartedServer[] = []
  const owned = readState()

  const backendUp = await httpAlive(`${BACKEND_URL}/api/health`)
  if (backendUp) {
    const known = owned.find(server => server.name === 'backend')
    if (!known || !processAlive(known.pid)) {
      throw new Error(
        `Port ${E2E_BACKEND_PORT} is already in use by a process this suite did not start. `
        + 'The E2E API must be the suite\'s own instance (bound to the E2E database). '
        + 'Free the port and run the suite again.',
      )
    }
  }
  else {
    started.push(startBackend())
    await waitFor(`${BACKEND_URL}/api/health`, 'E2E backend')
  }

  const frontendUp = await httpAlive(FRONTEND_URL)
  if (frontendUp) {
    const known = owned.find(server => server.name === 'frontend')
    if (!known || !processAlive(known.pid)) {
      throw new Error(
        `Port ${FRONTEND_PORT} is already in use by a process this suite did not start. `
        + 'Free the port and run the suite again.',
      )
    }
  }
  else {
    if (!existsSync(resolve(FRONTEND_DIR, FRONTEND_ENTRY))) {
      throw new Error('frontend/.output is missing — run `npm run build` in frontend/ first.')
    }
    started.push(startFrontend())
    await waitFor(FRONTEND_URL, 'E2E frontend')
  }

  writeState([...owned, ...started])
  return started
}

/** Stop only the servers this suite started. */
export function stopServers(): void {
  for (const server of readState()) {
    try {
      // Verify the PID still belongs to us before killing it.
      const command = commandLine(server.pid)
      const ours = command.includes(BACKEND_ENTRY) || command.includes(FRONTEND_ENTRY)
      if (ours) {
        process.kill(server.pid, 'SIGTERM')
      }
      else if (command !== '') {
        console.warn(`[e2e] not stopping pid ${server.pid} — it is not ours any more: ${command}`)
      }
    }
    catch {
      // already gone
    }
  }
  writeState([])
}
