/**
 * Unit tests for the **pure** earnings engine (R13).
 *
 * The contract's §4.8 example is reproduced exactly: fees must reconcile to the
 * invoice fee by project *and* by client, with no lost or invented cents.
 */
import { describe, expect, it } from 'vitest';
import { allocateFee, buildEarningsReport } from './reports.engine.js';
import type { EarningsSourceRecord } from './reports.types.js';

function record(overrides: Partial<EarningsSourceRecord> = {}): EarningsSourceRecord {
  return {
    recordId: 1,
    weekId: 1,
    clientId: 1,
    clientName: 'Acme Corp',
    projectId: 1,
    projectName: 'E-Commerce Storefront',
    hours: 15.5,
    rate: 130,
    grossCents: 201500,
    feePercent: 1,
    feeFlat: 0,
    invoiced: true,
    invoiceFeeCents: 2275,
    ...overrides,
  };
}

/** The seeded week from contract §4.8: Acme (2 projects), Starlight, standalone. */
function seededWeek(): EarningsSourceRecord[] {
  return [
    record({ recordId: 1, projectId: 1, projectName: 'E-Commerce Storefront', hours: 15.5, rate: 130, grossCents: 201500 }),
    record({ recordId: 2, projectId: 2, projectName: 'API Microservice', hours: 2, rate: 130, grossCents: 26000 }),
    record({
      recordId: 3,
      clientId: 2,
      clientName: 'Starlight Media',
      projectId: 3,
      projectName: 'Video Streaming Mobile App',
      hours: 14.5,
      rate: 115,
      grossCents: 166750,
      invoiceFeeCents: 1668,
    }),
    record({
      recordId: 4,
      clientId: null,
      clientName: null,
      projectId: 4,
      projectName: 'Internal Tools',
      hours: 2.5,
      rate: 95,
      grossCents: 23750,
      invoiceFeeCents: 238,
    }),
  ];
}

const period = { from: '2026-10-19', to: '2026-10-25', currencySymbol: '$' };

