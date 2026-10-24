// @vitest-environment nuxt
import { clearNuxtState } from '#app'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'

import ThemeToggle from '~/components/layout/ThemeToggle.vue'
import { DARK_CLASS, THEME_STORAGE_KEY } from '~/utils/theme'

/**
 * Interaction test for the header theme toggle.
 * Contract: clicking flips `.app-dark` on <html> and writes localStorage (R14),
 * and the button's accessible label/pressed state track the current mode.
 */
describe('ThemeToggle', () => {
  beforeEach(() => {
    // `useTheme` reads a Nuxt `useState` singleton, so it has to be reset
    // alongside the DOM and storage or the next test inherits the last mode.
    clearNuxtState()
    document.documentElement.classList.remove(DARK_CLASS)
    window.localStorage.clear()
  })

  it('renders an accessible button reflecting the current mode', async () => {
    const wrapper = await mountSuspended(ThemeToggle)

    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Switch to light theme')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.pi-sun').exists()).toBe(true)
  })

  it('toggles to light mode on click and persists the choice', async () => {
    const wrapper = await mountSuspended(ThemeToggle)

    await wrapper.get('button').trigger('click')

    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Switch to dark theme')
    expect(button.attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('.pi-moon').exists()).toBe(true)
  })

  it('toggles back to dark mode on a second click', async () => {
    const wrapper = await mountSuspended(ThemeToggle)

    await wrapper.get('button').trigger('click')
    await wrapper.get('button').trigger('click')

    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})