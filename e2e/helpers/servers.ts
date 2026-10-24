/**
 * Process + database helpers for the E2E suite.
 *
 *  · `seedDatabase()`  — runs `npm run db:seed` in `backend/` (idempotent: truncates
 *    and rebuilds the seeded demo dataset).
 *  · `ensureServers()` — starts the CORS proxy (:4401) and the production frontend
 *    (:3300) if they are not already up, and records the PIDs it started in
 *    `e2e/.state/servers.json` so the teardown stops **only** what it started.
 *  · `stopServers()`   — stops exactly those PIDs (verified by command line before kill).
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import {
  BACKEND_DIR,
  BACKEND_URL,
  BROWSER_API_BASE,
  E2E_DIR,
  FRONTEND_DIR,
  FRONTEND_PORT,
  FRONTEND_URL,
  PROXY_PORT,
  PROXY_URL,
} from './paths'

const STATE_DIR = resolve(E2E_DIR, '.state')
const STATE_FILE = resolve(STATE_DIR, 'servers.json')

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

/** Re-create the seeded demo dataset (truncate + insert). */
export function seedDatabase(): void {
  execFileSync('npm', ['run', 'db:seed'], {
    cwd: BACKEND_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
}

function spawnDetached(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio: 'ignore',
  })
}

/**
 * Start the proxy + the frontend when they are not already running.
 * Returns the list of servers this call started (empty when everything was up).
 */
/**
 * True when the frontend serves a **consistent** build: the HTML references a
 * client chunk that actually exists. A server that was started before another
 * `nuxt build` renders the old HTML against the new `public/` folder, so every
 * chunk 404s and the page never hydrates.
 */
export async function bundleHealthy(): Promise<boolean> {
  try {
    const html = await fetch(FRONTEND_URL).then(response => response.text())
    const chunk = html.match(/\/_nuxt\/[A-Za-z0-9_.-]+\.js/)?.[0]
    if (!chunk) {
      return false
    }
    const response = await fetch(`${FRONTEND_URL}${chunk}`)
    return response.ok
  }
  catch {
    return false
  }
}

export async function ensureServers(): Promise<StartedServer[]> {
  const started: StartedServer[] = []

  if (!(await httpAlive(`${BACKEND_URL}/api/health`))) {
    throw new Error(
      `The API is not answering on ${BACKEND_URL}/api/health. It is started by the team lead and this suite must not start it.`,
    )
  }

  const proxyUp = await httpAlive(`${PROXY_URL}/api/health`)
  if (!proxyUp) {
    const child = spawnDetached(
      process.execPath,
      [resolve(E2E_DIR, 'helpers/cors-proxy.mjs'), '--listen', String(PROXY_PORT), '--target', BACKEND_URL, '--allow-origin', FRONTEND_URL],
      E2E_DIR,
      {},
    )
    child.unref()
    started.push({ name: 'cors-proxy', pid: child.pid! })
    await waitFor(`${PROXY_URL}/api/health`, 'CORS proxy')
  }

  let frontendUp = await httpAlive(FRONTEND_URL)
  if (frontendUp && !(await bundleHealthy())) {
    // A rebuild happened under the running server — restart the one we own.
    const owned = readState().find(server => server.name === 'frontend')
    if (owned) {
      try {
        process.kill(owned.pid, 'SIGTERM')
      }
      catch {
        // already gone
      }
      await new Promise(resolve => setTimeout(resolve, 500))
      frontendUp = false
    }
    else {
      throw new Error(
        `The frontend on ${FRONTEND_URL} serves a stale build (its client chunks 404). `
        + 'Restart that server (or free the port) and run the suite again.',
      )
    }
  }

  if (!frontendUp) {
    if (!existsSync(resolve(FRONTEND_DIR, '.output/server/index.mjs'))) {
      throw new Error('frontend/.output is missing — run `npm run build` in frontend/ first.')
    }
    const child = spawnDetached(
      process.execPath,
      ['.output/server/index.mjs'],
      FRONTEND_DIR,
      {
        PORT: String(FRONTEND_PORT),
        NITRO_PORT: String(FRONTEND_PORT),
        HOST: '127.0.0.1',
        NUXT_PUBLIC_API_BASE: BROWSER_API_BASE,
      },
    )
    child.unref()
    started.push({ name: 'frontend', pid: child.pid! })
    await waitFor(FRONTEND_URL, 'Frontend')
  }

  writeState([...readState(), ...started])
  return started
}

/** Stop only the servers this suite started. */
export function stopServers(): void {
  const servers = readState()
  for (const server of servers) {
    try {
      // Verify the PID still belongs to us before killing it.
      const command = execFileSync('ps', ['-p', String(server.pid), '-o', 'command='], { encoding: 'utf8' })
      if (command.includes('cors-proxy.mjs') || command.includes('.output/server/index.mjs')) {
        process.kill(server.pid, 'SIGTERM')
      }
    }
    catch {
      // already gone
    }
  }
  writeState([])
}
