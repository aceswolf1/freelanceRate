import type { ApiEnvelope, ApiErrorCode } from '../types/api'
import { isApiEnvelope, toApiFailure } from '../types/api'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  query?: Record<string, unknown>
  /** Suppress the global "unexpected error" toast — used when the caller renders inline errors. */
  silent?: boolean
  headers?: Record<string, string>
}

/** Typed error thrown by every `useApi` call. Carries the backend's error envelope verbatim. */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number | undefined
  readonly details: unknown

  constructor(failure: { code: ApiErrorCode, message: string, details?: unknown }, status?: number) {
    super(failure.message)
    this.name = 'ApiError'
    this.code = failure.code
    this.details = failure.details
    this.status = status
  }

  /**
   * Field-level messages for inline form errors.
   *
   * Contract §1.5: `VALIDATION_ERROR` carries `details` as an **array** of
   * `{ path, message }` (e.g. `[{ path: "hours", message: "..." }]`). Some
   * services send an object map instead, so both shapes are handled.
   */
  get fieldErrors(): Record<string, string> {
    return toFieldErrors(this.details)
  }

  /** 409 is expected business flow (delete blocked, week closed) — show it, don't shout. */
  get isConflict(): boolean {
    return this.code === 'CONFLICT' || this.code === 'WEEK_CLOSED'
  }
}

/**
 * Thin typed wrapper over `$fetch`.
 *
 * - Base URL from `runtimeConfig.public.apiBase` (`NUXT_PUBLIC_API_BASE`).
 * - Unwraps `{ success, data, meta }` so callers get `T` directly.
 * - Throws `ApiError` on `success: false` or a transport failure.
 * - Surfaces *unexpected* failures as a global toast; expected 4xx stay silent so
 *   forms can render them inline.
 */
/** Fallback used when the Nuxt runtime config cannot be read. */
export const DEFAULT_API_BASE = 'http://localhost:4400/api'

/**
 * Read the API base URL.
 *
 * `useRuntimeConfig()` needs an active Nuxt instance. If it is unavailable —
 * a composable created after an `await` during SSR, for instance — fall back to
 * the default rather than throwing and taking the page down.
 */
function resolveApiBase(): string {
  try {
    const config = useRuntimeConfig()
    const base = config.public?.apiBase
    return typeof base === 'string' && base.length > 0 ? base : DEFAULT_API_BASE
  }
  catch {
    return DEFAULT_API_BASE
  }
}

export function useApi() {
  const baseUrl = resolveApiBase()
  const notifier = useNotifier()

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, query, silent = false, headers } = options
    const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`

    try {
      const raw = await $fetch<ApiEnvelope<T> | T>(url, {
        method,
        ...(body === undefined ? {} : { body: body as Record<string, unknown> }),
        ...(query === undefined ? {} : { query }),
        ...(headers === undefined ? {} : { headers }),
      })

      if (isApiEnvelope<T>(raw)) {
        if (raw.success) {
          return raw.data
        }
        throw new ApiError({ code: raw.error.code as ApiErrorCode, message: raw.error.message, details: raw.error.details })
      }

      return raw as T
    }
    catch (error) {
      const apiError = error instanceof ApiError
        ? error
        : new ApiError(toApiFailure(error), statusOf(error))

      if (!silent && !apiError.isConflict && !isExpected(apiError)) {
        notifier.error(apiError.code === 'NETWORK_ERROR' ? 'Cannot reach the API' : 'Unexpected error', apiError.message)
      }

      throw apiError
    }
  }

  const get = <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' })
  const post = <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'POST', body })
  const patch = <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PATCH', body })
  const put = <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PUT', body })
  const del = <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' })

  return { request, get, post, patch, put, del, baseUrl }
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }
  const candidate = error as { statusCode?: unknown, status?: unknown }
  if (typeof candidate.statusCode === 'number') {
    return candidate.statusCode
  }
  return typeof candidate.status === 'number' ? candidate.status : undefined
}

/** 4xx are the caller's to handle; only 5xx and transport failures are "unexpected". */
function isExpected(error: ApiError): boolean {
  return error.status !== undefined && error.status < 500
}

/**
 * Collapse a `VALIDATION_ERROR` `details` payload into `{ fieldName: message }`.
 *
 * Accepts the contracted array form and a plain object map. Keys are indexed by
 * the **last** path segment (`"contactEmail"`), because Zod paths can be nested
 * (`"paymentPlatform.company"`).
 */
export function toFieldErrors(details: unknown): Record<string, string> {
  if (Array.isArray(details)) {
    return details.reduce<Record<string, string>>((acc, item) => {
      if (typeof item !== 'object' || item === null) {
        return acc
      }
      const { path, message } = item as { path?: unknown, message?: unknown }
      if (typeof path !== 'string' || typeof message !== 'string') {
        return acc
      }
      const key = path.split('.').pop() ?? path
      // First error per field wins; that is what the user acts on first.
      return key in acc ? acc : { ...acc, [key]: message }
    }, {})
  }

  if (typeof details !== 'object' || details === null) {
    return {}
  }

  return Object.entries(details as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, value]) => (typeof value === 'string' ? { ...acc, [key]: value } : acc),
    {},
  )
}