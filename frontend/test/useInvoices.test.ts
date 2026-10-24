// @vitest-environment nuxt
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Invoice, InvoiceEmailDraft, InvoicePreview } from '~/types/api'
import { ApiError } from '~/composables/useApi'
import {
  buildRateLogic,
  copyEmailDraft,
  fromInvoice,
  fromPreviewRow,
  parseDownloadFilename,
  pdfFileName,
  zipFileName,
} from '~/composables/useInvoices'

// Nuxt resolves the `$fetch` auto-import to `#build/fetch`; mocking it intercepts
// every `useApi` call (same trick as clients.test.ts).
vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

/**
 * The API base is environment-driven (`NUXT_PUBLIC_API_BASE`), so expectations
 * are built from the running config rather than hardcoding a port.
 */
function apiUrl(path: string): string {
  return `${useRuntimeConfig().public.apiBase as string}${path}`
}

const ok = <T>(data: T) => ({ success: true, data })

/** Contract §4.1 worked example — Acme Corp: 17.5h, $2 275.00 gross, 1% fee. */
function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    number: 'INV-2026-001',
    weekId: 1,
    clientId: 1,
    clientName: 'Acme Corp',
    contactEmail: 'billing@acme.example',
    ccEmail: 'finance@acme.example',
    platformCompany: 'Payoneer',
    feePercent: 1,
    feeFlat: 0,
    totalHours: 17.5,
    gross: 2275,
    feeAmount: 22.75,
    net: 2252.25,
    currencySymbol: '$',
    periodStart: '2026-10-19',
    periodEnd: '2026-10-25',
    createdAt: '2026-10-26T09:00:00.000Z',
    lines: [
      {
        id: 1,
        recordId: 1,
        date: '2026-10-19',
        projectId: 1,
        projectName: 'E-Commerce Storefront',
        description: 'Checkout flow rebuild',
        hours: 15.5,
        rate: 130,
        lineTotal: 2015,
      },
      {
        id: 2,
        recordId: 2,
        date: '2026-10-19',
        projectId: 2,
        projectName: 'API Microservice',
        description: 'Rate-limit middleware',
        hours: 2,
        rate: 130,
        lineTotal: 260,
      },
    ],
    subtotals: [
      { projectId: 1, projectName: 'E-Commerce Storefront', hours: 15.5, gross: 2015 },
      { projectId: 2, projectName: 'API Microservice', hours: 2, gross: 260 },
    ],
    ...overrides,
  }
}

function makePreview(overrides: Partial<InvoicePreview> = {}): InvoicePreview {
  const acme = fromPreviewRow({
    clientId: 1,
    clientName: 'Acme Corp',
    contactEmail: 'billing@acme.example',
    ccEmail: null,
    platformCompany: 'Payoneer',
    feePercent: 1,
    feeFlat: 0,
    totalHours: 17.5,
    gross: 2275,
    feeAmount: 22.75,
    net: 2252.25,
    lines: [],
    subtotals: [],
  }, '$')

  return {
    weekId: 1,
    periodStart: '2026-10-19',
    periodEnd: '2026-10-25',
    status: 'open',
    canGenerate: false,
    currencySymbol: '$',
    totals: {
      totalHours: 34.5,
      projectedGross: 4180,
      targetHours: 40,
      belowTarget: true,
      hoursBelowTarget: 5.5,
      clientCount: 2,
      recordCount: 12,
      byProject: [],
      byClient: [],
    },
    warnings: [{ code: 'BELOW_TARGET', message: '34.5 / 40 hrs, -5.5 below target' }],
    invoices: [acme],
    ...overrides,
  }
}

const mailto = 'mailto:billing@acme.example?subject=Invoice&body=Hello'

