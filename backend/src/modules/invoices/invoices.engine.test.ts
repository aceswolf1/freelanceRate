/**
 * Unit tests for the **pure** invoice engine (R9–R11 business rules).
 *
 * The engine takes week records + clients + settings and returns per-client
 * invoice drafts. No I/O, no database, no framework — which is why every money
 * rule can be asserted exactly.
 */
import { describe, expect, it } from 'vitest';
import {
  buildInvoiceDrafts,
  buildWarnings,
  effectiveRateFor,
  NO_CLIENT_NAME,
  type EngineClient,
  type EngineRecord,
} from './invoices.engine.js';

function client(overrides: Partial<EngineClient> = {}): EngineClient {
  return {
    id: 1,
    name: 'Acme Corp',
    contactEmail: 'billing@acme.example',
    ccEmail: 'finance@acme.example',
    feePercent: 0,
    feeFlat: 0,
    platformCompany: null,
    ...overrides,
  };
}

function record(overrides: Partial<EngineRecord> = {}): EngineRecord {
  return {
    id: 1,
    date: '2026-10-19',
    hours: 1,
    description: 'Work',
    projectId: 1,
    projectName: 'E-Commerce Storefront',
    clientId: 1,
    projectBillingHour: null,
    clientBillingHour: 130,
    ...overrides,
  };
}

describe('effectiveRateFor', () => {
  it('prefers the project rate over the client rate', () => {
    expect(effectiveRateFor(record({ projectBillingHour: 115, clientBillingHour: 130 }))).toBe(115);
  });

  it('falls back to the client rate when the project has no override', () => {
    expect(effectiveRateFor(record({ projectBillingHour: null, clientBillingHour: 130 }))).toBe(130);
  });

  it('uses the project rate for standalone projects', () => {
    expect(
      effectiveRateFor(
        record({ clientId: null, projectBillingHour: 95, clientBillingHour: null }),
      ),
    ).toBe(95);
  });

  it('throws a descriptive error when no rate can be resolved', () => {
    expect(() =>
      effectiveRateFor(record({ projectBillingHour: null, clientBillingHour: null })),
    ).toThrow(/rate/i);
  });
});

