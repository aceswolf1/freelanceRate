/**
 * Integration specs for `GET /api/reports/earnings` (contract §4.8, R13).
 *
 * The key property under test is acceptance criterion 6: earnings grouped by
 * project *and* by client must reconcile with the issued invoices to the cent.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { api, resetDatabase } from './helpers.js';
import { seedWeek } from './invoices.helpers.js';
import { getDb } from '../../src/db/client.js';
import { projects } from '../../src/db/schema/index.js';
import { addDays } from '../../src/lib/dates.js';

describe('GET /api/reports/earnings', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('sums by project to the invoice totals', async () => {
    const seed = await seedWeek({ status: 'closed' });
    const generated = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);

    const response = await api().get('/api/reports/earnings?groupBy=project').expect(200);
    const report = response.body.data;

    expect(report.groupBy).toBe('project');
    expect(report.currencySymbol).toBe('$');
    // §4.8: from/to default to the earliest/latest **record** date — the last
    // record sits on Saturday, not the week's Sunday.
    expect(report.from).toBe(seed.startDate);
    expect(report.to).toBe(addDays(seed.startDate, 5));
    expect(report.rows).toHaveLength(4);
    expect(report.totals.hours).toBe(34.5);
    expect(report.totals.gross).toBe(4180);

    // Σ rows must equal the sum of the issued invoices, cent for cent.
    const invoiceGross = generated.body.data.reduce((sum: number, i: { gross: number }) => sum + i.gross, 0);
    const invoiceFees = generated.body.data.reduce((sum: number, i: { feeAmount: number }) => sum + i.feeAmount, 0);
    expect(Math.round(report.totals.gross * 100)).toBe(Math.round(invoiceGross * 100));
    expect(Math.round(report.totals.fees * 100)).toBe(Math.round(invoiceFees * 100));

    const byName = Object.fromEntries(
      report.rows.map((row: { name: string }) => [row.name, row]),
    );
    expect(byName['E-Commerce Storefront']).toMatchObject({ gross: 2015, fees: 20.15, net: 1994.85 });
    expect(byName['API Microservice']).toMatchObject({ gross: 260, fees: 2.6, net: 257.4 });
    expect(byName['Video Streaming Mobile App']).toMatchObject({ gross: 1667.5, fees: 16.68, net: 1650.82 });
    // Standalone work has no client, hence no payment platform and no fee (R3).
    expect(byName['Internal Tools']).toMatchObject({
      id: seed.projectIds.internal,
      gross: 237.5,
      fees: 0,
      net: 237.5,
    });
    expect(report.totals.fees).toBe(39.43);
    expect(report.totals.net).toBe(4140.57);
  });

  it('sums by client to the invoice totals, folding standalone work into "No client"', async () => {
    const seed = await seedWeek({ status: 'closed' });
    const generated = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);

    const response = await api().get('/api/reports/earnings?groupBy=client').expect(200);
    const report = response.body.data;

    expect(report.rows).toHaveLength(3);
    expect(report.rows.map((row: { name: string }) => row.name)).toEqual([
      'Acme Corp',
      'Starlight Media',
      'No client',
    ]);

    const invoiceFees = generated.body.data.reduce(
      (sum: number, i: { feeAmount: number }) => sum + i.feeAmount,
      0,
    );
    expect(Math.round(report.totals.fees * 100)).toBe(Math.round(invoiceFees * 100));

    const acme = report.rows.find((row: { name: string }) => row.name === 'Acme Corp');
    // Acme's two projects split one invoice fee of $22.75: $20.15 + $2.60.
    expect(acme).toMatchObject({ gross: 2275, fees: 22.75, net: 2252.25 });

    const noClient = report.rows.find((row: { name: string }) => row.name === 'No client');
    // Standalone work carries no platform fee (R3) — see the contract Deviations row.
    expect(noClient).toMatchObject({ id: null, gross: 237.5, fees: 0, net: 237.5 });
  });

  it('defaults to grouping by project', async () => {
    await seedWeek({ status: 'open' });

    const response = await api().get('/api/reports/earnings').expect(200);

    expect(response.body.data.groupBy).toBe('project');
  });

  it('reports unbilled work separately when a week has no invoices', async () => {
    const invoiced = await seedWeek({ status: 'closed' });
    // `weeks.start_date` is unique, so the second week must sit on another Monday.
    await seedWeek({ status: 'open', startDate: addDays(invoiced.startDate, -7) });

    await api().post(`/api/weeks/${invoiced.weekId}/invoices`).send().expect(201);

    const response = await api().get('/api/reports/earnings').expect(200);
    const report = response.body.data;

    expect(report.unbilled.weekCount).toBe(1);
    expect(report.unbilled.hours).toBe(34.5);
    expect(report.unbilled.gross).toBe(4180);
    // Notional per-bucket fees: Acme $22.75 + Starlight $16.68 + standalone $0.
    expect(report.unbilled.fees).toBe(39.43);
    expect(report.unbilled.net).toBe(4140.57);
    // Invoiced + unbilled together make up the headline totals.
    expect(report.totals.gross).toBe(8360);
  });

  it('honours an explicit from/to range', async () => {
    const seed = await seedWeek({ status: 'closed' });

    // Only the first two days of the week have records (15.5 h + 2 h = $2,275).
    const response = await api()
      .get(`/api/reports/earnings?from=${seed.startDate}&to=${seed.startDate}&groupBy=project`)
      .expect(200);

    expect(response.body.data.from).toBe(seed.startDate);
    expect(response.body.data.to).toBe(seed.startDate);
    expect(response.body.data.totals.hours).toBe(15.5);
    expect(response.body.data.totals.gross).toBe(2015);
  });

  it('returns an empty report for a range with no records', async () => {
    await seedWeek({ status: 'open' });

    const response = await api().get('/api/reports/earnings?from=2020-01-06&to=2020-01-12').expect(200);

    expect(response.body.data.rows).toEqual([]);
    expect(response.body.data.totals).toEqual({ hours: 0, gross: 0, fees: 0, net: 0 });
  });

  it('400s on a malformed date', async () => {
    const response = await api().get('/api/reports/earnings?from=19-10-2026').expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].path).toBe('from');
  });

  it('400s on an impossible calendar date', async () => {
    const response = await api().get('/api/reports/earnings?from=2026-02-30').expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400s when from is after to', async () => {
    await seedWeek({ status: 'open' });

    const response = await api()
      .get('/api/reports/earnings?from=2026-10-25&to=2026-10-19')
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].path).toBe('from');
  });

  it('400s on an unknown groupBy', async () => {
    const response = await api().get('/api/reports/earnings?groupBy=week').expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].path).toBe('groupBy');
  });

  it('uses the invoiced snapshot rate even after the project rate changes', async () => {
    const seed = await seedWeek({ status: 'closed' });
    await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);

    // Raise the Starlight project rate after invoicing.
    await getDb()
      .update(projects)
      .set({ billingHour: 500 })
      .where(eq(projects.id, seed.projectIds.video));

    const response = await api().get('/api/reports/earnings?groupBy=project').expect(200);
    const row = response.body.data.rows.find(
      (r: { name: string }) => r.name === 'Video Streaming Mobile App',
    );

    // The invoice froze $115/h — history must not be rewritten.
    expect(row.gross).toBe(1667.5);
  });
});