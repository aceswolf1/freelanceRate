/**
 * Small UI helpers shared by the specs.
 *
 * Only **existing** test ids (`data-testid="…"`) are used — the suite never adds
 * attributes to product components. Where a component has no test id, the helper
 * falls back to the form-field id (`<FormField field-id="client-name">` renders
 * `<input id="client-name">`).
 */
import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Navigate and wait until the app is **interactive**.
 *
 * The SSR HTML is painted before Nuxt hydrates, so a click issued in that window
 * hits markup that has no event handler yet and is silently swallowed. Waiting
 * for `useNuxtApp().isHydrating` to flip to false removes that race.
 */
export async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#__nuxt')).toBeVisible()
  await page.waitForFunction(
    () => {
      const nuxt = (window as unknown as { useNuxtApp?: () => { isHydrating?: boolean } }).useNuxtApp?.()
      return Boolean(nuxt) && nuxt!.isHydrating === false
    },
    undefined,
    { timeout: 30_000 },
  )
}

/**
 * Pick an option in a PrimeVue 4 `<Select>`.
 * The root element carries the test id; the overlay renders `ul[role=listbox]`
 * with `li[role=option]` entries.
 */
export async function selectOption(page: Page, selectTestId: string, optionName: RegExp | string): Promise<void> {
  await page.getByTestId(selectTestId).click()
  const listbox = visibleListbox(page)
  await expect(listbox).toBeVisible()
  await listbox.getByRole('option').filter({ hasText: optionName }).first().click()
}

/** The currently open PrimeVue overlay listbox. */
export function visibleListbox(page: Page): Locator {
  return page.locator('[role="listbox"]:visible').last()
}

/** The option labels of the currently open PrimeVue overlay listbox. */
export async function visibleOptionTexts(page: Page): Promise<string[]> {
  return visibleListbox(page).getByRole('option').allInnerTexts()
}

/**
 * The control of a form field.
 *
 * The app's `FormField` renders `<label for="…">` plus the control, and passes
 * the field id down to the control: `<InputText :id>` puts the id on the input
 * itself, `<InputNumber :id>` puts it on the component root (so the input is
 * one level down).
 */
export function fieldInput(page: Page, fieldId: string): Locator {
  return page.locator(`#${fieldId}`).first()
}

/** The inner `<input>` of a PrimeVue `<InputNumber>` / `<Select>`. */
export function numberInput(page: Page, fieldId: string): Locator {
  return page.locator(`#${fieldId} input`).first()
}

export function fieldTextarea(page: Page, fieldId: string): Locator {
  return page.locator(`#${fieldId}`).first()
}

/** Fill a text-ish input by its form-field id. */
export async function fillField(page: Page, fieldId: string, value: string): Promise<void> {
  await fieldInput(page, fieldId).fill(value)
}

/**
 * Fill a PrimeVue `<InputNumber>`.
 *
 * PrimeVue's InputNumber only commits the model from `keydown`/`keypress`, so
 * Playwright's `fill()` (a bare `input` event) is ignored — the value has to be
 * typed.
 */
export async function fillNumber(page: Page, fieldId: string, value: string): Promise<void> {
  const input = numberInput(page, fieldId)
  await input.click()
  await input.press('ControlOrMeta+a')
  await input.press('Delete')
  await input.pressSequentially(value, { delay: 30 })
  await input.blur()
}

/** Assert a global toast (PrimeVue `Toast` → `Message` with `role="alert"`). */
export async function expectToast(page: Page, text: string | RegExp): Promise<Locator> {
  const toast = page.locator('.p-toast-message').filter({ hasText: text }).first()
  await expect(toast).toBeVisible()
  return toast
}

/** Assert the inline (non-toast) validation error of a form field. */
export async function expectFieldError(page: Page, fieldId: string, text: string | RegExp): Promise<void> {
  const error = page.locator(`#${fieldId}-error`)
  await expect(error).toBeVisible()
  await expect(error).toHaveText(text)
}

/** The money string rendered by the app, e.g. `$2,275.00`. */
export function money(value: number, symbol = '$'): string {
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
