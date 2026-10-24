import type {
  ClientSummary,
  Invoice,
  InvoiceEmailDraft,
  InvoiceLine,
  InvoicePreview,
  InvoicePreviewRow,
  InvoiceSubtotal,
} from '../types/api'
import { ApiError } from './useApi'
import { dayShortLabel, parseIsoDate } from '../utils/format'

/**
 * Invoices (R9–R12) — `GET /weeks/:id/invoice-preview`, `GET|POST /weeks/:id/invoices`,
 * `GET /invoices/:id/email`, plus the PDF / zip download plumbing.
 *
 * Two sources feed one view:
 * - `Invoice[]` when the week has already been invoiced (real ids + numbers), and
 * - `InvoicePreviewRow[]` from the preview endpoint, which works on an *open* week.
 *
 * They are normalised to `InvoiceCardData` so a single card component renders both.
 */

// ---------- view models ----------

/** A line as the table renders it — `id` is absent on preview rows. */
export interface InvoiceLineView {
  key: string
  projectId: number | null
  date: string
  projectName: string
  description: string
  hours: number
  rate: number
  lineTotal: number
}

/** One card: either a persisted invoice or a not-yet-generated preview row. */
export interface InvoiceCardData {
  key: string
  /** `null` on a preview row — no PDF, email or number exists yet. */
  invoiceId: number | null
  /** `null` on a preview row. */
  number: string | null
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
  lines: InvoiceLineView[]
  subtotals: InvoiceSubtotal[]
}

/** Where one project's rate came from — drives the "Rate Logic" strip. */
export interface RateLogicEntry {
  projectId: number | null
  projectName: string
  hours: number
  rate: number
  source: 'client' | 'project'
  /** the client's default rate, when the client is known */
  clientRate: number | null
}

const EMPTY_SUBTOTALS: InvoiceSubtotal[] = []

// ---------- normalisers (pure) ----------

export function fromInvoice(invoice: Invoice, currencySymbol: string): InvoiceCardData {
  return {
    key: `invoice-${invoice.id}`,
    invoiceId: invoice.id,
    number: invoice.number,
    clientId: invoice.clientId,
    clientName: invoice.clientName,
    contactEmail: invoice.contactEmail,
    ccEmail: invoice.ccEmail,
    platformCompany: invoice.platformCompany,
    feePercent: invoice.feePercent,
    feeFlat: invoice.feeFlat,
    totalHours: invoice.totalHours,
    gross: invoice.gross,
    feeAmount: invoice.feeAmount,
    net: invoice.net,
    currencySymbol: invoice.currencySymbol || currencySymbol,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    lines: invoice.lines.map(toLineView),
    subtotals: invoice.subtotals ?? EMPTY_SUBTOTALS,
  }
}

export function fromPreviewRow(row: InvoicePreviewRow, currencySymbol: string): InvoiceCardData {
  return {
    key: `preview-${row.clientId ?? 'none'}`,
    invoiceId: null,
    number: null,
    clientId: row.clientId,
    clientName: row.clientName,
    contactEmail: row.contactEmail,
    ccEmail: row.ccEmail,
    platformCompany: row.platformCompany,
    feePercent: row.feePercent,
    feeFlat: row.feeFlat,
    totalHours: row.totalHours,
    gross: row.gross,
    feeAmount: row.feeAmount,
    net: row.net,
    currencySymbol,
    periodStart: '',
    periodEnd: '',
    lines: row.lines.map((line, index) => toLineView(line, index)),
    subtotals: row.subtotals ?? EMPTY_SUBTOTALS,
  }
}

function toLineView(line: InvoiceLine | Omit<InvoiceLine, 'id'>, index = 0): InvoiceLineView {
  return {
    key: `${line.projectId ?? 'none'}-${line.date}-${index}`,
    projectId: line.projectId,
    date: line.date,
    projectName: line.projectName,
    description: line.description,
    hours: line.hours,
    rate: line.rate,
    lineTotal: line.lineTotal,
  }
}

/**
 * Rate-logic strip data.
 *
 * The invoice snapshots a rate per line but not where it came from, so we compare
 * against the client's default: equal ⇒ client default, different ⇒ project override.
 * A standalone project has no client, so it is always an override.
 */
export function buildRateLogic(card: InvoiceCardData, clients: ClientSummary[]): RateLogicEntry[] {
  const clientRate = card.clientId === null
    ? null
    : clients.find(client => client.id === card.clientId)?.billingHour ?? null

  return card.subtotals.map((subtotal) => {
    const rate = rateOfProject(card.lines, subtotal.projectId)
    return {
      projectId: subtotal.projectId,
      projectName: subtotal.projectName,
      hours: subtotal.hours,
      rate,
      source: clientRate !== null && isSameAmount(rate, clientRate) ? 'client' : 'project',
      clientRate,
    }
  })
}

/** A project's rate, read back off its lines — subtotals carry hours/gross only. */
function rateOfProject(lines: InvoiceLineView[], projectId: number | null): number {
  const first = lines.find(line => line.projectId === projectId)
  return first?.rate ?? 0
}

