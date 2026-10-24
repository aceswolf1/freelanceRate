import { describe, expect, it } from 'vitest'

import { NAV_ITEMS, breadcrumbFor, isNavItemActive } from '~/utils/nav'

const timesheet = NAV_ITEMS.find(item => item.to === '/')!
const clients = NAV_ITEMS.find(item => item.to === '/clients')!

describe('NAV_ITEMS', () => {
  it('covers every route in the sidebar design plus earnings', () => {
    expect(NAV_ITEMS.map(item => item.to)).toEqual([
      '/',
      '/invoices',
      '/clients',
      '/projects',
      '/earnings',
      '/settings',
    ])
  })

  it('marks the timesheet route exact so it does not light up everywhere', () => {
    expect(timesheet.exact).toBe(true)
    expect(isNavItemActive(timesheet, '/')).toBe(true)
    expect(isNavItemActive(timesheet, '/clients')).toBe(false)
  })

  it('lights up nested paths for non-exact items', () => {
    expect(isNavItemActive(clients, '/clients')).toBe(true)
    expect(isNavItemActive(clients, '/clients/7/edit')).toBe(true)
    expect(isNavItemActive(clients, '/')).toBe(false)
  })
})

describe('breadcrumbFor', () => {
  it('always starts at Workspace', () => {
    expect(breadcrumbFor('/clients')[0]).toEqual({ label: 'Workspace', to: '/' })
  })

  it('names the current section', () => {
    expect(breadcrumbFor('/projects').at(-1)).toEqual({ label: 'Projects', to: '/projects' })
  })

  it('still renders for an unknown path', () => {
    expect(breadcrumbFor('/nope')).toEqual([{ label: 'Workspace', to: '/' }])
  })
})