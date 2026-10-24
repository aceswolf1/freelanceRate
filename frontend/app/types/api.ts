/**
 * API types — copied from `development/freelancer-invoices/orchestration-ctx/decisions/api-contract.md` §2.
 * That document is authoritative; do not infer shapes from backend source.
 *
 * Contract highlights encoded here:
 * - money is a JSON number in major units (130.5 === $130.50), hours up to 2dp
 * - calendar dates are `YYYY-MM-DD` strings, timestamps are ISO-8601 UTC; never `Date`
 * - ids are integers on the wire; the UI formats them for display (`#CLI-001`)
 * - `VALIDATION_ERROR.details` is an **array** of `{ path, message }`, not an object
 */

// ---------- enums ----------
export type WeekStatus = 'open' | 'closed'
export type RateSource = 'project' | 'client'
export type WarningCode = 'BELOW_TARGET' | 'WEEK_OPEN' | 'NO_RECORDS'
export type EarningsGroupBy = 'project' | 'client'

// ---------- envelope ----------
export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export interface ApiErrorBody {
  code: string
  message: string
  details?: unknown
}

export interface ApiFailure {
  success: false
  error: ApiErrorBody
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure
export type ApiResponse<T> = ApiEnvelope<T>

/** Codes the backend is contracted to emit (team plan §Shared Conventions). */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'WEEK_CLOSED',
  'INTERNAL',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number] | 'NETWORK_ERROR' | 'HTTP_ERROR'

/** Statuses worth surfacing to the user verbatim rather than as "unexpected". */
export const EXPECTED_ERROR_STATUSES: Record<number, ApiErrorCode> = {
  400: 'VALIDATION_ERROR',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  // §4.5/§4.6: an oversized body is reported as VALIDATION_ERROR with HTTP 413.
  413: 'VALIDATION_ERROR',
}

export interface NormalizedApiFailure {
  code: ApiErrorCode
  message: string
  details?: unknown
}

export function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return typeof value === 'object' && value !== null && 'success' in value
}

/** Normalise anything thrown by `$fetch` into the envelope's error shape. */
export function toApiFailure(error: unknown): NormalizedApiFailure {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      code?: unknown
      message?: unknown
      statusCode?: unknown
      status?: unknown
      data?: unknown
    }

    const payload
      = typeof candidate.data === 'object' && candidate.data !== null
        ? (candidate.data as Record<string, unknown>)
        : undefined

    const nestedError
      = payload && typeof payload.error === 'object' && payload.error !== null
        ? (payload.error as Record<string, unknown>)
        : undefined

    const code = nestedError?.code ?? candidate.code
    const message = nestedError?.message ?? candidate.message
    const details = nestedError?.details

    const status = typeof candidate.statusCode === 'number'
      ? candidate.statusCode
      : typeof candidate.status === 'number'
        ? candidate.status
        : undefined

    const resolvedCode: ApiErrorCode = typeof code === 'string'
      ? code as ApiErrorCode
      : status !== undefined
        ? (EXPECTED_ERROR_STATUSES[status] ?? (status >= 500 ? 'INTERNAL' : 'HTTP_ERROR'))
        : 'NETWORK_ERROR'

    return {
      code: resolvedCode,
      message: typeof message === 'string' ? message : 'Something went wrong.',
      ...(details === undefined ? {} : { details }),
    }
  }

  return { code: 'NETWORK_ERROR', message: 'Something went wrong.' }
}

// ---------- shared ----------
export interface ClientSummary {
  id: number
  name: string
  contactEmail: string
  ccEmail: string | null
  billingHour: number
}

export interface ProjectSummary {
  id: number
  name: string
  clientId: number | null
}

export interface DeleteResult {
  id: number
  deleted: true
}

// ---------- payment platforms (R3) ----------
export interface PaymentPlatform {
  id: number
  company: string
  /** 1 => 1% */
  feePercent: number
  /** 15 => $15.00 */
  feeFlat: number
  createdAt: string
}

