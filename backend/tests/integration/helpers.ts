import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll } from 'vitest';
import { setDbHandle } from '../../src/db/client.js';
import * as schema from '../../src/db/schema/index.js';
import { todayIso, weekStart } from '../../src/lib/dates.js';

/**
 * Integration-test harness.
 *
 * Each spec file gets **one dedicated connection**, and `resetDatabase()`
 * truncates every table between specs. The file also truncates on entry and on
 * exit, so the test database is left clean even if a spec crashes.
 *
 * Why not "one outer transaction that is always rolled back"? PostgreSQL has no
 * nested transactions: a `BEGIN` issued while a transaction is already open is
 * ignored (with a warning), and the matching `COMMIT` then commits the **outer**
 * transaction. Any code path that legitimately uses `db.transaction()` — invoice
 * generation writes the invoice and its lines atomically — would therefore end
 * the harness's transaction and commit its data, breaking isolation for every
 * later spec file. Truncating keeps the application's transaction semantics
 * intact.
 *
 * `vitest.config.ts` points DATABASE_URL at `DATABASE_URL_TEST`; the guard below
 * enforces that, so the dev database cannot be reached even by mistake.
 */

function assertTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.endsWith('_test')) {
    throw new Error(
      'Refusing to run integration tests against a non-test database: DATABASE_URL must ' +
        `end with "_test" (got "${url.replace(/:\/\/[^@]*@/, '://***@')}").`,
    );
  }
}

assertTestDatabase();

/** Every table the app owns, in dependency order for TRUNCATE … CASCADE. */
const TABLES = [
  'invoice_lines',
  'invoices',
  'work_records',
  'weeks',
  'projects',
  'clients',
  'payment_platforms',
  'settings',
] as const;

const TRUNCATE_SQL = `TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Every query the app makes goes through this one connection.
setDbHandle({ db: drizzle(client, { schema }), pool: client });

// Imported only after the handle is installed, because the feature modules bind
// their repositories to `getDb()` at import time.
const { createApp } = await import('../../src/app.js');
const app = createApp();

export const api = () => request(app);

/** Empties every table so the next spec starts from a known state. */
export async function resetDatabase(): Promise<void> {
  await client.query(TRUNCATE_SQL);
}

beforeAll(async () => {
  // Start clean, even if a previous run was interrupted mid-suite.
  await client.query(TRUNCATE_SQL);
});

afterAll(async () => {
  try {
    // Leave the database clean for whoever runs the suite next.
    await client.query(TRUNCATE_SQL);
    await client.end();
  } catch {
    // The connection is already closed (a spec called `closeDb()`).
  }
});

export interface Fixtures {
  payoneerId: number;
  clientId: number;
  projectId: number;
  standaloneProjectId: number;
}

/** Minimal dataset created through the public API, as the UI would. */
export async function seedFixtures(): Promise<Fixtures> {
  const platform = await api()
    .post('/api/payment-platforms')
    .send({ company: 'Payoneer', feePercent: 1, feeFlat: 0 })
    .expect(201);
  const payoneerId = platform.body.data.id as number;

  const client = await api()
    .post('/api/clients')
    .send({
      name: 'Acme Corp',
      contactEmail: 'billing@acme.example',
      ccEmail: 'finance@acme.example',
      billingHour: 130,
      paymentPlatformId: payoneerId,
    })
    .expect(201);
  const clientId = client.body.data.id as number;

  const project = await api()
    .post('/api/projects')
    .send({ name: 'E-Commerce Storefront', clientId })
    .expect(201);
  const projectId = project.body.data.id as number;

  const standalone = await api()
    .post('/api/projects')
    .send({ name: 'Internal Tools', clientId: null, billingHour: 95 })
    .expect(201);

  return {
    payoneerId,
    clientId,
    projectId,
    standaloneProjectId: standalone.body.data.id as number,
  };
}

/** The current week, created on demand by the API. */
export async function currentWeekId(): Promise<number> {
  const week = await api().get('/api/weeks/current').expect(200);
  return week.body.data.id as number;
}

export function thisMonday(): string {
  return weekStart(todayIso());
}