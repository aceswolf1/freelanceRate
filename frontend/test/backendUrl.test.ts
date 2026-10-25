import { describe, expect, it } from 'vitest'

import { toBackendUrl } from '../server/utils/backend-url'

describe('toBackendUrl — the /api proxy target', () => {
  it('keeps the /api prefix the backend routes expect', () => {
    expect(toBackendUrl('http://backend:4400', '/api/health')).toBe('http://backend:4400/api/health')
  })

  it('preserves the query string', () => {
    expect(toBackendUrl('http://backend:4400', '/api/reports/earnings?from=2026-10-01&groupBy=client'))
      .toBe('http://backend:4400/api/reports/earnings?from=2026-10-01&groupBy=client')
  })

  it('tolerates a trailing slash on the base', () => {
    expect(toBackendUrl('http://backend:4400/', '/api/clients/1')).toBe('http://backend:4400/api/clients/1')
  })

  it('refuses paths outside /api so the proxy cannot be used as an open relay', () => {
    expect(() => toBackendUrl('http://backend:4400', '/admin')).toThrow()
    expect(() => toBackendUrl('http://backend:4400', '//evil.example/api/x')).toThrow()
  })
})