describe('buildInvoiceDrafts', () => {
  it('returns an empty result for an empty week', () => {
    const result = buildInvoiceDrafts({ records: [], clients: [], settings: { weeklyTargetHours: 40 } });

    expect(result.drafts).toEqual([]);
    expect(result.totals).toEqual({
      totalHours: 0,
      projectedGross: 0,
      targetHours: 40,
      belowTarget: true,
      hoursBelowTarget: 40,
      clientCount: 0,
      recordCount: 0,
      byProject: [],
      byClient: [],
    });
  });

  // R9 / spec example: projects A + B on client A, project C on client B → 2 drafts.
  it('produces exactly one draft per client for the spec example', () => {
    const clients = [
      client({ id: 1, name: 'Acme Corp' }),
      client({ id: 2, name: 'Starlight Media', contactEmail: 'ap@starlight.example' }),
    ];
    const records = [
      record({ id: 1, projectId: 1, projectName: 'Project A', clientId: 1 }),
      record({ id: 2, projectId: 2, projectName: 'Project B', clientId: 1 }),
      record({ id: 3, projectId: 3, projectName: 'Project C', clientId: 2, projectBillingHour: 115 }),
    ];

    const { drafts } = buildInvoiceDrafts({
      records,
      clients,
      settings: { weeklyTargetHours: 40 },
    });

    expect(drafts).toHaveLength(2);
    expect(drafts.map((draft) => draft.clientName)).toEqual(['Acme Corp', 'Starlight Media']);
  });

  it('groups every standalone project into a single "No client" bucket', () => {
    const records = [
      record({ id: 1, projectId: 10, projectName: 'Internal Tools', clientId: null, projectBillingHour: 95 }),
      record({ id: 2, projectId: 11, projectName: 'R&D', clientId: null, projectBillingHour: 95 }),
    ];

    const { drafts } = buildInvoiceDrafts({ records, clients: [], settings: { weeklyTargetHours: 40 } });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.clientId).toBeNull();
    expect(drafts[0]?.clientName).toBe(NO_CLIENT_NAME);
    expect(drafts[0]?.contactEmail).toBe('');
    expect(drafts[0]?.ccEmail).toBeNull();
    expect(drafts[0]?.platformCompany).toBeNull();
    expect(drafts[0]?.feePercent).toBe(0);
    expect(drafts[0]?.feeFlat).toBe(0);
  });

  it('uses the project rate override on the line and subtotal', () => {
    const records = [
      record({ id: 1, hours: 2, projectBillingHour: 115, clientBillingHour: 100 }),
    ];

    const [draft] = buildInvoiceDrafts({
      records,
      clients: [client({ id: 1 })],
      settings: { weeklyTargetHours: 40 },
    }).drafts;

    expect(draft?.lines[0]?.rate).toBe(115);
    expect(draft?.lines[0]?.lineTotal).toBe(230);
    expect(draft?.subtotals[0]?.gross).toBe(230);
    expect(draft?.gross).toBe(230);
  });

  it('applies percent + flat fees and derives net', () => {
    const records = [record({ id: 1, hours: 10, clientBillingHour: 130 })];
    const clients = [client({ id: 1, feePercent: 1, feeFlat: 15, platformCompany: 'Payoneer' })];

    const [draft] = buildInvoiceDrafts({
      records,
      clients,
      settings: { weeklyTargetHours: 40 },
    }).drafts;

    expect(draft?.gross).toBe(1300);
    expect(draft?.feeAmount).toBe(28); // 1% of $1,300 = $13.00 + $15.00 flat
    expect(draft?.net).toBe(1272);
    expect(draft?.platformCompany).toBe('Payoneer');
  });

  // Rounding: 1% of $1,667.50 = $16.675 → half-up on cents → $16.68.
  it('rounds the percentage fee half-up on integer cents', () => {
    const records = [record({ id: 1, hours: 14.5, clientBillingHour: 115 })];
    const clients = [client({ id: 1, feePercent: 1, feeFlat: 0 })];

    const [draft] = buildInvoiceDrafts({
      records,
      clients,
      settings: { weeklyTargetHours: 40 },
    }).drafts;

    expect(draft?.gross).toBe(1667.5);
    expect(draft?.feeAmount).toBe(16.68);
    expect(draft?.net).toBe(1650.82);
  });

  it('sorts lines by date, then by record id', () => {
    const records = [
      record({ id: 3, date: '2026-10-21' }),
      record({ id: 1, date: '2026-10-19' }),
      record({ id: 2, date: '2026-10-19' }),
      record({ id: 4, date: '2026-10-25' }),
    ];

    const [draft] = buildInvoiceDrafts({
      records,
      clients: [client()],
      settings: { weeklyTargetHours: 40 },
    }).drafts;

    expect(draft?.lines.map((line) => line.recordId)).toEqual([1, 2, 3, 4]);
  });

  it('builds per-project subtotals ordered by first appearance', () => {
    const records = [
      record({ id: 1, projectId: 2, projectName: 'API Microservice', hours: 2 }),
      record({ id: 2, projectId: 1, projectName: 'E-Commerce Storefront', hours: 3.5 }),
      record({ id: 3, projectId: 1, projectName: 'E-Commerce Storefront', hours: 1.5 }),
    ];

    const [draft] = buildInvoiceDrafts({
      records,
      clients: [client()],
      settings: { weeklyTargetHours: 40 },
    }).drafts;

    expect(draft?.subtotals).toEqual([
      { projectId: 2, projectName: 'API Microservice', hours: 2, gross: 260 },
      { projectId: 1, projectName: 'E-Commerce Storefront', hours: 5, gross: 650 },
    ]);
    // Project subtotals must reconcile with the invoice total.
    expect(draft?.totalHours).toBe(7);
    expect(draft?.gross).toBe(910);
  });

  it('orders drafts by client name with the "No client" bucket last', () => {
    const records = [
      record({ id: 1, clientId: 2, projectBillingHour: 100 }),
      record({ id: 2, clientId: null, projectBillingHour: 95 }),
      record({ id: 3, clientId: 1 }),
    ];

    const { drafts } = buildInvoiceDrafts({
      records,
      clients: [client({ id: 1, name: 'Acme Corp' }), client({ id: 2, name: 'Starlight Media' })],
      settings: { weeklyTargetHours: 40 },
    });

    expect(drafts.map((draft) => draft.clientName)).toEqual([
      'Acme Corp',
      'Starlight Media',
      NO_CLIENT_NAME,
    ]);
  });

  it('computes week totals, target warnings and client count', () => {
    const records = [
      record({ id: 1, hours: 15.5, projectId: 1, projectName: 'E-Commerce Storefront' }),
      record({ id: 2, hours: 2, projectId: 2, projectName: 'API Microservice' }),
      record({ id: 3, hours: 14.5, projectId: 3, projectName: 'Video App', clientId: 2, projectBillingHour: 115 }),
      record({ id: 4, hours: 2.5, projectId: 4, projectName: 'Internal Tools', clientId: null, projectBillingHour: 95 }),
    ];

    const { totals } = buildInvoiceDrafts({
      records,
      clients: [client({ id: 1 }), client({ id: 2, name: 'Starlight Media' })],
      settings: { weeklyTargetHours: 40 },
    });

    expect(totals.totalHours).toBe(34.5);
    expect(totals.projectedGross).toBe(4180);
    expect(totals.recordCount).toBe(4);
    expect(totals.clientCount).toBe(2); // standalone bucket is not a client
    expect(totals.belowTarget).toBe(true);
    expect(totals.hoursBelowTarget).toBe(5.5);
    expect(totals.targetHours).toBe(40);

    expect(totals.byProject).toEqual([
      { projectId: 1, projectName: 'E-Commerce Storefront', clientId: 1, clientName: 'Acme Corp', rate: 130, hours: 15.5, gross: 2015 },
      { projectId: 2, projectName: 'API Microservice', clientId: 1, clientName: 'Acme Corp', rate: 130, hours: 2, gross: 260 },
      { projectId: 3, projectName: 'Video App', clientId: 2, clientName: 'Starlight Media', rate: 115, hours: 14.5, gross: 1667.5 },
      { projectId: 4, projectName: 'Internal Tools', clientId: null, clientName: null, rate: 95, hours: 2.5, gross: 237.5 },
    ]);
    expect(totals.byClient).toEqual([
      { clientId: 1, clientName: 'Acme Corp', hours: 17.5, gross: 2275 },
      { clientId: 2, clientName: 'Starlight Media', hours: 14.5, gross: 1667.5 },
      { clientId: null, clientName: null, hours: 2.5, gross: 237.5 },
    ]);
  });

  it('reports belowTarget=false once the week reaches its target', () => {
    const { totals } = buildInvoiceDrafts({
      records: [record({ id: 1, hours: 40 }), record({ id: 2, hours: 3 })],
      clients: [client()],
      settings: { weeklyTargetHours: 40 },
    });

    expect(totals.belowTarget).toBe(false);
    expect(totals.hoursBelowTarget).toBe(0);
  });

  it('does not mutate the caller input', () => {
    const records = [record({ id: 1 })];
    const clients = [client()];
    const input = { records, clients, settings: { weeklyTargetHours: 40 } };
    const snapshot = structuredClone(input);

    buildInvoiceDrafts(input);

    expect(input).toEqual(snapshot);
    expect(records[0]).toEqual(snapshot.records[0]);
  });
});