/** Money compare that tolerates float noise (`2015 / 15.5 !== 130` exactly). */
function isSameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005
}

// ---------- date helpers (pure) ----------

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * `2026-10-19` → `Mon, Oct 19`.
 *
 * The invoice line table, the PDF and the email body all read the same way
 * (contract §4.7 shows `Mon, Oct 19  3.5h @ $130.00 = $455.00`). The existing
 * `formatShortDate` gives `Mon 19-10` — the design's `DD-MM-YYYY` convention —
 * so it is not reusable here and the weekday must not be printed twice.
 */
export function formatLineDate(iso: string | null | undefined): string {
  const parts = parseIsoDate(iso)
  if (!parts) {
    return '—'
  }
  const month = MONTH_LABELS[parts.month - 1] ?? '—'
  return `${dayShortLabel(iso)}, ${month} ${parts.day}`
}

// ---------- download helpers (pure, unit-tested) ----------

/**
 * `Content-Disposition` filename, falling back to the contract-derived name.
 *
 * The header is only readable cross-origin when the backend sends
 * `Access-Control-Expose-Headers`, so the fallback is the normal path, not an edge case.
 */
export function parseDownloadFilename(header: string | null | undefined, fallback: string): string {
  if (!header) {
    return fallback
  }

  const encoded = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header)
  if (encoded?.[1]) {
    return safeDecode(encoded[1].trim())
  }

  const plain = /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i.exec(header)
  const value = plain?.[1] ?? plain?.[2]
  return value ? safeDecode(value.trim()) : fallback
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

