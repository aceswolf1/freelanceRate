/**
 * Target URL for the `/api` proxy (server/api/[...path].ts).
 *
 * The backend mounts every route under `/api`, so the incoming path is
 * forwarded unchanged (query string included). Anything outside `/api` —
 * including protocol-relative `//host/...` — is rejected so the proxy can
 * never be pointed at another host.
 */
export function toBackendUrl(base: string, path: string): string {
  if (!/^\/api(\/|\?|$)/.test(path)) {
    throw new Error(`Refusing to proxy a non-API path: ${path}`)
  }
  return `${base.replace(/\/+$/, '')}${path}`
}
