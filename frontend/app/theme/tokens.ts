/**
 * BillFlow design tokens — single source of truth for both colour schemes.
 *
 * Dark values come from `.claude/design/DESIGN.md` ("Obsidian — High-Contrast Dark"):
 * near-black zinc surfaces, soft-violet primary, emerald tertiary, red errors only,
 * border-based elevation, 8px radius.
 *
 * Light values are the derived counterpart (R14 requires a working light theme;
 * DESIGN.md is dark-only). Primary drops to violet-600 `#7c3aed` for AA contrast
 * on white, tertiary drops to emerald-600, error to red-600.
 */

/** PrimeVue colour-scale keys, in ascending lightness. */
export type ColorScaleKey =
  | 0 | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950

export type ColorScale = Record<ColorScaleKey, string>

export const violet: ColorScale = {
  0: '#ffffff',
  50: '#f5f3ff',
  100: '#ede9fe',
  200: '#ddd6fe',
  300: '#c4b5fd',
  400: '#a78bfa',
  500: '#8b5cf6',
  600: '#7c3aed',
  700: '#6d28d9',
  800: '#5b21b6',
  900: '#4c1d95',
  950: '#2e1065',
}

export const zinc: ColorScale = {
  0: '#ffffff',
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
  950: '#09090b',
}

export const emerald: ColorScale = {
  0: '#ffffff',
  50: '#ecfdf5',
  100: '#d1fae5',
  200: '#a7f3d0',
  300: '#6ee7b7',
  400: '#34d399',
  500: '#10b981',
  600: '#059669',
  700: '#047857',
  800: '#065f46',
  900: '#003318',
  950: '#022c22',
}

export const red: ColorScale = {
  0: '#ffffff',
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
  950: '#450a0a',
}

export const amber: ColorScale = {
  0: '#ffffff',
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
  950: '#451a03',
}

/** Radius scale — DESIGN.md: cards and inputs use an 8px radius. */
export const radii = {
  none: '0',
  xs: '2px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
} as const

export type ThemeMode = 'light' | 'dark'

/**
 * Semantic surface tokens, mirroring the names used by the design HTML
 * (`bg-background`, `text-on-surface`, `border-outline-variant`, …).
 * Emitted as CSS custom properties in `assets/css/main.css` and mapped into
 * Tailwind's `@theme`, so utility classes match the design markup 1:1.
 */
export interface SemanticTokens {
  'background': string
  'on-background': string
  'surface': string
  'surface-dim': string
  'surface-bright': string
  'surface-container-lowest': string
  'surface-container-low': string
  'surface-container': string
  'surface-container-high': string
  'surface-container-highest': string
  'surface-variant': string
  'on-surface': string
  'on-surface-variant': string
  'outline': string
  'outline-variant': string
  'primary': string
  'primary-container': string
  'on-primary': string
  'on-primary-container': string
  'primary-fixed': string
  'primary-fixed-dim': string
  'on-primary-fixed': string
  'on-primary-fixed-variant': string
  'inverse-primary': string
  'secondary': string
  'secondary-container': string
  'on-secondary': string
  'on-secondary-container': string
  'tertiary': string
  'tertiary-container': string
  'on-tertiary': string
  'on-tertiary-container': string
  'tertiary-fixed': string
  'tertiary-fixed-dim': string
  'on-tertiary-fixed': string
  'on-tertiary-fixed-variant': string
  'error': string
  'error-container': string
  'on-error': string
  'on-error-container': string
  'inverse-surface': string
  'inverse-on-surface': string
  'warning': string
  'warning-container': string
}

export const darkTokens: SemanticTokens = {
  'background': '#09090b',
  'on-background': '#fafafa',
  'surface': '#0c0c0f',
  'surface-dim': '#0c0c0f',
  'surface-bright': '#18181b',
  'surface-container-lowest': '#09090b',
  'surface-container-low': '#0f0f12',
  'surface-container': '#121215',
  'surface-container-high': '#18181b',
  'surface-container-highest': '#1e1e22',
  'surface-variant': '#18181b',
  'on-surface': '#fafafa',
  'on-surface-variant': '#a1a1aa',
  'outline': '#52525b',
  'outline-variant': '#27272a',
  'primary': '#a78bfa',
  'primary-container': '#7c3aed',
  'on-primary': '#0a0012',
  'on-primary-container': '#ede9fe',
  'primary-fixed': '#ede9fe',
  'primary-fixed-dim': '#c4b5fd',
  'on-primary-fixed': '#2e1065',
  'on-primary-fixed-variant': '#5b21b6',
  'inverse-primary': '#5b21b6',
  'secondary': '#71717a',
  'secondary-container': '#27272a',
  'on-secondary': '#09090b',
  'on-secondary-container': '#a1a1aa',
  'tertiary': '#34d399',
  'tertiary-container': '#065f46',
  'on-tertiary': '#001a12',
  'on-tertiary-container': '#bbf7d0',
  'tertiary-fixed': '#bbf7d0',
  'tertiary-fixed-dim': '#6ee7b7',
  'on-tertiary-fixed': '#003318',
  'on-tertiary-fixed-variant': '#047857',
  'error': '#ef4444',
  'error-container': '#3b1111',
  'on-error': '#1a0000',
  'on-error-container': '#fca5a5',
  'inverse-surface': '#fafafa',
  'inverse-on-surface': '#09090b',
  'warning': '#fbbf24',
  'warning-container': '#422006',
}

export const lightTokens: SemanticTokens = {
  'background': '#fafafa',
  'on-background': '#18181b',
  'surface': '#ffffff',
  'surface-dim': '#f4f4f5',
  'surface-bright': '#ffffff',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#fafafa',
  'surface-container': '#f4f4f5',
  'surface-container-high': '#e4e4e7',
  'surface-container-highest': '#d4d4d8',
  'surface-variant': '#e4e4e7',
  'on-surface': '#18181b',
  'on-surface-variant': '#52525b',
  'outline': '#a1a1aa',
  'outline-variant': '#e4e4e7',
  'primary': '#7c3aed',
  'primary-container': '#ede9fe',
  'on-primary': '#ffffff',
  'on-primary-container': '#4c1d95',
  'primary-fixed': '#4c1d95',
  'primary-fixed-dim': '#5b21b6',
  'on-primary-fixed': '#ede9fe',
  'on-primary-fixed-variant': '#c4b5fd',
  'inverse-primary': '#a78bfa',
  'secondary': '#52525b',
  'secondary-container': '#e4e4e7',
  'on-secondary': '#ffffff',
  'on-secondary-container': '#3f3f46',
  'tertiary': '#059669',
  'tertiary-container': '#d1fae5',
  'on-tertiary': '#ffffff',
  'on-tertiary-container': '#065f46',
  'tertiary-fixed': '#065f46',
  'tertiary-fixed-dim': '#047857',
  'on-tertiary-fixed': '#d1fae5',
  'on-tertiary-fixed-variant': '#6ee7b7',
  'error': '#dc2626',
  'error-container': '#fee2e2',
  'on-error': '#ffffff',
  'on-error-container': '#991b1b',
  'inverse-surface': '#27272a',
  'inverse-on-surface': '#fafafa',
  'warning': '#b45309',
  'warning-container': '#fef3c7',
}

export const semanticTokens: Record<ThemeMode, SemanticTokens> = {
  light: lightTokens,
  dark: darkTokens,
}