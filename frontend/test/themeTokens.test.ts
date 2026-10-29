/**
 * Contract tests for the design system (`app/theme/tokens.ts` + `app/theme/preset.ts`).
 *
 * These are not "does it load" checks — they assert the invariants the UI
 * depends on:
 *
 * - every colour scale exposes the same steps (a missing step renders an
 *   undefined colour),
 * - every colour is a valid hex value,
 * - the light and dark schemes define exactly the same semantic tokens (a token
 *   missing from one scheme silently inherits from the other and breaks the
 *   theme),
 * - the PrimeVue preset is built on the violet scale and defines both colour
 *   schemes.
 */
import { describe, expect, it } from 'vitest'

import preset from '~/theme/preset'
import {
  amber,
  darkTokens,
  emerald,
  lightTokens,
  radii,
  red,
  semanticTokens,
  violet,
  zinc,
  type ColorScale,
} from '~/theme/tokens'

const SCALES: Record<string, ColorScale> = { violet, zinc, emerald, red, amber }
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/** The scale keys are numbers written as strings — sort them numerically. */
function byStep(a: string, b: string): number {
  return Number(a) - Number(b)
}

describe('colour scales', () => {
  it('every scale exposes the same steps', () => {
    const expected = Object.keys(violet).sort(byStep)

    for (const [name, scale] of Object.entries(SCALES)) {
      expect(Object.keys(scale).sort(byStep), `${name} scale`).toEqual(expected)
    }
  })

  it('every scale covers the full 0–950 ramp', () => {
    expect(Object.keys(violet).sort(byStep)).toEqual(
      ['0', '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
    )
  })

  it('every colour is a valid hex value', () => {
    for (const [name, scale] of Object.entries(SCALES)) {
      for (const [step, value] of Object.entries(scale)) {
        expect(value, `${name}.${step}`).toMatch(HEX)
      }
    }
  })

  it('the scales are genuinely different palettes', () => {
    expect(violet[600]).not.toBe(zinc[600])
    expect(zinc[600]).not.toBe(emerald[600])
  })
})

describe('semantic tokens', () => {
  it('the light and dark schemes define exactly the same tokens', () => {
    expect(Object.keys(lightTokens).sort()).toEqual(Object.keys(darkTokens).sort())
  })

  it('both schemes define the tokens the design markup relies on', () => {
    for (const token of ['background', 'surface', 'primary', 'on-primary', 'error', 'warning', 'outline-variant']) {
      expect(lightTokens).toHaveProperty(token)
      expect(darkTokens).toHaveProperty(token)
    }
  })

  it('every semantic token is a valid hex value in both schemes', () => {
    for (const [mode, tokens] of Object.entries(semanticTokens)) {
      for (const [name, value] of Object.entries(tokens)) {
        expect(value, `${mode}.${name}`).toMatch(HEX)
      }
    }
  })

  it('semanticTokens maps the mode names onto the exported token sets', () => {
    expect(semanticTokens.light).toBe(lightTokens)
    expect(semanticTokens.dark).toBe(darkTokens)
  })

  it('the two schemes are actually different — dark is not a copy of light', () => {
    expect(lightTokens.background).not.toBe(darkTokens.background)
    expect(lightTokens.surface).not.toBe(darkTokens.surface)
  })
})

describe('radii', () => {
  it('every radius is a non-empty CSS length', () => {
    for (const [name, value] of Object.entries(radii)) {
      expect(value, name).toMatch(/^(0|\d+(px|rem|em|%))$/)
    }
  })

  it('the card radius is 8px, as the design system requires', () => {
    expect(radii.md).toBe('8px')
  })
})

describe('the PrimeVue preset', () => {
  it('is built on the violet scale', () => {
    expect(preset.semantic.primary).toEqual(violet)
  })

  it('defines both colour schemes', () => {
    expect(preset.semantic.colorScheme).toBeTruthy()
    expect(Object.keys(preset.semantic.colorScheme).sort()).toEqual(['dark', 'light'])
  })

  it('drives the interactive primary colour from the violet scale', () => {
    const light = preset.semantic.colorScheme.light.primary
    expect(light.color).toBe(violet[600])
    expect(light.hoverColor).toBe(violet[700])
    expect(light.activeColor).toBe(violet[800])
  })

  it('uses the token radii for the card and input radius', () => {
    expect(preset.primitive.borderRadius).toEqual(radii)
  })

  it('keeps the focus ring visible — 2px solid violet, 2px offset', () => {
    expect(preset.semantic.focusRing).toEqual({
      width: '2px',
      style: 'solid',
      color: '{violet.400}',
      offset: '2px',
      shadow: 'none',
    })
  })
})
