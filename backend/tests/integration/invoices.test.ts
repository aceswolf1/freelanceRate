/**
 * Integration specs for the invoice endpoints (contract §4.1–§4.7).
 *
 * Runs against `DATABASE_URL_TEST` (see `vitest.config.ts`) with full
 * truncation between specs, so these can never touch the dev database.
 */
import type { Response as SuperAgentResponse } from 'superagent';
import { beforeEach, describe, expect, it } from 'vitest';
import { api, resetDatabase } from './helpers.js';
import { isoWeekOf, seedWeek } from './invoices.helpers.js';
import { MAILTO_BODY_LIMIT } from '../../src/modules/invoices/invoices.email.js';

/**
 * Collects a binary response body (PDF / zip) instead of parsing it as JSON.
 * The stream type must be superagent's `Response` — it does not extend
 * `http.IncomingMessage`, so the two are not structurally interchangeable.
 */
function binaryParser(
  res: SuperAgentResponse,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

function getBinary(url: string) {
  return api().get(url).buffer(true).parse(binaryParser);
}

describe('invoice endpoints', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /api/weeks/:id/invoices (generate)', () => {
    it('refuses an open week with 409 CONFLICT', async () => {
      const seed = await seedWeek({ status: 'open' });

      const response = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
      expect(response.body.error.message).toBe(
        `Close week ${isoWeekOf(seed.startDate)} before generating invoices`,
      );
    });

    it('refuses a closed week with no records', async () => {
      const seed = await seedWeek({ status: 'closed', withRecords: false });

      const response = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
      expect(response.body.error.message).toBe(`Week ${isoWeekOf(seed.startDate)} has no records to invoice`);
    });

    it('creates one invoice per client bucket, including the "No client" bucket', async () => {
      const seed = await seedWeek({ status: 'closed' });

      const response = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);

      const invoices = response.body.data;
      expect(invoices).toHaveLength(3);
      expect(invoices.map((invoice: { clientName: string }) => invoice.clientName)).toEqual([
        'Acme Corp',
        'Starlight Media',
        'No client',
      ]);

      const year = seed.startDate.slice(0, 4);
      expect(invoices.map((invoice: { number: string }) => invoice.number)).toEqual([
        `INV-${year}-001`,
        `INV-${year}-002`,
        `INV-${year}-003`,
      ]);

      const [acme, starlight, standalone] = invoices;
      expect(acme).toMatchObject({
        clientId: seed.acmeClientId,
        gross: 2275,
        feeAmount: 22.75,
        net: 2252.25,
        totalHours: 17.5,
        feePercent: 1,
        platformCompany: 'Payoneer',
      });
      expect(starlight).toMatchObject({
        clientId: seed.starlightClientId,
        gross: 1667.5,
        feeAmount: 16.68,
        net: 1650.82,
        totalHours: 14.5,
      });
      expect(standalone).toMatchObject({
        clientId: null,
        clientName: 'No client',
        contactEmail: '',
        gross: 237.5,
        feeAmount: 0,
        net: 237.5,
        totalHours: 2.5,
      });
    });

    it('is idempotent — a second call returns the same invoices with 200', async () => {
      const seed = await seedWeek({ status: 'closed' });

      const first = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);
      const second = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(200);

      expect(second.body.data).toHaveLength(3);
      expect(second.body.data.map((i: { id: number }) => i.id)).toEqual(
        first.body.data.map((i: { id: number }) => i.id),
      );
      expect(second.body.data.map((i: { number: string }) => i.number)).toEqual(
        first.body.data.map((i: { number: string }) => i.number),
      );
    });

    it('404s for an unknown week', async () => {
      const response = await api().post('/api/weeks/9999/invoices').send().expect(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('400s for a non-numeric week id', async () => {
      const response = await api().post('/api/weeks/abc/invoices').send().expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/weeks/:id/invoices (list)', () => {
    it('returns an empty array before generation and the invoices afterwards', async () => {
      const seed = await seedWeek({ status: 'closed' });

      const before = await api().get(`/api/weeks/${seed.weekId}/invoices`).expect(200);
      expect(before.body.data).toEqual([]);

      await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);

      const after = await api().get(`/api/weeks/${seed.weekId}/invoices`).expect(200);
      expect(after.body.data).toHaveLength(3);
      const numbers = after.body.data.map((i: { number: string }) => i.number);
      expect([...numbers].sort()).toEqual(numbers);
    });
  });

  describe('GET /api/weeks/:id/invoice-preview (preview)', () => {
    it('previews an open week without persisting anything', async () => {
      const seed = await seedWeek({ status: 'open' });

      const response = await api().get(`/api/weeks/${seed.weekId}/invoice-preview`).expect(200);
      const preview = response.body.data;

      expect(preview.canGenerate).toBe(false);
      expect(preview.status).toBe('open');
      expect(preview.periodStart).toBe(seed.startDate);
      expect(preview.periodEnd).toBe(seed.endDate);
      expect(preview.totals.totalHours).toBe(34.5);
      expect(preview.totals.projectedGross).toBe(4180);
      expect(preview.totals.belowTarget).toBe(true);
      expect(preview.totals.hoursBelowTarget).toBe(5.5);
      expect(preview.warnings.map((w: { code: string }) => w.code)).toEqual([
        'WEEK_OPEN',
        'BELOW_TARGET',
      ]);
      expect(preview.invoices).toHaveLength(3);
      expect(preview.invoices[0]).toMatchObject({ clientName: 'Acme Corp', net: 2252.25 });

      // Preview must not have written anything.
      const invoices = await api().get(`/api/weeks/${seed.weekId}/invoices`).expect(200);
      expect(invoices.body.data).toEqual([]);
    });

    it('reports NO_RECORDS for an empty week', async () => {
      const seed = await seedWeek({ status: 'closed', withRecords: false });

      const response = await api().get(`/api/weeks/${seed.weekId}/invoice-preview`).expect(200);

      expect(response.body.data.warnings).toEqual([
        { code: 'NO_RECORDS', message: `Week ${isoWeekOf(seed.startDate)} has no records to invoice` },
      ]);
      expect(response.body.data.invoices).toEqual([]);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('returns the invoice with lines and per-project subtotals', async () => {
      const seed = await seedWeek({ status: 'closed' });
      const created = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);
      const acme = created.body.data[0];

      const response = await api().get(`/api/invoices/${acme.id}`).expect(200);
      const invoice = response.body.data;

      expect(invoice.number).toBe(acme.number);
      expect(invoice.currencySymbol).toBe('$');
      expect(invoice.periodStart).toBe(seed.startDate);
      expect(invoice.periodEnd).toBe(seed.endDate);
      expect(invoice.lines).toHaveLength(2);
      expect(invoice.lines[0]).toMatchObject({
        date: seed.startDate,
        projectName: 'E-Commerce Storefront',
        hours: 15.5,
        rate: 130,
        lineTotal: 2015,
      });
      expect(invoice.subtotals).toEqual([
        { projectId: seed.projectIds.ecommerce, projectName: 'E-Commerce Storefront', hours: 15.5, gross: 2015 },
        { projectId: seed.projectIds.api, projectName: 'API Microservice', hours: 2, gross: 260 },
      ]);
      // Subtotals must reconcile with the invoice total.
      expect(invoice.subtotals.reduce((sum: number, s: { gross: number }) => sum + s.gross, 0)).toBe(
        invoice.gross,
      );
    });

    it('404s for an unknown invoice', async () => {
      const response = await api().get('/api/invoices/9999').expect(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('400s for a non-numeric id', async () => {
      const response = await api().get('/api/invoices/abc').expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/invoices/:id/pdf', () => {
    it('streams a valid PDF with the contract filename', async () => {
      const seed = await seedWeek({ status: 'closed' });
      const created = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);
      const acme = created.body.data[0];

      const response = await getBinary(`/api/invoices/${acme.id}/pdf`).expect(200);
      const body = response.body as Buffer;

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain(
        `filename="${acme.number}-acme-corp.pdf"`,
      );
      expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(body.length).toBeGreaterThan(1000);
    });

    it('names the standalone bucket "no-client"', async () => {
      const seed = await seedWeek({ status: 'closed' });
      const created = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);
      const standalone = created.body.data[2];

      const response = await getBinary(`/api/invoices/${standalone.id}/pdf`).expect(200);

      expect(response.headers['content-disposition']).toContain('no-client.pdf');
    });
  });

  describe('GET /api/weeks/:id/invoices/zip', () => {
    it('archives one PDF per invoice', async () => {
      const seed = await seedWeek({ status: 'closed' });
      await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);

      const response = await getBinary(`/api/weeks/${seed.weekId}/invoices/zip`).expect(200);
      const body = response.body as Buffer;

      expect(response.headers['content-type']).toContain('application/zip');
      expect(response.headers['content-disposition']).toContain(
        `filename="invoices-week-${isoWeekOf(seed.startDate)}.zip"`,
      );
      expect(body.subarray(0, 4).toString('latin1')).toBe('PK\x03\x04');
      // Local file header signature per archived PDF.
      const entries = body.toString('latin1').split('PK\x03\x04').length - 1;
      expect(entries).toBe(3);
    });

    it('409s when the week is still open', async () => {
      const seed = await seedWeek({ status: 'open' });

      const response = await api().get(`/api/weeks/${seed.weekId}/invoices/zip`).expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });
  });

  describe('GET /api/invoices/:id/email', () => {
    it('returns a mailto draft, plain text and clipboard HTML', async () => {
      const seed = await seedWeek({ status: 'closed' });
      const created = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);
      const acme = created.body.data[0];

      const response = await api().get(`/api/invoices/${acme.id}/email`).expect(200);
      const draft = response.body.data;

      expect(draft.to).toBe('billing@acme.example');
      expect(draft.cc).toBe('finance@acme.example');
      expect(draft.subject).toContain(acme.number);
      expect(draft.subject).toContain('Acme Corp');
      expect(draft.truncated).toBe(false);
      expect(encodeURIComponent(draft.text).length).toBeLessThanOrEqual(MAILTO_BODY_LIMIT);

      expect(draft.mailto.startsWith('mailto:billing@acme.example?')).toBe(true);
      expect(draft.mailto).toContain('cc=finance%40acme.example');
      expect(draft.mailto).toContain('body=');

      expect(draft.text).toContain('E-Commerce Storefront');
      expect(draft.text).toContain('$2,252.25');
      expect(draft.html).toContain('<table');
      expect(draft.html).toContain('$2,252.25');
    });

    it('omits the cc parameter when the client has no cc address', async () => {
      const seed = await seedWeek({ status: 'closed' });
      const created = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);
      const starlight = created.body.data[1];

      const response = await api().get(`/api/invoices/${starlight.id}/email`).expect(200);

      expect(response.body.data.cc).toBeNull();
      expect(response.body.data.mailto).not.toContain('cc=');
    });

    it('hides rate, gross and fee by default and shows them once enabled in settings', async () => {
      const seed = await seedWeek({ status: 'closed' });
      const created = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);
      const acme = created.body.data[0];

      const hidden = (await api().get(`/api/invoices/${acme.id}/email`).expect(200)).body.data;
      expect(hidden.text).not.toMatch(/\bRate\b/);
      expect(hidden.text).not.toMatch(/^Gross/m);
      expect(hidden.text).not.toContain('Payoneer fee');
      expect(hidden.html).not.toContain('>Rate<');

      await api()
        .put('/api/settings')
        .send({ emailShowRate: true, emailShowGross: true, emailShowFee: true })
        .expect(200);

      const shown = (await api().get(`/api/invoices/${acme.id}/email`).expect(200)).body.data;
      expect(shown.text).toMatch(/\bRate\b/);
      expect(shown.text).toMatch(/^Gross\s+\$2,275\.00$/m);
      expect(shown.text).toContain('Payoneer fee');
      expect(shown.html).toContain('>Rate<');
    });
  });

  describe('contact name', () => {
    it('snapshots the client contact name and uses it in the email and invoice', async () => {
      const seed = await seedWeek({ status: 'closed' });
      await api()
        .patch(`/api/clients/${seed.acmeClientId}`)
        .send({ contactName: 'Jane Doe' })
        .expect(200);

      const created = await api().post(`/api/weeks/${seed.weekId}/invoices`).send().expect(201);
      const acme = created.body.data.find((row: { clientId: number | null }) => row.clientId === seed.acmeClientId);
      expect(acme.contactName).toBe('Jane Doe');

      // Renaming the contact later never rewrites an issued invoice.
      await api()
        .patch(`/api/clients/${seed.acmeClientId}`)
        .send({ contactName: 'John Smith' })
        .expect(200);

      const invoice = (await api().get(`/api/invoices/${acme.id}`).expect(200)).body.data;
      expect(invoice.contactName).toBe('Jane Doe');
      const draft = (await api().get(`/api/invoices/${acme.id}/email`).expect(200)).body.data;
      expect(draft.text.split('\n')[0]).toBe('Hi Jane Doe,');
    });
  });
});