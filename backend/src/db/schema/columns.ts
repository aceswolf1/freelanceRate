import { numeric } from 'drizzle-orm/pg-core';

/**
 * Shared column helpers.
 *
 * Money is stored as `numeric(12,2)` and read back as a JS number (values here
 * are small — hourly rates and weekly totals), but **all arithmetic happens in
 * integer cents inside the service layer** (see `src/lib/money.ts`).
 */
export function money(name: string) {
  return numeric(name, { precision: 12, scale: 2, mode: 'number' });
}

/** Hours: `numeric(5,2)`, e.g. 7.5. */
export function hours(name: string) {
  return numeric(name, { precision: 5, scale: 2, mode: 'number' });
}