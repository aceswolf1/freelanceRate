/**
 * The same-origin `/api` proxy (Nuxt/Nitro → backend).
 *
 * The browser never talks to the backend port directly: it calls `/api` on the
 * frontend, and the frontend forwards it. That is what makes the deployment
 * work without a CORS configuration and without publishing the API.
 *
 * Covered here:
 *  · `/api/health` through the frontend answers 200 with the API's envelope,
 *  · a query string survives the proxy,
 *  · a path that is not under `/api` is **not** proxied (404),
 *  · and the browser really issues every API request to its own origin.
 */
import { expect, test } from '@playwright/test'
import { API_BASE, BACKEND_URL, FRONTEND_URL } from '../helpers/paths'
import { seedDatabase } from '../helpers/servers'
import { gotoApp } from '../helpers/ui'

interface HealthEnvelope {
  success: boolean
  data?: { status: string, database: string, uptimeSeconds: number }
  error?: { code: string, message: string }
}

test.describe('The same-origin /api proxy', () => {
  test.beforeEach(async () => {
    seedDatabase()
  })

  test('the frontend forwards /api/health to the backend', async ({ request }) => {
    const throughFrontend = await request.get(`${FRONTEND_URL}/api/health`)
    expect(throughFrontend.status()).toBe(200)
    expect(throughFrontend.headers()['content-type']).toContain('application/json')

    const payload = await throughFrontend.json() as HealthEnvelope
    expect(payload.success).toBe(true)
    expect(payload.data?.status).toBe('ok')
    expect(payload.data?.database).toBe('up')

    // It is the *same* answer the backend gives directly.
    const direct = await request.get(`${BACKEND_URL}/api/health`)
    expect(direct.status()).toBe(200)
    const directPayload = await direct.json() as HealthEnvelope
    expect(payload.data?.status).toBe(directPayload.data?.status)
    expect(payload.data?.database).toBe(directPayload.data?.database)
  })

  test('a query string survives the proxy', async ({ request }) => {
    const plain = await request.get(`${FRONTEND_URL}/api/weeks/current`)
    expect(plain.status()).toBe(200)
    const plainBody = await plain.text()

    const withQuery = await request.get(`${FRONTEND_URL}/api/weeks/current?trace=1&format=json`)
    expect(withQuery.status()).toBe(200)
    const queryBody = await withQuery.text()

    // The query string is forwarded, not swallowed: the payload is the same
    // envelope and still parses as JSON.
    const parsed = JSON.parse(queryBody) as { success: boolean, data: { id: number, label: string } }
    expect(parsed.success).toBe(true)
    expect(parsed.data.label).toBe((JSON.parse(plainBody) as { data: { label: string } }).data.label)
  })

  test('a path outside /api is not proxied to the backend', async ({ request }) => {
    // `/api/../admin` normalises to `/admin` — a path the API does not own.
    // The frontend must answer for it itself instead of forwarding it.
    const response = await request.get(`${FRONTEND_URL}/api/../admin`)
    expect(response.status()).toBe(404)

    // The backend answers with a JSON envelope; the frontend answers with its
    // own 404 page — so the request was *not* forwarded to the API.
    expect(response.headers()['content-type']).toContain('text/html')
    const body = await response.text()
    expect(body).not.toContain('"success"')

    // The same for a plain unknown path.
    const plain = await request.get(`${FRONTEND_URL}/admin`)
    expect(plain.status()).toBe(404)
    expect(plain.headers()['content-type']).toContain('text/html')
  })

  test('the browser only ever calls its own origin', async ({ page }) => {
    const requested: string[] = []
    page.on('request', request => requested.push(request.url()))

    // The settings page loads its data from the API **after** hydration, so
    // the browser really issues the request (the other pages are rendered
    // on the server).
    const apiRequest = page.waitForRequest(
      request => request.url().includes('/api/'),
      { timeout: 20_000 },
    )
    await gotoApp(page, '/settings')
    await apiRequest

    expect(requested.length).toBeGreaterThan(0)

    // Nothing goes to the backend port from the page.
    const foreign = requested.filter(url => url.includes(`:${new URL(BACKEND_URL).port}`))
    expect(foreign, `the page must not call ${BACKEND_URL}`).toEqual([])

    // Every API call is same-origin.
    const apiCalls = requested.filter(url => url.includes('/api/'))
    expect(apiCalls.length, 'the page must load its data through /api').toBeGreaterThan(0)
    const origin = new URL(FRONTEND_URL).host
    for (const url of apiCalls) {
      expect(new URL(url).host, `${url} must be same-origin`).toBe(origin)
    }

    // The API base the app is configured with is the same-origin path.
    expect(API_BASE).toBe(`${BACKEND_URL}/api`)
  })
})