export type PaymentPlatformInput = {
  company: string
  feePercent?: number
  feeFlat?: number
}

export type PaymentPlatformUpdate = Partial<PaymentPlatformInput>

// ---------- clients (R1) ----------
export interface Client extends ClientSummary {
  paymentPlatformId: number | null
  /** embedded on list + get */
  paymentPlatform: PaymentPlatform | null
  /** non-archived projects */
  projectCount: number
  /** lifetime hours across all work records */
  totalHours: number
  /** lifetime projected gross across all work records */
  totalGross: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ClientInput {
  name: string
  contactEmail: string
  ccEmail?: string | null
  billingHour: number
  paymentPlatformId?: number | null
  notes?: string | null
}

export type ClientUpdate = Partial<ClientInput>

// ---------- projects (R2) ----------
export interface Project extends ProjectSummary {
  description: string | null
  /** project override; null = inherit from client */
  billingHour: number | null
  /** billingHour ?? client.billingHour (never null) */
  effectiveRate: number
  /** where effectiveRate came from */
  rateSource: RateSource
  /** clientId === null */
  standalone: boolean
  archived: boolean
  /** embedded on list + get */
  client: ClientSummary | null
  createdAt: string
  updatedAt: string
}

export interface ProjectInput {
  name: string
  clientId?: number | null
  description?: string | null
  billingHour?: number | null
  archived?: boolean
}

export type ProjectUpdate = Partial<ProjectInput>

// ---------- settings (R15) ----------
export interface Settings {
  /** singleton row */
  id: 1
  displayName: string
  /** default 40 */
  weeklyTargetHours: number
  /** default "$" */
  currencySymbol: string
  /** default "INV" → INV-2026-001 */
  invoicePrefix: string
  updatedAt: string
}

export type SettingsUpdate = Partial<Omit<Settings, 'id' | 'updatedAt'>>

// ---------- work records (R5) ----------
export interface WorkRecord {
  id: number
  weekId: number
  projectId: number
  /** null if the project was deleted after invoicing */
  project: ProjectSummary | null
  /** derived from the project at write time; null for standalone */
  clientId: number | null
  /** null for standalone projects */
  client: ClientSummary | null
  description: string
  /** > 0, <= 24 */
  hours: number
  /** YYYY-MM-DD, always inside the week */
  date: string
  /** effectiveRate at read time */
  rate: number
  /** hours * rate, 2dp */
  lineTotal: number
  createdAt: string
  updatedAt: string
}

export interface WorkRecordInput {
  projectId: number
  description: string
  /** > 0, <= 24 */
  hours: number
  /** YYYY-MM-DD, must fall inside the target week */
  date: string
}

export type WorkRecordUpdate = Partial<WorkRecordInput>

// ---------- weeks (R4, R7, R8) ----------
export interface WeekProjectTotal {
  projectId: number
  projectName: string
  clientId: number | null
  /** null = standalone bucket */
  clientName: string | null
  rate: number
  hours: number
  gross: number
}

export interface WeekClientTotal {
  /** null = "No client" (standalone) bucket */
  clientId: number | null
  clientName: string | null
  hours: number
  gross: number
}

export interface WeekTotals {
  totalHours: number
  projectedGross: number
  /** from settings.weeklyTargetHours */
  targetHours: number
  belowTarget: boolean
  /** max(0, targetHours - totalHours), 2dp */
  hoursBelowTarget: number
  /** distinct non-null clients; the standalone bucket is not a client */
  clientCount: number
  recordCount: number
  byProject: WeekProjectTotal[]
  byClient: WeekClientTotal[]
}

export interface WeekDay {
  /** YYYY-MM-DD */
  date: string
  /** "Mon" | "Tue" | … | "Sun" */
  dayName: string
  /** ISO: Monday = 1 … Sunday = 7 */
  dayOfWeek: number
  /** Sat/Sun — muted in the UI but still insertable */
  isWeekend: boolean
  hours: number
  projectedGross: number
  records: WorkRecord[]
}

export interface Week {
  id: number
  /** Monday, YYYY-MM-DD */
  startDate: string
  /** Sunday, YYYY-MM-DD */
  endDate: string
  status: WeekStatus
  closedAt: string | null
  /** "Week 43: 19-10-2026 – 25-10-2026" */
  label: string
  /** 43 */
  isoWeek: number
  /** always 7 entries, Monday first, including empty days */
  days: WeekDay[]
  totals: WeekTotals
  /** invoices already issued for this week */
  invoiceCount: number
}

// ---------- invoices (R9–R12, implemented by worker-3) ----------
export interface InvoiceLine {
  id: number
  recordId: number | null
  date: string
  projectId: number | null
  /** snapshot */
  projectName: string
  /** snapshot */
  description: string
  hours: number
  /** snapshot of the effective rate */
  rate: number
  lineTotal: number
}

export interface InvoiceSubtotal {
  projectId: number | null
  projectName: string
  hours: number
  gross: number
}

export interface Invoice {
  id: number
  /** "INV-2026-001" */
  number: string
  weekId: number
  /** null = "No client" bucket */
  clientId: number | null
  /** "No client" when clientId is null */
  clientName: string
  contactEmail: string
  ccEmail: string | null
  /** snapshot, null when the client has no platform */
  platformCompany: string | null
  feePercent: number
  feeFlat: number
  totalHours: number
  gross: number
  /** absorbed by the freelancer */
  feeAmount: number
  /** gross - feeAmount */
  net: number
  currencySymbol: string
  periodStart: string
  periodEnd: string
  createdAt: string
  lines: InvoiceLine[]
  subtotals: InvoiceSubtotal[]
}

export interface InvoiceWarning {
  code: WarningCode
  /** ready to render, e.g. "32 / 40 hrs, -8 below target" */
  message: string
}

export interface InvoicePreviewRow {
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
  lines: Array<Omit<InvoiceLine, 'id'>>
  subtotals: InvoiceSubtotal[]
}

export interface InvoicePreview {
  weekId: number
  periodStart: string
  periodEnd: string
  status: WeekStatus
  /** status === 'closed' */
  canGenerate: boolean
  currencySymbol: string
  totals: WeekTotals
  warnings: InvoiceWarning[]
  invoices: InvoicePreviewRow[]
}

export interface InvoiceEmailDraft {
  to: string
  cc: string | null
  subject: string
  /** plain-text tables, one block per project */
  text: string
  /** HTML tables for "Copy formatted" */
  html: string
  /** percent-encoded */
  mailto: string
  /** true when the body exceeded the mailto length limit */
  truncated: boolean
}

// ---------- earnings (R13) ----------
export interface EarningsRow {
  /** null for the "No client" bucket when grouping by client */
  id: number | null
  /** project name, client name, or "No client" when null */
  name: string
  hours: number
  gross: number
  fees: number
  net: number
}

/**
 * Additive field, NOT in the original contract §2 — recorded as an accepted
 * deviation in api-contract.md §8.1 (2026-10-23, endpoint #35).
 *
 * The hours that exist as work records but are **not** covered by any issued
 * invoice. Totalled by the same fee model, so `rows + unbilled` explains
 * everything logged in the range.
 */
export interface EarningsUnbilled {
  hours: number
  gross: number
  fees: number
  net: number
  /** distinct weeks contributing unbilled work */
  weekCount: number
}

export interface EarningsReport {
  /** YYYY-MM-DD inclusive */
  from: string
  /** YYYY-MM-DD inclusive */
  to: string
  groupBy: EarningsGroupBy
  currencySymbol: string
  rows: EarningsRow[]
  totals: { hours: number, gross: number, fees: number, net: number }
  /** §8.1 additive block — work logged in range that no invoice covers yet. */
  unbilled: EarningsUnbilled
}