/** §4.5: `INV-2026-001-acme-corp.pdf`; the standalone bucket becomes `no-client`. */
export function pdfFileName(number: string, clientName: string): string {
  const slug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${number}-${slug || 'no-client'}.pdf`
}

/** §4.6: `invoices-week-43.zip`. */
export function zipFileName(isoWeek: number): string {
  return `invoices-week-${isoWeek}.zip`
}

// ---------- clipboard (pure-ish, exercised against a stubbed clipboard) ----------

/**
 * "Copy formatted" (R12): rich HTML when the browser supports `ClipboardItem`,
 * otherwise plain text. `true` when something was written.
 */
export async function copyEmailDraft(draft: InvoiceEmailDraft): Promise<boolean> {
  const clipboard = globalThis.navigator?.clipboard
  if (!clipboard) {
    return false
  }

  if (canWriteRich(clipboard) && draft.html) {
    try {
      await clipboard.write([new ClipboardItem({
        'text/html': new Blob([draft.html], { type: 'text/html' }),
        'text/plain': new Blob([draft.text], { type: 'text/plain' }),
      })])
      return true
    }
    catch {
      // Fall through to the plain-text path rather than failing the click.
    }
  }

  if (typeof clipboard.writeText !== 'function') {
    return false
  }

  try {
    await clipboard.writeText(draft.text)
    return true
  }
  catch {
    return false
  }
}

type RichClipboard = { write?: (items: unknown[]) => Promise<void> }

function canWriteRich(clipboard: Clipboard): boolean {
  return typeof (clipboard as RichClipboard).write === 'function'
    && typeof globalThis.ClipboardItem !== 'undefined'
}

// ---------- composable ----------

export function useInvoicesState() {
  return useState<InvoicePreview | null>('bf:invoices:preview', () => null)
}

/**
 * Invoices for one week. `preview` is always fresh (the endpoint never writes and is
 * safe to call every render); `invoices` is populated once the week is invoiced.
 */
export function useInvoices() {
  const preview = useInvoicesState()
  const invoices = useState<Invoice[]>('bf:invoices:list', () => [])
  const drafts = useState<Record<number, InvoiceEmailDraft>>('bf:invoices:drafts', () => ({}))
  const pending = useState<boolean>('bf:invoices:pending', () => false)
  const generating = useState<boolean>('bf:invoices:generating', () => false)
  const loadedWeekId = useState<number | null>('bf:invoices:weekId', () => null)
  const notifier = useNotifier()

  // Resolved once, here in setup: `useApi()` reads `useRuntimeConfig()`, which needs an
  // active Nuxt context. A lazy `api()` inside a request helper would run *after* an
  // `await` and throw NUXT_E1001 during SSR.
  const api = useApi()

  const currencySymbol = computed(() =>
    invoices.value[0]?.currencySymbol
    ?? preview.value?.currencySymbol
    ?? useSettings().currencySymbol.value,
  )

  /** Persisted invoices win over the preview — they carry ids and numbers. */
  const cards = computed<InvoiceCardData[]>(() => {
    const symbol = currencySymbol.value
    return invoices.value.length > 0
      ? invoices.value.map(invoice => fromInvoice(invoice, symbol))
      : (preview.value?.invoices ?? []).map(row => fromPreviewRow(row, symbol))
  })

  const hasInvoices = computed(() => invoices.value.length > 0)
  const canGenerate = computed(() => preview.value?.canGenerate ?? false)
  const belowTarget = computed(() => preview.value?.totals.belowTarget ?? false)
  const warnings = computed(() => preview.value?.warnings ?? [])
  const totals = computed(() => preview.value?.totals ?? null)

  async function load(weekId: number, options: { force?: boolean } = {}): Promise<void> {
    if (pending.value || (loadedWeekId.value === weekId && !options.force)) {
      return
    }

    pending.value = true
    try {
      // The preview is authoritative for money/totals; the list tells us whether
      // real invoices already exist. A missing list is not an error worth surfacing.
      const [previewData, invoicesData] = await Promise.all([
        api.get<InvoicePreview>(`/weeks/${weekId}/invoice-preview`, { silent: true }),
        api.get<Invoice[]>(`/weeks/${weekId}/invoices`, { silent: true }).catch(() => [] as Invoice[]),
      ])

      preview.value = previewData
      invoices.value = invoicesData
      drafts.value = {}
      loadedWeekId.value = weekId
    }
    finally {
      pending.value = false
    }
  }

  /** R10 idempotent: 201 the first time, 200 with the same numbers afterwards. */
  async function generate(weekId: number): Promise<Invoice[]> {
    generating.value = true
    try {
      const created = await api.post<Invoice[]>(`/weeks/${weekId}/invoices`, undefined, { silent: true })
      invoices.value = created
      preview.value = preview.value ? { ...preview.value, canGenerate: true } : preview.value
      return created
    }
    finally {
      generating.value = false
    }
  }

  /**
   * Prefetch every mailto draft so the anchors render server-side and the user
   * never waits on a click. Per-invoice and idempotent.
   */
  async function loadDrafts(weekId: number): Promise<void> {
    const missing = invoices.value.filter(invoice => drafts.value[invoice.id] === undefined)
    if (missing.length === 0) {
      return
    }

    const loadedEntries = await Promise.all(
      missing.map(async (invoice) => {
        try {
          const draft = await api.get<InvoiceEmailDraft>(`/invoices/${invoice.id}/email`, { silent: true })
          return [invoice.id, draft] as const
        }
        catch {
          return null
        }
      }),
    )

    const merged = loadedEntries.reduce<Record<number, InvoiceEmailDraft>>((acc, entry) => {
      return entry === null ? acc : { ...acc, [entry[0]]: entry[1] }
    }, {})
    drafts.value = { ...drafts.value, ...merged }
  }

  const draftFor = (invoiceId: number | null): InvoiceEmailDraft | null =>
    invoiceId === null ? null : drafts.value[invoiceId] ?? null

  async function copyFormatted(draft: InvoiceEmailDraft): Promise<boolean> {
    const written = await copyEmailDraft(draft)
    if (written) {
      notifier.success('Invoice copied', 'Paste it into your mail client as rich text.')
    }
    else {
      notifier.error('Could not copy', 'Your browser blocked clipboard access.')
    }
    return written
  }

  function reset(): void {
    preview.value = null
    invoices.value = []
    drafts.value = {}
    loadedWeekId.value = null
  }

  return {
    preview,
    invoices,
    drafts,
    pending,
    generating,
    cards,
    totals,
    warnings,
    hasInvoices,
    canGenerate,
    belowTarget,
    currencySymbol,
    load,
    generate,
    loadDrafts,
    draftFor,
    copyFormatted,
    reset,
  }
}

/** Absolute API URL for a binary endpoint — downloads never go through the envelope. */
export function useInvoiceDownloads() {
  const notifier = useNotifier()

  async function download(url: string, fallbackName: string): Promise<void> {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new ApiError(
          { code: response.status === 404 ? 'NOT_FOUND' : 'INTERNAL', message: `Download failed (${response.status})` },
          response.status,
        )
      }

      const name = parseDownloadFilename(response.headers.get('content-disposition'), fallbackName)
      const objectUrl = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      notifier.success('Download started', name)
    }
    catch (error) {
      notifier.error('Could not download', error instanceof Error ? error.message : undefined)
    }
  }

  // Eager for the same reason as in `useInvoices`: `useApi()` needs an active Nuxt
  // context, so the base URL is captured here rather than at click time.
  const base = useApi().baseUrl

  return {
    /** Preview rows have no invoice yet, so there is nothing to download. */
    downloadPdf: (card: InvoiceCardData) => {
      if (card.invoiceId === null || card.number === null) {
        return Promise.resolve()
      }
      return download(`${base}/invoices/${card.invoiceId}/pdf`, pdfFileName(card.number, card.clientName))
    },
    downloadZip: (weekId: number, isoWeek: number) =>
      download(`${base}/weeks/${weekId}/invoices/zip`, zipFileName(isoWeek)),
    pdfUrl: (invoiceId: number) => `${base}/invoices/${invoiceId}/pdf`,
    zipUrl: (weekId: number) => `${base}/weeks/${weekId}/invoices/zip`,
  }
}