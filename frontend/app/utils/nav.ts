export interface NavItem {
  label: string
  to: string
  icon: string
  /** Exact-match routes (`/`) must not also light up on every nested path. */
  exact?: boolean
  description: string
}

/** Order matches the design sidebar; `/earnings` is appended for the nav the plan specifies. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Weekly Timesheet', to: '/', icon: 'pi-calendar', exact: true, description: 'Log and review hours for the active week' },
  { label: 'Invoice Generator', to: '/invoices', icon: 'pi-receipt', description: 'Generate, download and email invoices' },
  { label: 'Clients', to: '/clients', icon: 'pi-users', description: 'Billing accounts, contacts and default rates' },
  { label: 'Projects', to: '/projects', icon: 'pi-folder-open', description: 'Engagements, client links and rate overrides' },
  { label: 'Earnings', to: '/earnings', icon: 'pi-chart-bar', description: 'Gross, fees and net by project and client' },
  { label: 'Settings', to: '/settings', icon: 'pi-cog', description: 'Profile, thresholds, fee rails and invoice rules' },
]

export function isNavItemActive(item: NavItem, path: string): boolean {
  if (item.exact) {
    return path === item.to
  }
  return path === item.to || path.startsWith(`${item.to}/`)
}

/** Breadcrumb trail for the header, derived from the nav config (single source of truth). */
export function breadcrumbFor(path: string): { label: string, to: string }[] {
  const match = NAV_ITEMS.find(item => isNavItemActive(item, path))
  return [
    { label: 'Workspace', to: '/' },
    ...(match ? [{ label: match.label, to: match.to }] : []),
  ]
}