describe('allocateFee', () => {
  it('splits proportionally and preserves the total exactly', () => {
    const parts = allocateFee(2275, [201500, 26000]);

    expect(parts).toEqual([2015, 260]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(2275);
  });

  it('never loses a cent when the division is not exact', () => {
    const parts = allocateFee(100, [1, 1, 1]);

    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });

  it('returns zeroes for a zero fee or empty weights', () => {
    expect(allocateFee(0, [100, 200])).toEqual([0, 0]);
    expect(allocateFee(500, [])).toEqual([]);
  });

  it('handles a single weight', () => {
    expect(allocateFee(2275, [201500])).toEqual([2275]);
  });

  it('returns zeroes when every weight is zero', () => {
    expect(allocateFee(500, [0, 0])).toEqual([0, 0]);
  });
});

describe('buildEarningsReport', () => {
  it('returns an empty report for an empty range', () => {
    const report = buildEarningsReport({ records: [], groupBy: 'project', ...period });

    expect(report.rows).toEqual([]);
    expect(report.totals).toEqual({ hours: 0, gross: 0, fees: 0, net: 0 });
    expect(report.unbilled).toEqual({ hours: 0, gross: 0, fees: 0, net: 0, weekCount: 0 });
  });

  it('groups by project and reconciles fees to the invoice fee (contract §4.8)', () => {
    const report = buildEarningsReport({ records: seededWeek(), groupBy: 'project', ...period });

    // Ordered by gross DESC (§4.8): 2015, 1667.5, 260, 237.5.
    expect(report.rows).toEqual([
      { id: 1, name: 'E-Commerce Storefront', hours: 15.5, gross: 2015, fees: 20.15, net: 1994.85 },
      { id: 3, name: 'Video Streaming Mobile App', hours: 14.5, gross: 1667.5, fees: 16.68, net: 1650.82 },
      { id: 2, name: 'API Microservice', hours: 2, gross: 260, fees: 2.6, net: 257.4 },
      { id: 4, name: 'Internal Tools', hours: 2.5, gross: 237.5, fees: 2.38, net: 235.12 },
    ]);
    // Σ project fees must equal Σ invoice fees exactly — nothing lost, nothing invented.
    const totalFees = report.rows.reduce((sum, row) => sum + row.fees, 0);
    expect(Math.round(totalFees * 100)).toBe(2275 + 1668 + 238);
    expect(report.totals).toEqual({ hours: 34.5, gross: 4180, fees: 41.81, net: 4138.19 });
    expect(report.unbilled).toEqual({ hours: 0, gross: 0, fees: 0, net: 0, weekCount: 0 });
  });

  it('groups by client, folding standalone work into "No client"', () => {
    const report = buildEarningsReport({ records: seededWeek(), groupBy: 'client', ...period });

    expect(report.rows).toEqual([
      { id: 1, name: 'Acme Corp', hours: 17.5, gross: 2275, fees: 22.75, net: 2252.25 },
      { id: 2, name: 'Starlight Media', hours: 14.5, gross: 1667.5, fees: 16.68, net: 1650.82 },
      { id: null, name: 'No client', hours: 2.5, gross: 237.5, fees: 2.38, net: 235.12 },
    ]);
    expect(report.totals.fees).toBe(41.81);
  });

  it('orders rows by gross DESC, then name ASC', () => {
    const records = [
      record({ recordId: 1, projectId: 1, projectName: 'Bravo', grossCents: 10000, invoiceFeeCents: 100 }),
      record({ recordId: 2, projectId: 2, projectName: 'Alpha', grossCents: 10000, invoiceFeeCents: 100 }),
      record({ recordId: 3, projectId: 3, projectName: 'Charlie', grossCents: 50000, invoiceFeeCents: 500 }),
    ];

    const report = buildEarningsReport({ records, groupBy: 'project', ...period });

    expect(report.rows.map((row) => row.name)).toEqual(['Charlie', 'Alpha', 'Bravo']);
  });

  it('reports unbilled work separately and applies a notional fee to it', () => {
    const records = [
      ...seededWeek(),
      record({
        recordId: 5,
        weekId: 2,
        hours: 4,
        rate: 130,
        grossCents: 52000,
        invoiced: false,
        invoiceFeeCents: null,
      }),
    ];

    const report = buildEarningsReport({ records, groupBy: 'project', ...period });

    expect(report.unbilled).toEqual({ hours: 4, gross: 520, fees: 5.2, net: 514.8, weekCount: 1 });
    // Unbilled work is still real earnings and still appears in the rows.
    expect(report.totals.gross).toBe(4700);
    expect(report.totals.fees).toBe(47.01);
  });

  it('counts each unbilled week once', () => {
    const records = [
      record({ recordId: 1, weekId: 7, grossCents: 10000, invoiced: false, invoiceFeeCents: null }),
      record({ recordId: 2, weekId: 7, grossCents: 20000, invoiced: false, invoiceFeeCents: null }),
      record({ recordId: 3, weekId: 8, grossCents: 30000, invoiced: false, invoiceFeeCents: null }),
    ];

    const report = buildEarningsReport({ records, groupBy: 'project', ...period });

    expect(report.unbilled.weekCount).toBe(2);
    expect(report.unbilled.gross).toBe(600);
  });

  it('applies no fee when the bucket has no payment platform', () => {
    const records = [
      record({ feePercent: 0, feeFlat: 0, invoiced: false, invoiceFeeCents: null, grossCents: 100000 }),
    ];

    const report = buildEarningsReport({ records, groupBy: 'project', ...period });

    expect(report.rows[0]?.fees).toBe(0);
    expect(report.rows[0]?.net).toBe(1000);
  });

  it('does not mutate the caller input', () => {
    const records = seededWeek();
    const snapshot = structuredClone(records);

    buildEarningsReport({ records, groupBy: 'project', ...period });

    expect(records).toEqual(snapshot);
  });
});