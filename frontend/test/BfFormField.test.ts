// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtState } from '#app'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ClientDialog from '~/components/clients/ClientDialog.vue'

vi.mock('#build/fetch', () => ({ $fetch: vi.fn() }))

/**
 * GAP-002 regression.
 *
 * PrimeVue's auto-imported `FormField` (from `@primevue/forms`) shadowed the
 * app's own `FormField.vue`, so every form rendered as an unlabelled
 * `<div class="p-formfield">` — no `<label for>`, no `role="alert"` error, and
 * (in the client dialog) a silent no-op on submit.
 *
 * These tests mount the **real ClientDialog**, not the wrapper in isolation, so
 * a future shadowing regression is caught where it actually bites.
 *
 * PrimeVue's `Dialog` teleports its content to `document.body`, so the
 * assertions query the document rather than the wrapper.
 */
function q<T extends Element = HTMLElement>(selector: string): T | null {
  return document.body.querySelector<T>(selector)
}

function qAll(selector: string): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>(selector))
}

describe('GAP-002 — forms render labels and inline errors', () => {
  beforeEach(() => {
    clearNuxtState()
    document.body.innerHTML = ''
  })

  it('renders a <label for> bound to the control id', async () => {
    const wrapper = await mountSuspended(ClientDialog, {
      props: { visible: true, client: null },
    })
    await nextTick()

    const label = q<HTMLLabelElement>('label[for="client-name"]')
    expect(label).not.toBeNull()
    expect(label?.textContent).toContain('Client Name')

    // The control the label points at must actually exist.
    expect(q('#client-name')).not.toBeNull()

    wrapper.unmount()
  })

  it('does not render PrimeVue\'s formfield markup', async () => {
    const wrapper = await mountSuspended(ClientDialog, {
      props: { visible: true, client: null },
    })
    await nextTick()

    expect(q('.p-formfield')).toBeNull()

    wrapper.unmount()
  })

  it('renders every field with a label, not just the first', async () => {
    const wrapper = await mountSuspended(ClientDialog, {
      props: { visible: true, client: null },
    })
    await nextTick()

    for (const id of ['client-name', 'client-email', 'client-cc', 'client-rate', 'client-platform', 'client-notes']) {
      expect(q(`label[for="${id}"]`), `missing label for ${id}`).not.toBeNull()
    }

    wrapper.unmount()
  })

  it('shows a role="alert" message after a failed validation', async () => {
    const wrapper = await mountSuspended(ClientDialog, {
      props: { visible: true, client: null },
    })
    await nextTick()

    // Submit with an empty form: the dialog validates locally and must not
    // reach the API.
    const form = q<HTMLFormElement>('form')
    expect(form).not.toBeNull()
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await nextTick()

    const alerts = qAll('[role="alert"]')
    expect(alerts.length).toBeGreaterThan(0)

    // The alert text names the offending field.
    const texts = alerts.map(alert => alert.textContent).join(' | ')
    expect(texts).toContain('Client name is required')

    wrapper.unmount()
  })

  it('reports an invalid email format on the email field', async () => {
    const wrapper = await mountSuspended(ClientDialog, {
      props: { visible: true, client: null },
    })
    await nextTick()

    const name = q<HTMLInputElement>('#client-name')
    const email = q<HTMLInputElement>('#client-email')
    expect(name).not.toBeNull()
    expect(email).not.toBeNull()

    name!.value = 'Acme Corp'
    name!.dispatchEvent(new Event('input', { bubbles: true }))
    email!.value = 'not-an-email'
    email!.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    q<HTMLFormElement>('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await nextTick()

    const texts = qAll('[role="alert"]').map(alert => alert.textContent).join(' | ')
    expect(texts).toContain('valid email')

    wrapper.unmount()
  })

  it('links the error to the control via aria-describedby', async () => {
    const wrapper = await mountSuspended(ClientDialog, {
      props: { visible: true, client: null },
    })
    await nextTick()

    q<HTMLFormElement>('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await nextTick()

    expect(q('#client-name-error')).not.toBeNull()
    expect(q('#client-name')?.getAttribute('aria-describedby')).toContain('client-name-error')

    wrapper.unmount()
  })
})
