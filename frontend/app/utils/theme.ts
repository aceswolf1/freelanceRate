import type { ThemeMode } from '../theme/tokens'

export const THEME_STORAGE_KEY = 'billflow:theme'
export const DARK_CLASS = 'app-dark'

/** Storage shape we persist: `null` means "never chosen", which falls back to dark. */
export type StoredTheme = ThemeMode | null | undefined

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light'
}

/** R14: dark is the default; anything other than an explicit `light` is dark. */
export function resolveThemeMode(stored: StoredTheme): ThemeMode {
  return stored === 'light' ? 'light' : 'dark'
}

export function isDarkMode(mode: ThemeMode): boolean {
  return mode === 'dark'
}

/** The exact DOM effect of a mode. Pure enough to unit-test with a fake element. */
export function applyThemeToElement(element: { classList: DOMTokenList }, mode: ThemeMode): void {
  if (isDarkMode(mode)) {
    element.classList.add(DARK_CLASS)
  }
  else {
    element.classList.remove(DARK_CLASS)
  }
}

export function readStoredTheme(storage: Pick<Storage, 'getItem'> | null | undefined): StoredTheme {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY) ?? null
    return isThemeMode(raw) ? raw : null
  }
  catch {
    // Private-mode / disabled storage must never break the app.
    return null
  }
}

export function persistTheme(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  mode: ThemeMode,
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, mode)
  }
  catch {
    // Persistence is best-effort; the in-memory state still holds for this session.
  }
}