function makeDraft(overrides: Partial<InvoiceEmailDraft> = {}): InvoiceEmailDraft {
  return {
    to: 'billing@acme.example',
    cc: null,
    subject: 'Invoice INV-2026-001',
    text: 'plain body',
    html: '<p>rich body</p>',
    mailto,
    truncated: false,
    ...overrides,
  }
}

describe('useInvoices', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    clearNuxtState()
    const { $fetch } = await import('#build/fetch')
    fetchMock = vi.mocked($fetch)
    fetchMock.mockReset()
  })

  it('loads the preview and the invoice list for a week', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      return String(url).endsWith('/invoices') ? ok([]) : ok(makePreview())
    })
    const { load, cards, canGenerate } = useInvoices()

    await load(1, { force: true })

    expect(fetchMock).toHaveBeenCalledWith(
      apiUrl('/weeks/1/invoice-preview'),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(cards.value).toHaveLength(1)
    // Open week: preview only, generation blocked.
    expect(canGenerate.value).toBe(false)
  })

  it('renders preview rows (no ids) while the week is open', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      return String(url).endsWith('/invoices') ? ok([]) : ok(makePreview())
    })
    const { load, cards } = useInvoices()

    await load(1, { force: true })

    expect(cards.value[0]?.invoiceId).toBeNull()
    expect(cards.value[0]?.number).toBeNull()
    expect(cards.value[0]?.gross).toBe(2275)
  })

  it('prefers persisted invoices over the preview once the week is invoiced', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      return String(url).endsWith('/invoices') ? ok([makeInvoice()]) : ok(makePreview({ status: 'closed', canGenerate: true }))
    })
    const { load, cards, hasInvoices } = useInvoices()

    await load(1, { force: true })

    expect(hasInvoices.value).toBe(true)
    expect(cards.value).toHaveLength(1)
    expect(cards.value[0]?.invoiceId).toBe(1)
    expect(cards.value[0]?.number).toBe('INV-2026-001')
    expect(cards.value[0]?.lines).toHaveLength(2)
  })

  it('generates invoices and keeps the same numbers on a repeat call (R10 idempotent)', async () => {
    fetchMock.mockImplementation(async (url: string, options?: { method?: string }) => {
      if (String(url).endsWith('/invoices') && options?.method === 'POST') {
        return ok([makeInvoice()])
      }
      return String(url).endsWith('/invoices') ? ok([]) : ok(makePreview())
    })
    const { load, generate, cards } = useInvoices()
    await load(1, { force: true })

    await generate(1)
    const first = cards.value.map(c => [c.gross, c.feeAmount, c.net])
    await generate(1)
    const second = cards.value.map(c => [c.gross, c.feeAmount, c.net])

    expect(second).toEqual(first)
    expect(first[0]).toEqual([2275, 22.75, 2252.25])
  })

  it('surfaces a 409 when the week is still open', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      return String(url).endsWith('/invoices') ? ok([]) : ok(makePreview())
    })
    const { load, generate } = useInvoices()
    await load(1, { force: true })

    fetchMock.mockRejectedValue(new ApiError(
      { code: 'CONFLICT', message: 'Close week 43 before generating invoices' },
      409,
    ))

    await expect(generate(1)).rejects.toBeInstanceOf(ApiError)
  })

  it('prefetches mailto drafts once per invoice', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/email')) {
        return ok(makeDraft())
      }
      return String(url).endsWith('/invoices') ? ok([makeInvoice()]) : ok(makePreview({ canGenerate: true }))
    })
    const { load, loadDrafts, draftFor, hasInvoices } = useInvoices()
    await load(1, { force: true })
    expect(hasInvoices.value).toBe(true)

    await loadDrafts(1)
    expect(draftFor(1)?.mailto).toBe(mailto)
    expect(draftFor(null)).toBeNull()

    const emailCalls = fetchMock.mock.calls.filter(call => String(call[0]).includes('/email'))
    expect(emailCalls).toHaveLength(1)

    // Second pass is a no-op — drafts are cached per invoice.
    await loadDrafts(1)
    expect(fetchMock.mock.calls.filter(call => String(call[0]).includes('/email'))).toHaveLength(1)
  })

  it('caches nothing across a forced reload so a regenerated week refreshes', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      return String(url).endsWith('/invoices') ? ok([makeInvoice()]) : ok(makePreview({ canGenerate: true }))
    })
    const { load, draftFor } = useInvoices()

    await load(1, { force: true })
    expect(draftFor(1)).toBeNull()

    await load(1, { force: true })
    expect(draftFor(1)).toBeNull()
  })
})

