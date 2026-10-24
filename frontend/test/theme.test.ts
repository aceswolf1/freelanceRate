import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DARK_CLASS,
  THEME_STORAGE_KEY,
  applyThemeToElement,
  isDarkMode,
  isThemeMode,
  persistTheme,
  readStoredTheme,
  resolveThemeMode,
} from '~/utils/theme'

function fakeClassList(): { classList: DOMTokenList } {
  const classes = new Set<string>()
  return {
    classList: {
      add: (token: string) => void classes.add(token),
      remove: (token: string) => void classes.delete(token),
      contains: (token: string) => classes.has(token),
    } as unknown as DOMTokenList,
  }
}

describe('resolveThemeMode', () => {
  it('treats dark as the default (R14)', () => {
    expect(resolveThemeMode(null)).toBe('dark')
    expect(resolveThemeMode(undefined)).toBe('dark')
    expect(resolveThemeMode('nonsense')).toBe('dark')
    expect(resolveThemeMode('dark')).toBe('dark')
  })

  it('honours an explicit light choice', () => {
    expect(resolveThemeMode('light')).toBe('light')
  })
})

describe('isThemeMode / isDarkMode', () => {
  it('narrows stored values', () => {
    expect(isThemeMode('light')).toBe(true)
    expect(isThemeMode('dark')).toBe(true)
    expect(isThemeMode('blue')).toBe(false)
  })

  it('reports darkness', () => {
    expect(isDarkMode('dark')).toBe(true)
    expect(isDarkMode('light')).toBe(false)
  })
})

describe('applyThemeToElement', () => {
  it('adds the dark class for dark mode', () => {
    const element = fakeClassList()
    applyThemeToElement(element, 'dark')
    expect(element.classList.contains(DARK_CLASS)).toBe(true)
  })

  it('removes the dark class for light mode', () => {
    const element = fakeClassList()
    applyThemeToElement(element, 'dark')
    applyThemeToElement(element, 'light')
    expect(element.classList.contains(DARK_CLASS)).toBe(false)
  })
})

describe('storage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('reads and writes the documented key', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    }

    persistTheme(storage, 'light')
    expect(store.get(THEME_STORAGE_KEY)).toBe('light')
    expect(readStoredTheme(storage)).toBe('light')
  })

  it('never throws when storage is unavailable (private mode)', () => {
    const hostile = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
    }

    expect(readStoredTheme(hostile)).toBeNull()
    expect(() => persistTheme(hostile, 'light')).not.toThrow()
  })

  it('tolerates a null storage object', () => {
    expect(readStoredTheme(null)).toBeNull()
    expect(() => persistTheme(undefined, 'dark')).not.toThrow()
  })
})