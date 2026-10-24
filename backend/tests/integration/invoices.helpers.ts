/**
 * Fixtures for worker-3's invoice/report integration specs.
 *
 * Rows are inserted **directly through Drizzle** rather than the public API so
 * these specs exercise the invoice endpoints end-to-end without depending on the
 * CRUD modules, which are being built in parallel.
 *
 * The dataset reproduces contract §4.8 exactly:
 *   Acme Corp          — 2 projects, $130/h, Payoneer 1%   → $2,275.00
 *   Starlight Media    — 1 project, $115/h override          → $1,667.50
 *   Internal Tools     — standalone, $95/h                   → $237.50
 *   week total                                              34.5 h / $4,180.00
 */
import { getDb } from '../../src/db/client.js';
import {
  clients,
  paymentPlatforms,
  projects,
  settings,
  weeks,
  workRecords,
} from '../../src/db/schema/index.js';
import { addDays, weekStart, todayIso } from '../../src/lib/dates.js';

export interface SeededWeek {
  weekId: number;
  startDate: string;
  endDate: string;
  acmeClientId: number;
  starlightClientId: number;
  projectIds: { ecommerce: number; api: number; video: number; internal: number };
}

export interface SeedOptions {
  status?: 'open' | 'closed';
  /** Omit the work records to get an empty week (for the NO_RECORDS path). */
  withRecords?: boolean;
  /** Use a fixed Monday instead of the current one — keeps numbering stable. */
  startDate?: string;
}

/**
 * `noUncheckedIndexedAccess` types every destructured `.returning()` element as
 * `T | undefined`. An `INSERT … RETURNING` that yields no row is a fixture bug,
 * so it fails loudly here instead of surfacing much later as "cannot read .id".
 */
function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Fixture setup failed: ${label} was not inserted`);
  }
  return value;
}

export async function seedWeek(options: SeedOptions = {}): Promise<SeededWeek> {
  const { status = 'open', withRecords = true } = options;
  const db = getDb();

  const [payoneerRow] = await db
    .insert(paymentPlatforms)
    .values({ company: 'Payoneer', feePercent: 1, feeFlat: 0 })
    .returning();
  const payoneer = must(payoneerRow, 'payment platform "Payoneer"');

  const [acmeRow] = await db
    .insert(clients)
    .values({
      name: 'Acme Corp',
      contactEmail: 'billing@acme.example',
      ccEmail: 'finance@acme.example',
      billingHour: 130,
      paymentPlatformId: payoneer.id,
    })
    .returning();
  const acme = must(acmeRow, 'client "Acme Corp"');

  const [starlightRow] = await db
    .insert(clients)
    .values({
      name: 'Starlight Media',
      contactEmail: 'accounts@starlight.example',
      ccEmail: null,
      billingHour: 100,
      paymentPlatformId: payoneer.id,
    })
    .returning();
  const starlight = must(starlightRow, 'client "Starlight Media"');

  const [ecommerceRow] = await db
    .insert(projects)
    .values({ name: 'E-Commerce Storefront', clientId: acme.id })
    .returning();
  const ecommerce = must(ecommerceRow, 'project "E-Commerce Storefront"');

  const [apiRow] = await db
    .insert(projects)
    .values({ name: 'API Microservice', clientId: acme.id })
    .returning();
  const api = must(apiRow, 'project "API Microservice"');

  const [videoRow] = await db
    .insert(projects)
    .values({ name: 'Video Streaming Mobile App', clientId: starlight.id, billingHour: 115 })
    .returning();
  const video = must(videoRow, 'project "Video Streaming Mobile App"');

  const [internalRow] = await db
    .insert(projects)
    .values({ name: 'Internal Tools', clientId: null, billingHour: 95 })
    .returning();
  const internal = must(internalRow, 'project "Internal Tools"');

  // Seeding twice in one spec must not violate the singleton PK.
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();

  const startDate = options.startDate ?? weekStart(todayIso());
  const [weekRow] = await db.insert(weeks).values({ startDate, status }).returning();
  const week = must(weekRow, `week starting ${startDate}`);

  if (withRecords) {
    await db.insert(workRecords).values([
      {
        weekId: week.id,
        projectId: ecommerce.id,
        clientId: acme.id,
        description: 'Checkout flow rebuild',
        hours: 15.5,
        date: addDays(startDate, 0),
      },
      {
        weekId: week.id,
        projectId: api.id,
        clientId: acme.id,
        description: 'Rate-limit middleware',
        hours: 2,
        date: addDays(startDate, 1),
      },
      {
        weekId: week.id,
        projectId: video.id,
        clientId: starlight.id,
        description: 'Offline downloads',
        hours: 14.5,
        date: addDays(startDate, 2),
      },
      {
        weekId: week.id,
        projectId: internal.id,
        clientId: null,
        description: 'Deployment scripts',
        hours: 2.5,
        date: addDays(startDate, 5),
      },
    ]);
  }

  return {
    weekId: week.id,
    startDate,
    endDate: addDays(startDate, 6),
    acmeClientId: acme.id,
    starlightClientId: starlight.id,
    projectIds: { ecommerce: ecommerce.id, api: api.id, video: video.id, internal: internal.id },
  };
}

export interface GeneratedInvoice {
  id: number;
  number: string;
  clientName: string;
  gross: number;
  feeAmount: number;
  net: number;
  totalHours: number;
}

/** ISO-8601 week number of a Monday date — used to assert error messages. */
export function isoWeekOf(mondayIso: string): number {
  const date = new Date(`${mondayIso}T00:00:00Z`);
  const weekday = date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1;
  date.setUTCDate(date.getUTCDate() - weekday + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstWeekday = firstThursday.getUTCDay() === 0 ? 6 : firstThursday.getUTCDay() - 1;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}