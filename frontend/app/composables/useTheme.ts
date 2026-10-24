import type { ThemeMode } from '../theme/tokens'
import {
  DARK_CLASS,
  applyThemeToElement,
  isDarkMode,
  isThemeMode,
  persistTheme,
  readStoredTheme,
  resolveThemeMode,
} from '../utils/theme'

/**
 * R14 — light/dark toggle persisted in localStorage, dark by default.
 *
 * The initial class is applied by the inline head script in `nuxt.config.ts`
 * (runs before first paint, so there is no flash). This composable owns the
 * reactive state and keeps the DOM + storage in sync from then on.
 */
export function useTheme() {
  const mode = useState<ThemeMode>('bf:theme', () => 'dark')

  function apply(mode_: ThemeMode): void {
    if (import.meta.client) {
      applyThemeToElement(document.documentElement, mode_)
    }
  }

  function setMode(next: ThemeMode): ThemeMode {
    mode.value = next
    apply(next)
    if (import.meta.client) {
      persistTheme(window.localStorage, next)
    }
    return next
  }

  function toggle(): ThemeMode {
    return setMode(isDarkMode(mode.value) ? 'light' : 'dark')
  }

  /** Adopt whatever the head script already decided on hydration. */
  function syncFromDom(): ThemeMode {
    if (!import.meta.client) {
      return mode.value
    }

    const fromClass = document.documentElement.classList.contains(DARK_CLASS) ? 'dark' : 'light'
    const stored = readStoredTheme(window.localStorage)

    // The DOM is authoritative: it is what the pre-paint script already applied.
    mode.value = fromClass
    if (isThemeMode(stored) && stored !== fromClass) {
      persistTheme(window.localStorage, fromClass)
    }
    return mode.value
  }

  return {
    mode,
    isDark: computed(() => isDarkMode(mode.value)),
    themeClass: computed(() => (isDarkMode(mode.value) ? DARK_CLASS : '')),
    setMode,
    toggle,
    syncFromDom,
  }
}