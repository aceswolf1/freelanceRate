/**
 * The client's contact name (R1 → R12/R11).
 *
 * A client can carry a contact name ("Jane Doe"). When it is set:
 *
 *  · the invoice email greets that person — `Hi Jane Doe,` — instead of the
 *    generic `Hi <client> team,`, and
 *  · the PDF prints `Attn: Jane Doe` under the bill-to block.
 *
 * The contact name is set through the real client dialog, the invoices are
 * generated from the closed seeded week, and both artefacts are read back from
 * the real API (the email JSON and the PDF bytes).
 */
import { expect, test } from '@playwright/test'
import { apiCall, currentWeek, expectEnvelope, type InvoiceDto } from '../helpers/api'
import { pdfText, squash } from '../helpers/pdf'
import { seedDatabase } from '../helpers/servers'
import { expectToast, gotoApp } from '../helpers/ui'

const ACME = 'Acme Corp'
const CONTACT_NAME = 'Jane Doe'

interface EmailDraft {
  text: string
  html: string
  mailto: string
  truncated: boolean
}

test.describe('Client contact name', () => {
  test.beforeEach(async () => {
    seedDatabase()
  })

  test('the contact name is saved through the client dialog and greets the client in the email', async ({ page, request }) => {
    // 1. Set the contact name in the UI.
    await gotoApp(page, '/clients')
    const clients = expectEnvelope(
      await apiCall<{ data: Array<{ id: number, name: string }> }>(request, 'get', '/clients'),
    )
    const acme = clients.find(client => client.name === ACME)
    expect(acme, 'the seed must contain the Acme Corp client').toBeDefined()

    await page.getByTestId(`edit-client-${acme!.id}`).click()
    await expect(page.locator('#client-contact-name')).toHaveValue('')
    await page.locator('#client-contact-name').fill(CONTACT_NAME)
    await page.locator('.p-dialog').getByRole('button', { name: 'Save changes' }).click()
    await expectToast(page, 'Client updated')

    // The name is persisted.
    const stored = expectEnvelope(
      await apiCall<{ data: Array<{ id: number, name: string, contactName: string | null }> }>(request, 'get', '/clients'),
    )
    expect(stored.find(client => client.id === acme!.id)?.contactName).toBe(CONTACT_NAME)

    // 2. Close the seeded week and generate the invoices.
    const week = await currentWeek(request)
    await apiCall(request, 'post', `/weeks/${week.id}/close`)
    const invoices = expectEnvelope(
      await apiCall<{ data: InvoiceDto[] }>(request, 'post', `/weeks/${week.id}/invoices`),
      201,
    )
    const acmeInvoice = invoices.find(invoice => invoice.clientName === ACME)!
    expect(acmeInvoice.contactName).toBe(CONTACT_NAME)

    // 3. The email greets the contact by name.
    const draft = expectEnvelope(
      await apiCall<{ data: EmailDraft }>(request, 'get', `/invoices/${acmeInvoice.id}/email`),
    )
    expect(draft.text.startsWith(`Hi ${CONTACT_NAME},`)).toBe(true)
    expect(draft.text).not.toContain(`Hi ${ACME} team,`)
    expect(draft.html).toContain(`Hi ${CONTACT_NAME},`)
    expect(decodeURIComponent(draft.mailto)).toContain(`Hi ${CONTACT_NAME},`)
  })

  test('the PDF prints the contact name as the attention line', async ({ page, request }) => {
    // Set the contact name through the dialog …
    await gotoApp(page, '/clients')
    const clients = expectEnvelope(
      await apiCall<{ data: Array<{ id: number, name: string }> }>(request, 'get', '/clients'),
    )
    const acme = clients.find(client => client.name === ACME)!
    await page.getByTestId(`edit-client-${acme.id}`).click()
    await page.locator('#client-contact-name').fill(CONTACT_NAME)
    await page.locator('.p-dialog').getByRole('button', { name: 'Save changes' }).click()
    await expectToast(page, 'Client updated')

    // … close the week and generate the invoices.
    const week = await currentWeek(request)
    await apiCall(request, 'post', `/weeks/${week.id}/close`)
    const invoices = expectEnvelope(
      await apiCall<{ data: InvoiceDto[] }>(request, 'post', `/weeks/${week.id}/invoices`),
      201,
    )
    const acmeInvoice = invoices.find(invoice => invoice.clientName === ACME)!

    // Read the real PDF bytes.
    const response = await request.get(`/api/invoices/${acmeInvoice.id}/pdf`)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/pdf')
    const bytes = Buffer.from(await response.body())
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('%PDF')

    // The text is inside the compressed content stream — inflate it.
    const text = pdfText(bytes)
    // Sanity: the extractor really found the document text.
    expect(squash(text)).toContain(squash('BILL TO'))
    expect(squash(text)).toContain(squash(ACME))
    expect(squash(text)).toContain(squash('billing@acme.example'))

    // The attention line is there.
    expect(squash(text)).toContain(squash(`Attn: ${CONTACT_NAME}`))
  })

  test('without a contact name the greeting falls back to the client and the PDF has no attention line', async ({ request }) => {
    const week = await currentWeek(request)
    await apiCall(request, 'post', `/weeks/${week.id}/close`)
    const invoices = expectEnvelope(
      await apiCall<{ data: InvoiceDto[] }>(request, 'post', `/weeks/${week.id}/invoices`),
      201,
    )
    const acmeInvoice = invoices.find(invoice => invoice.clientName === ACME)!
    expect(acmeInvoice.contactName).toBeNull()

    const draft = expectEnvelope(
      await apiCall<{ data: EmailDraft }>(request, 'get', `/invoices/${acmeInvoice.id}/email`),
    )
    expect(draft.text.startsWith(`Hi ${ACME} team,`)).toBe(true)

    const response = await request.get(`/api/invoices/${acmeInvoice.id}/pdf`)
    const bytes = Buffer.from(await response.body())
    const text = pdfText(bytes)
    expect(squash(text)).toContain(squash('BILL TO'))
    expect(squash(text)).not.toContain(squash('Attn:'))
  })
})
