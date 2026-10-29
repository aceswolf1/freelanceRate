/**
 * The clipboard fallback (R12) — "Copy formatted" must work even when the
 * async Clipboard API is missing.
 *
 * That is the plain-HTTP case (a LAN deployment such as
 * `http://192.168.18.10:3010`): there `navigator.clipboard` is `undefined`, so
 * the app has to fall back to `document.execCommand('copy')`, which writes the
 * HTML table through a `copy` event handler.
 *
 * The spec removes `navigator.clipboard` before the page loads and proves:
 *  1. the click still reports success ("Invoice copied" toast),
 *  2. the fallback really put the formatted HTML table on the clipboard, and
 *  3. pasting it into a rich-text field yields a real `<table>`.
 */
import { expect, test, type Page } from '@playwright/test'
import { apiCall, currentWeek, expectEnvelope, type InvoiceDto } from '../helpers/api'
import { seedDatabase } from '../helpers/servers'
import { expectToast, gotoApp } from '../helpers/ui'

const ACME = 'Acme Corp'

interface CopiedPayload {
  html: string | null
  text: string | null
}

/** Closes the seeded week and generates the invoices; returns them. */
async function generateInvoices(request: Parameters<typeof apiCall>[0]): Promise<InvoiceDto[]> {
  const week = await currentWeek(request)
  await apiCall(request, 'post', `/weeks/${week.id}/close`)
  const result = await apiCall<{ data: InvoiceDto[] }>(request, 'post', `/weeks/${week.id}/invoices`)
  return expectEnvelope(result, 201)
}

/**
 * Records what the legacy `copy` handler writes to the clipboard.
 *
 * The listener sits on `window`, so it runs **after** the app's own
 * `document` listener has filled `clipboardData`.
 */
async function watchClipboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as unknown as { __copied?: { html: string | null, text: string | null } }
    target.__copied = { html: null, text: null }
    window.addEventListener('copy', (event) => {
      const data = (event as ClipboardEvent).clipboardData
      target.__copied = {
        html: data?.getData('text/html') ?? null,
        text: data?.getData('text/plain') ?? null,
      }
    })
  })
}

async function copiedPayload(page: Page): Promise<CopiedPayload> {
  return page.evaluate(() => (window as unknown as { __copied: CopiedPayload }).__copied)
}

/** Injects a rich-text field the pasted content can be dropped into. */
async function addPasteTarget(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = document.createElement('div')
    target.id = 'clipboard-paste-target'
    target.contentEditable = 'true'
    target.style.cssText = 'position:fixed;top:20px;left:20px;width:640px;height:320px;'
      + 'z-index:99999;background:#ffffff;color:#000000;border:1px solid #cccccc;'
    document.body.appendChild(target)
  })
}

test.describe('Clipboard fallback', () => {
  test.beforeEach(async () => {
    seedDatabase()
  })

  test('"Copy formatted" succeeds without the async Clipboard API', async ({ page, request }) => {
    const invoices = await generateInvoices(request)
    const acme = invoices.find(invoice => invoice.clientName === ACME)!

    // The async Clipboard API is gone — this is the plain-HTTP case.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    })

    await gotoApp(page, `/invoices?weekId=${acme.weekId}`)
    expect(await page.evaluate(() => navigator.clipboard)).toBeUndefined()

    await watchClipboard(page)
    await page.getByTestId(`copy-formatted-${ACME}`).click()

    // The app reports success — the fallback path returned true.
    await expectToast(page, 'Invoice copied')

    const copied = await copiedPayload(page)
    expect(copied.html, 'the fallback must write the formatted HTML').toContain('<table')
    expect(copied.html).toContain('E-Commerce Storefront')
    expect(copied.text).toContain('Acme Corp')
    expect(copied.text).toContain('Net due')
  })

  test('the fallback content pastes into a rich-text field as a table', async ({ page, request }) => {
    const invoices = await generateInvoices(request)
    const acme = invoices.find(invoice => invoice.clientName === ACME)!

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    })

    await gotoApp(page, `/invoices?weekId=${acme.weekId}`)
    await watchClipboard(page)
    await page.getByTestId(`copy-formatted-${ACME}`).click()
    await expectToast(page, 'Invoice copied')

    // Paste into a contenteditable — the same thing a user does in a mail
    // client. `ControlOrMeta` is Meta on macOS and Control everywhere else.
    await addPasteTarget(page)
    await page.locator('#clipboard-paste-target').click()
    await page.keyboard.press('ControlOrMeta+V')

    const pasted = await page.locator('#clipboard-paste-target').innerHTML()
    expect(pasted, 'the pasted content must be the formatted invoice table').toContain('<table')
    expect(pasted).toContain('E-Commerce Storefront')
  })
})
