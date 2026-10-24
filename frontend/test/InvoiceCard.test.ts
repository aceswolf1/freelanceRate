// @vitest-environment nuxt
import { clearNuxtState } from '#app'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import InvoiceCard from '~/components/invoices/InvoiceCard.vue'
import type { Invoice, InvoiceEmailDraft } from '~/types/api'
import { formatLineDate, fromInvoice, fromPreviewRow } from '~/composables/useInvoices'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

/** Contract §4.1 worked examples — Acme Corp and Starlight Media, one "No client". */
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
    lines: [{
      id: 1,
      recordId: 1,
      date: '2026-10-19',
      projectId: 1,
      projectName: 'E-Commerce Storefront',
      description: 'Checkout flow rebuild',
      hours: 15.5,
      rate: 130,
      lineTotal: 2015,
    }],
    subtotals: [{ projectId: 1, projectName: 'E-Commerce Storefront', hours: 15.5, gross: 2015 }],
    ...overrides,
  }
}

const mailto = 'mailto:billing@acme.example?cc=finance%40acme.example&subject=Invoice%20INV-2026-001&body=Hello'

function makeDraft(overrides: Partial<InvoiceEmailDraft> = {}): InvoiceEmailDraft {
  return {
    to: 'billing@acme.example',
    cc: 'finance@acme.example',
    subject: 'Invoice INV-2026-001',
    text: 'plain body',
    html: '<table><tr><td>rich</td></tr></table>',
    mailto,
    truncated: false,
    ...overrides,
  }
}

function stubClipboard() {
  const clipboard = { write: vi.fn(async () => {}), writeText: vi.fn(async () => {}) }
  Object.defineProperty(globalThis.navigator, 'clipboard', { value: clipboard, configurable: true })
  return clipboard
}