describe('useInvoices — view model helpers', () => {
  it('normalises an invoice into a card with lines and subtotals', () => {
    const card = fromInvoice(makeInvoice(), '$')

    expect(card).toMatchObject({
      key: 'invoice-1',
      invoiceId: 1,
      number: 'INV-2026-001',
      clientName: 'Acme Corp',
      gross: 2275,
      feeAmount: 22.75,
      net: 2252.25,
      currencySymbol: '$',
    })
    expect(card.lines.map(l => l.projectName)).toEqual(['E-Commerce Storefront', 'API Microservice'])
  })

  it('marks a preview row as not-yet-generated and keys it by client bucket', () => {
    const card = fromPreviewRow({
      clientId: null,
      clientName: 'No client',
      contactEmail: '',
      ccEmail: null,
      platformCompany: null,
      feePercent: 0,
      feeFlat: 0,
      totalHours: 2.5,
      gross: 237.5,
      feeAmount: 0,
      net: 237.5,
      lines: [],
      subtotals: [],
    }, '$')

    expect(card.key).toBe('preview-none')
    expect(card.invoiceId).toBeNull()
  })

  it('reads the rate logic as client-default vs project override (R2)', () => {
    const card = fromInvoice(makeInvoice(), '$')
    const clients = [{ id: 1, name: 'Acme Corp', contactEmail: 'billing@acme.example', ccEmail: null, billingHour: 130 }]

    const logic = buildRateLogic(card, clients)

    expect(logic).toHaveLength(2)
    // Both projects bill at the client's 130/hr default.
    expect(logic.every(entry => entry.source === 'client')).toBe(true)
    expect(logic[0]).toMatchObject({ projectName: 'E-Commerce Storefront', rate: 130, clientRate: 130 })
  })

  it('detects a project rate override against a different client default', () => {
    const invoice = makeInvoice({
      lines: [{
        id: 1,
        recordId: 1,
        date: '2026-10-20',
        projectId: 3,
        projectName: 'Video Streaming Mobile App',
        description: 'Playback pipeline',
        hours: 14.5,
        rate: 115,
        lineTotal: 1667.5,
      }],
      subtotals: [{ projectId: 3, projectName: 'Video Streaming Mobile App', hours: 14.5, gross: 1667.5 }],
    })
    const clients = [{ id: 1, name: 'Acme Corp', contactEmail: 'billing@acme.example', ccEmail: null, billingHour: 100 }]

    const [entry] = buildRateLogic(fromInvoice(invoice, '$'), clients)

    expect(entry?.source).toBe('project')
    expect(entry?.rate).toBe(115)
    expect(entry?.clientRate).toBe(100)
  })

  it('treats standalone work as a project rate (no client to inherit from)', () => {
    const card = fromPreviewRow({
      clientId: null,
      clientName: 'No client',
      contactEmail: '',
      ccEmail: null,
      platformCompany: null,
      feePercent: 0,
      feeFlat: 0,
      totalHours: 2.5,
      gross: 237.5,
      feeAmount: 0,
      net: 237.5,
      lines: [],
      subtotals: [{ projectId: 4, projectName: 'Internal Tools', hours: 2.5, gross: 237.5 }],
    }, '$')
    card.lines.push({
      key: '4-2026-10-24-0',
      projectId: 4,
      date: '2026-10-24',
      projectName: 'Internal Tools',
      description: 'PDF template cleanup',
      hours: 2.5,
      rate: 95,
      lineTotal: 237.5,
    })

    expect(buildRateLogic(card, [])[0]?.source).toBe('project')
  })
})