describe('buildWarnings', () => {
  const totals = {
    totalHours: 34.5,
    projectedGross: 4180,
    targetHours: 40,
    belowTarget: true,
    hoursBelowTarget: 5.5,
    clientCount: 2,
    recordCount: 12,
    byProject: [],
    byClient: [],
  };

  // Contract §4.3: an open, below-target week reports BOTH warnings.
  it('flags an open week and, below target, both warnings', () => {
    expect(buildWarnings({ weekNumber: 43, status: 'open', totals })).toEqual([
      { code: 'WEEK_OPEN', message: 'Close week 43 before generating invoices' },
      { code: 'BELOW_TARGET', message: '34.5 / 40 hrs, -5.5 below target' },
    ]);
  });

  it('flags being below the weekly target (R8)', () => {
    expect(buildWarnings({ weekNumber: 43, status: 'closed', totals })).toEqual([
      { code: 'BELOW_TARGET', message: '34.5 / 40 hrs, -5.5 below target' },
    ]);
  });

  it('flags an empty week', () => {
    const empty = { ...totals, totalHours: 0, belowTarget: true, hoursBelowTarget: 40, recordCount: 0 };
    expect(buildWarnings({ weekNumber: 43, status: 'closed', totals: empty })).toEqual([
      { code: 'NO_RECORDS', message: 'Week 43 has no records to invoice' },
    ]);
  });

  it('returns no warnings for a complete, closed, invoiced week', () => {
    const full = { ...totals, belowTarget: false, hoursBelowTarget: 0, totalHours: 40 };
    expect(buildWarnings({ weekNumber: 43, status: 'closed', totals: full })).toEqual([]);
  });
});