import { describe, expect, it } from 'vitest'

import { iconClass } from '../app/utils/icons'

describe('iconClass — PrimeIcons always get the `pi` base class', () => {
  it('adds the base class to a bare icon name', () => {
    expect(iconClass('pi-calendar')).toBe('pi pi-calendar')
  })

  it('keeps a class string that already has the base class', () => {
    expect(iconClass('pi pi-wallet')).toBe('pi pi-wallet')
  })

  it('does not duplicate the base class or lose extra classes', () => {
    expect(iconClass('pi-cog text-primary')).toBe('pi pi-cog text-primary')
    expect(iconClass('text-primary pi pi-cog')).toBe('text-primary pi pi-cog')
  })

  it('trims surrounding whitespace', () => {
    expect(iconClass('  pi-sun ')).toBe('pi pi-sun')
  })
})
