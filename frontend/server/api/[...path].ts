import { toBackendUrl } from '../utils/backend-url'

/**
 * Same-origin proxy: the browser calls `/api/*` on the frontend, and Nitro
 * forwards it to the backend on the internal Docker network
 * (`NUXT_API_INTERNAL_BASE`, e.g. http://backend:4400). The API and the
 * database are never published, and no CORS configuration is needed.
 */
export default defineEventHandler((event) => {
  const { apiInternalBase } = useRuntimeConfig(event)
  return proxyRequest(event, toBackendUrl(apiInternalBase, event.path))
})
