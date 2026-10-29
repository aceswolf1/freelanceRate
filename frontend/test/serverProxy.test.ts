// @vitest-environment nuxt
/**
 * Contract test for the same-origin API proxy (`server/api/[...path].ts`).
 *
 * The browser calls `/api/*` on the frontend and Nitro forwards it to the
 * backend on the internal network, so the API and the database are never
 * published and no CORS configuration is needed.
 *
 * `defineEventHandler` and `proxyRequest` are Nitro (h3) auto-imports that do
 * not exist in the unit-test environment, so they are stubbed here and the
 * real handler is exercised against them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const proxyRequest = vi.fn()

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('proxyRequest', proxyRequest)

const { default: proxyHandler } = await import('../server/api/[...path]')

function apiBase(): string {
  return useRuntimeConfig().apiInternalBase as string
}

describe('the /api proxy', () => {
  beforeEach(() => {
    proxyRequest.mockReset()
    proxyRequest.mockImplementation((_event: unknown, _target: string) => ({ proxied: true }))
  })

  afterEach(() => {
    proxyRequest.mockReset()
  })

  it('forwards the request to the backend, keeping the /api prefix', async () => {
    const event = { path: '/api/clients' }

    await proxyHandler(event)

    expect(proxyRequest).toHaveBeenCalledTimes(1)
    expect(proxyRequest).toHaveBeenCalledWith(event, `${apiBase()}/api/clients`)
  })

  it('preserves the query string', async () => {
    const event = { path: '/api/reports/earnings?from=2026-10-01&groupBy=client' }

    await proxyHandler(event)

    expect(proxyRequest).toHaveBeenCalledWith(event, `${apiBase()}/api/reports/earnings?from=2026-10-01&groupBy=client`)
  })

  it('returns whatever the backend answered', async () => {
    proxyRequest.mockReturnValue({ statusCode: 200, body: { success: true, data: [] } })

    const result = await proxyHandler({ path: '/api/clients' })

    expect(result).toEqual({ statusCode: 200, body: { success: true, data: [] } })
  })

  it('refuses to proxy a path outside /api, so it cannot be used as an open relay', () => {
    expect(() => proxyHandler({ path: '/admin' })).toThrow(/non-API path/)
    expect(proxyRequest).not.toHaveBeenCalled()
  })
})
