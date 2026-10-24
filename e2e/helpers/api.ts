/**
 * Direct API helpers.
 *
 * The browser can only talk to the API through the CORS proxy; these helpers use
 * Playwright's `request` fixture, which talks to the **real** backend on :4400
 * with no CORS involvement. They are used to assert the API contract itself
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

/** Asserts the standard envelope and returns the payload. */
export function expectEnvelope<T>(result: ApiResult<ApiEnvelope<T>>, status = 200): T {
  expect(result.status, `unexpected status; body=${result.text}`).toBe(status)
  expect(result.json.success).toBe(true)
  expect(result.json.data).toBeDefined()
  return result.json.data as T
}

/** Asserts a failure envelope and returns the error code. */
export function expectError(result: ApiResult<ApiEnvelope<unknown>>, status: number, code?: string): string {
  expect(result.status, `unexpected status; body=${result.text}`).toBe(status)
  expect(result.json.success).toBe(false)
  expect(result.json.error).toBeDefined()
  if (code) {
    expect(result.json.error!.code, `unexpected error code; body=${result.text}`).toBe(code)
  }
  return result.json.error!.code
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
