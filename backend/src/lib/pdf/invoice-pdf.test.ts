/**
 * Unit tests for PDF rendering and archive naming (contract §4.5–§4.6, R10/R11).
 *
 * Asserting on the document definition covers what the binary cannot be asked
 * for reliably (PDF text is compressed), and a real render proves the output is
 * a genuine PDF rather than an empty buffer.
 */
import { describe, expect, it } from 'vitest';
import {
  buildInvoiceDocDefinition,
  invoiceFileName,
  invoicesZipFileName,
  renderInvoicePdf,
} from './invoice-pdf.js';
import type { InvoiceDto } from '../../modules/invoices/invoices.types.js';

function invoice(overrides: Partial<InvoiceDto> = {}): InvoiceDto {
  return {
    id: 1,
    number: 'INV-2026-001',
    weekId: 1,
    clientId: 1,
    clientName: 'Acme Corp',
    contactName: null,
    contactEmail: 'billing@acme.example',
    ccEmail: 'finance@acme.example',
    platformCompany: 'Payoneer',
    feePercent: 1,
    feeFlat: 0,
    totalHours: 17.5,
    gross: 2275,
    feeAmount: 22.75,
    net: 2252.25,
    currencySymbol: '$',
    periodStart: '2026-10-19',
    periodEnd: '2026-10-25',
    createdAt: '2026-10-26T09:00:00.000Z',
    lines: [
      {
        id: 1,
        recordId: 1,
        date: '2026-10-19',
        projectId: 1,
        projectName: 'E-Commerce Storefront',
        description: 'Checkout flow rebuild',
        hours: 15.5,
        rate: 130,
        lineTotal: 2015,
      },
      {
        id: 2,
        recordId: 2,
        date: '2026-10-20',
        projectId: 2,
        projectName: 'API Microservice',
        description: 'Rate-limit middleware',
        hours: 2,
        rate: 130,
        lineTotal: 260,
      },
    ],
    subtotals: [],
    ...overrides,
  };
}

/** Flattens every string reachable in the document definition. */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectStrings(entry, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

describe('invoiceFileName', () => {
  it('matches the contract example', () => {
    expect(invoiceFileName(invoice())).toBe('INV-2026-001-acme-corp.pdf');
  });

  it('uses no-client for the standalone bucket', () => {
    expect(invoiceFileName(invoice({ clientId: null, clientName: 'No client' }))).toBe(
      'INV-2026-001-no-client.pdf',
    );
  });

  it('collapses punctuation and separators in the client name', () => {
    expect(invoiceFileName(invoice({ clientName: "O'Brien & Sons — Ltd." }))).toBe(
      'INV-2026-001-o-brien-sons-ltd.pdf',
    );
  });
});

describe('invoicesZipFileName', () => {
  it('names the archive after the ISO week number', () => {
    expect(invoicesZipFileName(43)).toBe('invoices-week-43.zip');
  });
});

describe('buildInvoiceDocDefinition', () => {
  it('carries the issuer, invoice number, period, bill-to and platform', () => {
    const text = collectStrings(
      buildInvoiceDocDefinition({ invoice: invoice(), senderName: 'Alex Morgan' }),
    ).join(' | ');

    expect(text).toContain('Alex Morgan');
    expect(text).toContain('INV-2026-001');
    expect(text).toContain('BILL TO');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('billing@acme.example');
    expect(text).toContain('cc: finance@acme.example');
    expect(text).toContain('BILLING PERIOD');
    expect(text).toContain('19-10-2026 – 25-10-2026');
    expect(text).toContain('PAYMENT PLATFORM');
    expect(text).toContain('Payoneer');
  });

  it('prints the contact name under the bill-to client when set', () => {
    const strings = collectStrings(
      buildInvoiceDocDefinition({ invoice: invoice({ contactName: 'Jane Doe' }), senderName: 'Alex Morgan' }),
    );

    expect(strings).toContain('Attn: Jane Doe');
    expect(strings.indexOf('Attn: Jane Doe')).toBeGreaterThan(strings.indexOf('Acme Corp'));
    expect(strings.indexOf('Attn: Jane Doe')).toBeLessThan(strings.indexOf('billing@acme.example'));
  });

  it('omits the attention line without a contact name', () => {
    const text = collectStrings(
      buildInvoiceDocDefinition({ invoice: invoice(), senderName: 'Alex Morgan' }),
    ).join(' | ');

    expect(text).not.toContain('Attn:');
  });

  it('renders one table per project plus project subtotals (R10)', () => {
    const definition = buildInvoiceDocDefinition({ invoice: invoice(), senderName: 'Alex Morgan' });
    const text = collectStrings(definition).join(' | ');

    expect(text).toContain('E-Commerce Storefront');
    expect(text).toContain('API Microservice');
    expect(text).toContain('Checkout flow rebuild');
    expect(text).toContain('Oct 19, 2026');
    expect(text).toContain('Subtotal — 15.5 h');
    expect(text).toContain('$2,015.00');
    expect(text).toContain('$260.00');
  });

  it('renders gross, the absorbed fee and net', () => {
    const text = collectStrings(
      buildInvoiceDocDefinition({ invoice: invoice(), senderName: 'Alex Morgan' }),
    ).join(' | ');

    expect(text).toContain('Gross subtotal');
    expect(text).toContain('$2,275.00');
    expect(text).toContain('$22.75');
    expect(text).toContain('-$22.75');
    expect(text).toContain('Net due');
    expect(text).toContain('$2,252.25');
    expect(text).toContain('absorbed');
  });

  it('describes a flat fee and a missing platform', () => {
    const text = collectStrings(
      buildInvoiceDocDefinition({
        invoice: invoice({ platformCompany: null, feePercent: 0, feeFlat: 0, feeAmount: 0, net: 2275 }),
        senderName: 'Alex Morgan',
      }),
    ).join(' | ');

    expect(text).toContain('Platform fee (absorbed)');

    const flat = collectStrings(
      buildInvoiceDocDefinition({
        invoice: invoice({ platformCompany: 'Domestic Wire', feePercent: 0, feeFlat: 15 }),
        senderName: 'Alex Morgan',
      }),
    ).join(' | ');
    expect(flat).toContain('Domestic Wire fee (0% + $15.00 flat, absorbed)');
  });

  it('handles an invoice with no line items', () => {
    const text = collectStrings(
      buildInvoiceDocDefinition({ invoice: invoice({ lines: [] }), senderName: 'Alex Morgan' }),
    ).join(' | ');

    expect(text).toContain('No line items.');
  });
});

describe('renderInvoicePdf', () => {
  it('produces a real PDF', async () => {
    const buffer = await renderInvoicePdf({ invoice: invoice(), senderName: 'Alex Morgan' });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('renders an invoice with no lines without throwing', async () => {
    const buffer = await renderInvoicePdf({
      invoice: invoice({ lines: [], clientId: null, clientName: 'No client' }),
      senderName: 'Alex Morgan',
    });

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});