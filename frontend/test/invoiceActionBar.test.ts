// @vitest-environment nuxt
/**
 * Behaviour tests for `app/components/invoices/InvoiceActionBar.vue` (R11).
 *
 * Scenarios covered:
 * - the week status chip reads Open / Closed / "—" when no week is loaded;
 * - the count badge is honest: preview buckets are not called invoices yet;
 * - "Generate Invoices" is disabled while the week is open, while a request is
 *   in flight, and when the week holds no records — and the tooltip says why;
 * - the button emits `generate` when it is pressed, and the zip button emits
 *   `download-zip` once invoices exist.
 */
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import InvoiceActionBar from '~/components/invoices/InvoiceActionBar.vue'

const baseProps = {
  weekLabel: 'Week 43: 19-10-2026 – 25-10-2026',
  status: 'closed' as 'open' | 'closed' | null,
  invoiceCount: 2,
  hasInvoices: true,
  canGenerate: true,
  generating: false,
  pending: false,
  recordCount: 12,
}

describe('InvoiceActionBar', () => {
  it('shows the week status', async () => {
    const open = await mountSuspended(InvoiceActionBar, {
      props: { ...baseProps, status: 'open' },
    })
    expect(open.find('[data-testid="invoice-week-status"]').text()).toContain('Open')

    const closed = await mountSuspended(InvoiceActionBar, { props: baseProps })
    expect(closed.find('[data-testid="invoice-week-status"]').text()).toContain('Closed')
  })

  it('shows a dash when no week is loaded', async () => {
    const wrapper = await mountSuspended(InvoiceActionBar, {
      props: { ...baseProps, status: null },
    })

    expect(wrapper.find('[data-testid="invoice-week-status"]').text()).toContain('—')
  })

  it('calls the buckets invoices only once they are invoices', async () => {
    const withInvoices = await mountSuspended(InvoiceActionBar, { props: baseProps })
    expect(withInvoices.find('[data-testid="invoice-count-badge"]').text()).toContain('2 Invoices')

    const previews = await mountSuspended(InvoiceActionBar, {
      props: { ...baseProps, hasInvoices: false, invoiceCount: 3 },
    })
    expect(previews.find('[data-testid="invoice-count-badge"]').text()).toContain('3 Preview Buckets')
  })

  it('uses the singular form for a single bucket', async () => {
    const wrapper = await mountSuspended(InvoiceActionBar, {
      props: { ...baseProps, hasInvoices: false, invoiceCount: 1 },
    })

    expect(wrapper.find('[data-testid="invoice-count-badge"]').text()).toContain('1 Preview Bucket')
  })

  it('blocks generation while the week is still open and says why', async () => {
    const wrapper = await mountSuspended(InvoiceActionBar, {
      props: { ...baseProps, status: 'open', canGenerate: false, hasInvoices: false },
    })

    const button = wrapper.find('[data-testid="generate-invoices"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('title')).toBe('Close the week to generate invoices')
  })

  it('explains that the week holds no records', async () => {
    const wrapper = await mountSuspended(InvoiceActionBar, {
      props: { ...baseProps, recordCount: 0, hasInvoices: false },
    })

    expect(wrapper.find('[data-testid="generate-invoices"]').attributes('title'))
      .toBe('This week has no records to invoice')
    expect(wrapper.find('[data-testid="no-records-note"]').text()).toContain('No records logged')
  })

  it('explains that no week is loaded', async () => {
    const wrapper = await mountSuspended(InvoiceActionBar, {
      props: { ...baseProps, status: null },
    })

    expect(wrapper.find('[data-testid="generate-invoices"]').attributes('title')).toBe('No week loaded')
  })

  it('blocks generation while a request is in flight', async () => {
    const wrapper = await mountSuspended(InvoiceActionBar, {
      props: { ...baseProps, pending: true },
    })

    expect(wrapper.find('[data-testid="generate-invoices"]').attributes('disabled')).toBeDefined()
  })

  it('enables generation for a closed week that has records', async () => {
    const wrapper = await mountSuspended(InvoiceActionBar, {
      props: { ...baseProps, hasInvoices: false },
    })

    const button = wrapper.find('[data-testid="generate-invoices"]')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.attributes('title')).toContain('Generate invoices for Week 43')
  })

  it('offers a regeneration that keeps the same invoice numbers', async () => {
    const wrapper = await mountSuspended(InvoiceActionBar, { props: baseProps })

    const button = wrapper.find('[data-testid="generate-invoices"]')
    expect(button.text()).toContain('Regenerate Invoices')
    expect(button.attributes('title')).toContain('Regenerating returns the same numbers')
  })

  it('says it is working while the invoices are being generated', async () => {
    const wrapper = await mountSuspended(InvoiceActionBar, {
      props: { ...baseProps, generating: true },
    })

    expect(wrapper.find('[data-testid="generate-invoices"]').text()).toContain('Generating…')
  })

  it('emits generate when the button is pressed', async () => {
    const wrapper = await mountSuspended(InvoiceActionBar, { props: baseProps })

    await wrapper.find('[data-testid="generate-invoices"]').trigger('click')

    expect(wrapper.emitted('generate')).toHaveLength(1)
  })

  it('emits download-zip once the invoices exist', async () => {
    const wrapper = await mountSuspended(InvoiceActionBar, { props: baseProps })

    await wrapper.find('[data-testid="download-zip"]').trigger('click')

    expect(wrapper.emitted('download-zip')).toHaveLength(1)
  })

  it('keeps the zip download unavailable until invoices exist', async () => {
    const wrapper = await mountSuspended(InvoiceActionBar, {
      props: { ...baseProps, hasInvoices: false },
    })

    const button = wrapper.find('[data-testid="download-zip"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('title')).toBe('Generate invoices first')
  })
})