describe('useInvoices — download helpers', () => {
  it('builds the contract filename for a client invoice (§4.5)', () => {
    expect(pdfFileName('INV-2026-001', 'Acme Corp')).toBe('INV-2026-001-acme-corp.pdf')
  })

  it('uses no-client for the standalone bucket', () => {
    expect(pdfFileName('INV-2026-003', '')).toBe('INV-2026-003-no-client.pdf')
  })

  it('collapses punctuation in a client name', () => {
    expect(pdfFileName('INV-2026-002', 'Starlight Media!')).toBe('INV-2026-002-starlight-media.pdf')
  })

  it('names the zip after the ISO week (§4.6)', () => {
    expect(zipFileName(43)).toBe('invoices-week-43.zip')
  })

  it('prefers the Content-Disposition filename when the backend exposes it', () => {
    const header = 'attachment; filename="INV-2026-001-acme-corp.pdf"'
    expect(parseDownloadFilename(header, 'fallback.pdf')).toBe('INV-2026-001-acme-corp.pdf')
  })

  it('falls back when the header is missing (not exposed cross-origin)', () => {
    expect(parseDownloadFilename(null, 'fallback.pdf')).toBe('fallback.pdf')
    expect(parseDownloadFilename('', 'fallback.pdf')).toBe('fallback.pdf')
  })

  it('decodes an RFC 5987 filename*', () => {
    expect(parseDownloadFilename("attachment; filename*=UTF-8''INV%202026.pdf", 'x.pdf')).toBe('INV 2026.pdf')
  })
})

describe('useInvoices — clipboard', () => {
  function stubClipboard(partial: Partial<Clipboard>) {
    const clipboard = { writeText: vi.fn(async () => {}), ...partial }
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: clipboard,
      configurable: true,
    })
    return clipboard
  }

  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('writes rich HTML via ClipboardItem when available (R12)', async () => {
    const write = vi.fn(async () => {})
    stubClipboard({ write } as Partial<Clipboard>)
    vi.stubGlobal('ClipboardItem', class {
      constructor(public items: Record<string, Blob>) {}
    })

    const written = await copyEmailDraft(makeDraft())

    expect(written).toBe(true)
    expect(write).toHaveBeenCalledOnce()
    // `clipboard.write()` takes an array of ClipboardItem, each holding a mime map.
    const payload = write.mock.calls[0]![0] as Array<{ items: Record<string, Blob> }>
    expect(payload).toHaveLength(1)
    expect(Object.keys(payload[0]!.items)).toEqual(['text/html', 'text/plain'])
  })

  it('falls back to writeText when ClipboardItem is unavailable', async () => {
    const writeText = vi.fn(async () => {})
    stubClipboard({ writeText })

    const written = await copyEmailDraft(makeDraft())

    expect(written).toBe(true)
    expect(writeText).toHaveBeenCalledWith('plain body')
  })

  it('falls back to writeText when the rich write is rejected', async () => {
    const writeText = vi.fn(async () => {})
    stubClipboard({ write: vi.fn(async () => { throw new Error('denied') }), writeText } as Partial<Clipboard>)
    vi.stubGlobal('ClipboardItem', class {
      constructor(public items: Record<string, Blob>) {}
    })

    const written = await copyEmailDraft(makeDraft())

    expect(written).toBe(true)
    expect(writeText).toHaveBeenCalledWith('plain body')
  })

  it('reports failure when the clipboard is blocked entirely', async () => {
    const writeText = vi.fn(async () => { throw new Error('denied') })
    stubClipboard({ writeText })

    await expect(copyEmailDraft(makeDraft())).resolves.toBe(false)
  })
})