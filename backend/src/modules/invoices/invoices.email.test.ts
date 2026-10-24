/**
 * Unit tests for the "Send as Email Text" composer (R12).
 *
 * The composer never sends mail — it produces a `mailto:` draft plus a
 * clipboard-ready HTML body. Pure functions, so every assertion is exact.
 */
import { describe, expect, it } from 'vitest';
import { buildEmailDraft, MAILTO_BODY_LIMIT, type EmailInput } from './invoices.email.js';
import type { InvoiceDto, InvoiceLineDto } from './invoices.types.js';

function line(overrides: Partial<InvoiceLineDto> = {}): InvoiceLineDto {
  return {
    id: 1,
    recordId: 1,
    date: '2026-10-19',
    projectId: 1,
    projectName: 'E-Commerce Storefront',
    description: 'Checkout flow rebuild',
    hours: 3.5,
    rate: 130,
    lineTotal: 455,
    ...overrides,
  };
}

function invoice(overrides: Partial<InvoiceDto> = {}): InvoiceDto {
  return {
    id: 1,
    number: 'INV-2026-001',
    weekId: 1,
    clientId: 1,
    clientName: 'Acme Corp',
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
    lines: [line()],
    subtotals: [{ projectId: 1, projectName: 'E-Commerce Storefront', hours: 17.5, gross: 2275 }],
    ...overrides,
  };
}

function input(overrides: Partial<EmailInput> = {}): EmailInput {
  return { invoice: invoice(), senderName: 'Alex Morgan', currencySymbol: '$', ...overrides };
}

describe('buildEmailDraft', () => {
  it('addresses the client and cc addresses', () => {
    const draft = buildEmailDraft(input());

    expect(draft.to).toBe('billing@acme.example');
    expect(draft.cc).toBe('finance@acme.example');
  });

  it('reports cc as null when the client has none', () => {
    const draft = buildEmailDraft(input({ invoice: invoice({ ccEmail: null }) }));

    expect(draft.cc).toBeNull();
    expect(draft.mailto).not.toContain('cc=');
  });

  it('builds the contract subject line', () => {
    expect(buildEmailDraft(input()).subject).toBe(
      'Invoice INV-2026-001 — Acme Corp — 19-10-2026 to 25-10-2026',
    );
  });

  it('groups the plain-text body by project with aligned columns', () => {
    const { text } = buildEmailDraft(input());

    expect(text).toContain('E-Commerce Storefront');
    expect(text).toContain('Mon, Oct 19');
    expect(text).toMatch(/3\.5\s+\$130\.00\s+\$455\.00/);
    // Numeric columns are right-aligned: the header label and the value it
    // describes end at the same offset.
    const rows = text.split('\n').filter((line) => line.includes('$455.00') || line.includes('Rate'));
    const rightEdge = (row: string | undefined, needle: string): number =>
      (row?.indexOf(needle) ?? -1) + needle.length;
    expect(rightEdge(rows[0], 'Rate')).toBe(rightEdge(rows[1], '$130.00'));
    expect(rightEdge(rows[0], 'Total')).toBe(rightEdge(rows[1], '$455.00'));
  });

  it('summarises gross, fee and net in the plain-text body', () => {
    const { text } = buildEmailDraft(input());

    expect(text).toContain('$2,275.00');
    expect(text).toContain('$22.75');
    expect(text).toContain('$2,252.25');
    expect(text).toContain('17.5');
  });

  it('renders one HTML table per project with inline, email-safe styles', () => {
    const { html } = buildEmailDraft(input());

    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('<td');
    expect(html).toMatch(/<td[^>]*style="[^"]*"/);
    expect(html).not.toContain('<style'); // no <style> blocks — Outlook strips them
    expect(html).toContain('$2,252.25');
  });

  it('escapes HTML metacharacters in descriptions', () => {
    const { html } = buildEmailDraft(
      input({
        invoice: invoice({
          lines: [line({ description: 'A & B <script>"quoted"</script>' })],
        }),
      }),
    );

    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('percent-encodes the mailto URL', () => {
    const draft = buildEmailDraft(input());

    expect(draft.mailto.startsWith('mailto:billing@acme.example?')).toBe(true);
    expect(draft.mailto).toContain('cc=finance%40acme.example');
    expect(draft.mailto).toContain('subject=');
    expect(draft.mailto).toContain('body=');
    // The raw em-dash and spaces must be encoded.
    expect(draft.mailto).not.toMatch(/subject=[^&]*[ —]/);
    const [, subject] = /subject=([^&]*)/.exec(draft.mailto) ?? [];
    expect(decodeURIComponent(subject ?? '')).toBe(draft.subject);
  });

  it('keeps a normal invoice untruncated', () => {
    const draft = buildEmailDraft(input());

    expect(draft.truncated).toBe(false);
    expect(draft.text).toContain('E-Commerce Storefront');
  });

  it('shortens an over-long body and flags truncated=true', () => {
    const lines = Array.from({ length: 80 }, (_, index) =>
      line({
        id: index + 1,
        recordId: index + 1,
        date: '2026-10-19',
        description: `Refactor billing ledger module number ${index} with a very long description`,
        hours: 1,
        lineTotal: 130,
      }),
    );
    const source = invoice({ lines, subtotals: [{ projectId: 1, projectName: 'E-Commerce Storefront', hours: 80, gross: 10400 }] });

    const draft = buildEmailDraft(input({ invoice: source }));

    expect(draft.truncated).toBe(true);
    expect(encodeURIComponent(draft.text).length).toBeLessThanOrEqual(MAILTO_BODY_LIMIT);
    expect(draft.text).toContain('E-Commerce Storefront');
    expect(draft.text).toContain('$10,400.00');
    expect(draft.text.toLowerCase()).toContain('pdf');
    // The full breakdown is not shipped inside a mailto link.
    expect(draft.text).not.toContain('Refactor billing ledger module number 79');
  });

  it('handles the standalone "No client" bucket', () => {
    const draft = buildEmailDraft(
      input({
        invoice: invoice({
          clientId: null,
          clientName: 'No client',
          contactEmail: '',
          ccEmail: null,
          platformCompany: null,
          feePercent: 0,
          feeFlat: 0,
          feeAmount: 0,
          net: 455,
        }),
      }),
    );

    expect(draft.to).toBe('');
    expect(draft.cc).toBeNull();
    expect(draft.subject).toContain('No client');
    expect(draft.text).toContain('No client');
  });
});