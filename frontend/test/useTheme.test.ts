// @vitest-environment nuxt
import { describe, expect, it, beforeEach } from 'vitest'

import { DARK_CLASS, THEME_STORAGE_KEY } from '~/utils/theme'

/**
 * Interaction test for the theme composable: the contract that matters is the
 * DOM class + localStorage pair, because PrimeVue's `darkModeSelector` and
 * Tailwind's `dark:` variant both key off `.app-dark`.
 */
describe('useTheme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove(DARK_CLASS)
    window.localStorage.clear()
  })

  it('starts dark by default (R14)', async () => {
    const { useTheme } = await import('~/composables/useTheme')
    const { mode, isDark } = useTheme()

    expect(mode.value).toBe('dark')
    expect(isDark.value).toBe(true)
  })

  it('toggles the DOM class and persists the choice', async () => {
    const { useTheme } = await import('~/composables/useTheme')
    const { mode, toggle } = useTheme()

    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false)

    toggle()

    expect(mode.value).toBe('light')
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

    toggle()

    expect(mode.value).toBe('dark')
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('adopts whatever the pre-paint script already applied', async () => {
    // Simulate the head script having set light mode before hydration.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')

    const { useTheme } = await import('~/composables/useTheme')
    const { mode, syncFromDom } = useTheme()

    expect(syncFromDom()).toBe('light')
    expect(mode.value).toBe('light')
  })
})