describe('InvoiceCard', () => {
  beforeEach(() => {
    clearNuxtState()
    vi.unstubAllGlobals()
  })

  it('renders the money split from the invoice snapshot', async () => {
    const wrapper = await mountSuspended(InvoiceCard, {
      props: { card: fromInvoice(makeInvoice(), '$'), draft: makeDraft(), clients: [] },
    })

    expect(wrapper.get('[data-testid="invoice-client-Acme Corp"]').text()).toBe('Acme Corp')
    expect(wrapper.get('[data-testid="invoice-gross-Acme Corp"]').text()).toBe('$2275.00')
    expect(wrapper.get('[data-testid="invoice-fee-Acme Corp"]').text()).toBe('−$22.75')
    expect(wrapper.get('[data-testid="invoice-net-Acme Corp"]').text()).toBe('$2252.25')
  })

  it('shows the platform and fee, the number and both emails', async () => {
    const wrapper = await mountSuspended(InvoiceCard, {
      props: { card: fromInvoice(makeInvoice(), '$'), draft: makeDraft(), clients: [] },
    })

    expect(wrapper.text()).toContain('Payoneer (1%, absorbed)')
    expect(wrapper.get('[data-testid="invoice-number-Acme Corp"]').text()).toBe('INV-2026-001')
    expect(wrapper.text()).toContain('billing@acme.example')
    expect(wrapper.text()).toContain('cc: finance@acme.example')
  })

  it('renders the mailto href straight from the draft (§4.7)', async () => {
    const wrapper = await mountSuspended(InvoiceCard, {
      props: { card: fromInvoice(makeInvoice(), '$'), draft: makeDraft(), clients: [] },
    })

    const link = wrapper.get('[data-testid="mailto-Acme Corp"]')
    expect(link.attributes('href')).toBe(mailto)
    expect(link.text()).toContain('Send as Email Text')
  })

  it('offers a Download PDF button once the invoice exists', async () => {
    const wrapper = await mountSuspended(InvoiceCard, {
      props: { card: fromInvoice(makeInvoice(), '$'), draft: makeDraft(), clients: [] },
    })

    const button = wrapper.get('[data-testid="download-pdf-Acme Corp"]')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('copies the formatted HTML to the clipboard (R12)', async () => {
    const clipboard = stubClipboard()
    vi.stubGlobal('ClipboardItem', class {
      constructor(public items: Record<string, Blob>) {}
    })
    const draft = makeDraft()

    const wrapper = await mountSuspended(InvoiceCard, {
      props: { card: fromInvoice(makeInvoice(), '$'), draft, clients: [] },
    })

    await wrapper.get('[data-testid="copy-formatted-Acme Corp"]').trigger('click')
    await vi.waitFor(() => expect(clipboard.write).toHaveBeenCalledOnce())

    const payload = clipboard.write.mock.calls[0]![0] as Array<{ items: Record<string, Blob> }>
    expect(Object.keys(payload[0]!.items)).toEqual(['text/html', 'text/plain'])
  })

  it('falls back to plain text when the rich clipboard is unavailable', async () => {
    // A browser without `clipboard.write` (or with it stripped by permissions).
    const writeText = vi.fn(async () => {})
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    const wrapper = await mountSuspended(InvoiceCard, {
      props: { card: fromInvoice(makeInvoice(), '$'), draft: makeDraft(), clients: [] },
    })

    await wrapper.get('[data-testid="copy-formatted-Acme Corp"]').trigger('click')
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('plain body'))
  })

  it('hides the mailto link and explains why when the body was truncated', async () => {
    const wrapper = await mountSuspended(InvoiceCard, {
      props: {
        card: fromInvoice(makeInvoice(), '$'),
        draft: makeDraft({ truncated: true }),
        clients: [],
      },
    })

    expect(wrapper.find('[data-testid="mailto-Acme Corp"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="truncated-hint"]').text())
      .toContain('Email body shortened — use Copy formatted for full tables')
    // Copy must still be offered — that is the documented fallback.
    expect(wrapper.find('[data-testid="copy-formatted-Acme Corp"]').exists()).toBe(true)
  })

  it('offers no PDF, email or number for a not-yet-generated preview row', async () => {
    const preview = fromPreviewRow({
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

    const wrapper = await mountSuspended(InvoiceCard, {
      props: { card: preview, draft: null, clients: [] },
    })

    expect(wrapper.get('[data-testid="download-pdf-No client"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="mailto-No client"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Preview — not generated')
    // §8.1: the standalone bucket has no client, therefore no platform and no fee.
    expect(wrapper.text()).toContain('No payment platform — no fee absorbed')
  })

  it('renders the rate logic strip and the itemised line table', async () => {
    const clients = [{ id: 1, name: 'Acme Corp', contactEmail: 'billing@acme.example', ccEmail: null, billingHour: 130 }]

    const wrapper = await mountSuspended(InvoiceCard, {
      props: { card: fromInvoice(makeInvoice(), '$'), draft: makeDraft(), clients },
    })

    expect(wrapper.get('[data-testid="rate-logic-strip"]').text()).toContain('Client default rate ($130.00/hr)')
    expect(wrapper.get('[data-testid="invoice-lines"]').text()).toContain('E-Commerce Storefront')
    expect(wrapper.get('[data-testid="invoice-lines"]').text()).toContain('Checkout flow rebuild')
    expect(wrapper.get('[data-testid="invoice-lines"]').text()).toContain('$2015.00')
  })

  it('prints the line date once, as "Mon, Oct 19" (GAP-008)', async () => {
    const wrapper = await mountSuspended(InvoiceCard, {
      props: { card: fromInvoice(makeInvoice(), '$'), draft: makeDraft(), clients: [] },
    })

    const dateCell = wrapper.get('[data-testid="invoice-lines"] tbody tr td').text()
    expect(dateCell).toBe('Mon, Oct 19')
    // The weekday must not be repeated.
    expect(dateCell).not.toContain('Mon, Mon')
  })
})

describe('formatLineDate', () => {
  it('renders the design/PDF format `Mon, Oct 19`', () => {
    expect(formatLineDate('2026-10-19')).toBe('Mon, Oct 19')
  })

  it('handles every month label', () => {
    expect(formatLineDate('2026-01-05')).toBe('Mon, Jan 5')
    expect(formatLineDate('2026-12-31')).toBe('Thu, Dec 31')
  })

  it('handles a Sunday', () => {
    expect(formatLineDate('2026-10-25')).toBe('Sun, Oct 25')
  })

  it('returns an em dash for an unparseable date rather than throwing', () => {
    expect(formatLineDate('not-a-date')).toBe('—')
    expect(formatLineDate(null)).toBe('—')
  })
})

describe('InvoiceCard — one card per client bucket (R9)', () => {
  beforeEach(() => {
    clearNuxtState()
    vi.unstubAllGlobals()
  })

  /**
   * R9's worked example: projects A + B belong to client A, project C to client B.
   * Render a list of cards through a render-function harness so no template
   * compiler is needed.
   */
  function cardListHarness(cards: Array<ReturnType<typeof fromInvoice>>) {
    return defineComponent({
      setup() {
        return () => cards.map((card, index) => h(InvoiceCard, {
          key: card.key,
          card,
          draft: card.invoiceId === null ? null : makeDraft(),
          clients: [],
          index,
        }))
      },
    })
  }

  it('renders exactly two cards, two PDF buttons and two email links', async () => {
    const cards = [
      // Client A has two projects (A and B) — one invoice.
      fromInvoice(makeInvoice(), '$'),
      // Client B has one project (C) — one invoice.
      fromInvoice(makeInvoice({
        id: 2,
        number: 'INV-2026-002',
        clientId: 2,
        clientName: 'Starlight Media',
        contactEmail: 'accounts@starlight.example',
        ccEmail: null,
        platformCompany: 'Payoneer',
        totalHours: 14.5,
        gross: 1667.5,
        feeAmount: 16.68,
        net: 1650.82,
      }), '$'),
    ]

    const wrapper = await mountSuspended(cardListHarness(cards))

    expect(wrapper.findAll('[data-testid="invoice-cards"] article, article')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="download-pdf-Acme Corp"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="download-pdf-Starlight Media"]')).toHaveLength(1)
    expect(wrapper.findAll('a[data-testid^="mailto-"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('INV-2026-001')
    expect(wrapper.text()).toContain('INV-2026-002')
  })

  it('keeps the standalone bucket as its own card', async () => {
    const standalone = fromPreviewRow({
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

    const wrapper = await mountSuspended(cardListHarness([
      fromInvoice(makeInvoice(), '$'),
      fromInvoice(makeInvoice({
        id: 2,
        number: 'INV-2026-002',
        clientId: 2,
        clientName: 'Starlight Media',
        contactEmail: 'accounts@starlight.example',
        ccEmail: null,
        totalHours: 14.5,
        gross: 1667.5,
        feeAmount: 16.68,
        net: 1650.82,
      }), '$'),
      standalone,
    ] as never))

    expect(wrapper.findAll('article')).toHaveLength(3)
    expect(wrapper.text()).toContain('No client')
    // Only the two real invoices expose a mailto.
    expect(wrapper.findAll('a[data-testid^="mailto-"]')).toHaveLength(2)
  })
})