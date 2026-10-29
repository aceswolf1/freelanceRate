/**
 * Direct API helpers.
 *
 * The browser talks to the API through the frontend's same-origin `/api`
 * proxy; these helpers use Playwright's `request` fixture, which talks to the
 * suite's **own** backend on :4410 (bound to the E2E database) directly, with
 * no CORS involvement. They are used to assert the API contract itself
 * (status codes, error codes, binary payloads) next to the UI assertions.
 */
import { expect, type APIRequestContext } from '@playwright/test'
import { API_BASE } from './paths'

export interface ApiResult<T = unknown> {
  status: number
  ok: boolean
  json: T
  text: string
  headers: Record<string, string>
}

export async function apiCall<T = unknown>(
  request: APIRequestContext,
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const response = await request[method](`${API_BASE}${path}`, {
    ...(body === undefined ? {} : { data: body }),
  })
  const text = await response.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  }
  catch {
    json = null
  }
  return {
    status: response.status(),
    ok: response.ok(),
    json: json as T,
    text,
    headers: response.headers(),
  }
}

export interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: { code: string, message: string, details?: unknown }
}

/**
 * The payload of an API response.
 *
 * The specs annotate their calls either as `ApiEnvelope<T>` or as
 * `{ data: T }` (the shape they actually read); both must yield `T`.
 */
type EnvelopePayload<R> =
  R extends ApiResult<ApiEnvelope<infer T>> ? T
    : R extends ApiResult<{ data: infer T }> ? T
      : unknown

/** Asserts the standard envelope and returns the payload. */
export function expectEnvelope<R extends ApiResult<unknown>>(result: R, status = 200): EnvelopePayload<R> {
  const envelope = result.json as ApiEnvelope<EnvelopePayload<R>>
  expect(result.status, `unexpected status; body=${result.text}`).toBe(status)
  expect(envelope.success).toBe(true)
  expect(envelope.data).toBeDefined()
  return envelope.data as EnvelopePayload<R>
}

/** Asserts a failure envelope and returns the error code. */
export function expectError(result: ApiResult<unknown>, status: number, code?: string): string {
  const envelope = result.json as ApiEnvelope<unknown>
  expect(result.status, `unexpected status; body=${result.text}`).toBe(status)
  expect(envelope.success).toBe(false)
  expect(envelope.error).toBeDefined()
  if (code) {
    expect(envelope.error!.code, `unexpected error code; body=${result.text}`).toBe(code)
  }
  return envelope.error!.code
}

export interface WeekTotalsDto {
  totalHours: number
  projectedGross: number
  targetHours: number
  belowTarget: boolean
  hoursBelowTarget: number
  clientCount: number
  recordCount: number
}

export interface WeekDto {
  id: number
  startDate: string
  endDate: string
  status: 'open' | 'closed'
  closedAt: string | null
  label: string
  isoWeek: number
  invoiceCount: number
  totals: WeekTotalsDto
  days: Array<{
    date: string
    dayName: string
    dayOfWeek: number
    isWeekend: boolean
    hours: number
    projectedGross: number
    records: unknown[]
  }>
}

export interface InvoiceDto {
  id: number
  number: string
  weekId: number
  clientId: number | null
  clientName: string
  /** The person's name — `null` when the client has no contact name. */
  contactName: string | null
  contactEmail: string
  ccEmail: string | null
  platformCompany: string | null
  feePercent: number
  feeFlat: number
  totalHours: number
  gross: number
  feeAmount: number
  net: number
  currencySymbol: string
  periodStart: string
  periodEnd: string
  lines: Array<{ id: number, date: string, projectName: string, hours: number, rate: number, lineTotal: number }>
  subtotals: Array<{ projectId: number | null, projectName: string, hours: number, gross: number }>
}

/** The week that contains "today" — the week the seed builds. */
export async function currentWeek(request: APIRequestContext): Promise<WeekDto> {
  const result = await apiCall<ApiEnvelope<WeekDto>>(request, 'get', '/weeks/current')
  return expectEnvelope(result)
}
