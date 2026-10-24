/**
 * Server-side PDF rendering (R11) with **pdfmake** — no headless Chromium, no
 * network access, no font files on disk.
 *
 * Uses the PDF standard-14 Helvetica face: every viewer has it, so the runtime
 * image stays small and the output opens anywhere. Content is exactly what R10
 * requires — issuer header, invoice number, billing period, bill-to, payment
 * platform, a per-project line-item table with subtotals, then gross / fee / net.
 */
import pdfmake from 'pdfmake/js/index.js';
import Helvetica from 'pdfmake/standard-fonts/Helvetica.js';
import { formatDisplayDate, formatLongDate } from '../dates.js';
import { formatMoney, round2 } from '../money.js';
import type { InvoiceDto, InvoiceLineDto } from '../../modules/invoices/invoices.types.js';

const FONT = 'Helvetica';
const INK = '#1b1b1f';
const MUTED = '#5b5b66';
const RULE = '#e4e2e6';
const PAGE_MARGIN = 40;
const TABLE_WIDTHS: (string | number)[] = [64, '*', 46, 54, 66];

export interface InvoicePdfInput {
  invoice: InvoiceDto;
  senderName: string;
}

type Cell = string | { text: string; bold?: boolean; alignment?: 'left' | 'right' | 'center'; color?: string; fontSize?: number };

let fontsReady = false;

/** Registers the standard-14 font once and locks down all external access. */
function ensureFonts(): void {
  if (fontsReady) return;
  pdfmake.addFonts(Helvetica);

  // The standard-14 faces are PostScript names resolved by the PDF writer, not
  // files — they must pass the local-access policy. Everything else (a real
  // filesystem path, a font file, an image) is denied, so a document definition
  // can never read from the host. Remote resources are denied outright.
  const standardFaces = new Set(
    Object.values(Helvetica).flatMap((faces) => Object.values(faces)),
  );
  pdfmake.setLocalAccessPolicy((name: string) => standardFaces.has(name));
  pdfmake.setUrlAccessPolicy(() => false);
  fontsReady = true;
}

const money = (amount: number, symbol: string): string =>
  formatMoney(amount, symbol, { inCents: false });

const hours = (value: number): string => String(round2(value));

function groupByProject(lines: readonly InvoiceLineDto[]): Array<{
  projectId: number | null;
  projectName: string;
  lines: InvoiceLineDto[];
  hours: number;
  gross: number;
}> {
  const blocks: Array<{
    projectId: number | null;
    projectName: string;
    lines: InvoiceLineDto[];
    hours: number;
    gross: number;
  }> = [];
  const indexByProject = new Map<string, number>();

  for (const line of lines) {
    const key = line.projectId === null ? `name:${line.projectName}` : `id:${line.projectId}`;
    const index = indexByProject.get(key);
    if (index === undefined) {
      indexByProject.set(key, blocks.length);
      blocks.push({
        projectId: line.projectId,
        projectName: line.projectName,
        lines: [line],
        hours: line.hours,
        gross: line.lineTotal,
      });
      continue;
    }
    const current = blocks[index];
    if (!current) continue;
    blocks[index] = {
      ...current,
      lines: [...current.lines, line],
      hours: round2(current.hours + line.hours),
      gross: round2(current.gross + line.lineTotal),
    };
  }
  return blocks;
}

function headerRow(): Cell[] {
  const style = { bold: true, color: MUTED, fontSize: 7.5 };
  return [
    { text: 'DATE', ...style },
    { text: 'DESCRIPTION', ...style },
    { text: 'HOURS', ...style, alignment: 'right' },
    { text: 'RATE', ...style, alignment: 'right' },
    { text: 'TOTAL', ...style, alignment: 'right' },
  ];
}

function projectTable(
  block: ReturnType<typeof groupByProject>[number],
  symbol: string,
): unknown[] {
  const body: Cell[][] = [headerRow()];

  for (const line of block.lines) {
    body.push([
      { text: formatLongDate(line.date) },
      { text: line.description },
      { text: hours(line.hours), alignment: 'right' },
      { text: money(line.rate, symbol), alignment: 'right' },
      { text: money(line.lineTotal, symbol), alignment: 'right' },
    ]);
  }

  const strong = { bold: true, alignment: 'right' as const };
  body.push([
    { text: `Subtotal — ${hours(block.hours)} h`, alignment: 'right' },
    '',
    '',
    '',
    { text: money(block.gross, symbol), ...strong },
  ]);

  return [
    { text: block.projectName, bold: true, fontSize: 10, margin: [0, 10, 0, 4] },
    {
      table: { widths: TABLE_WIDTHS, body },
      layout: {
        hLineWidth: (i: number) => (i === 0 ? 1 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => RULE,
        paddingTop: () => 4,
        paddingBottom: () => 4,
        paddingLeft: () => 0,
        paddingRight: () => 6,
      },
    },
  ];
}

function totalsTable(input: InvoicePdfInput): unknown {
  const { invoice } = input;
  const symbol = invoice.currencySymbol;
  const rows: Cell[][] = [
    [
      { text: 'Hours', color: MUTED, alignment: 'left' },
      { text: hours(invoice.totalHours), alignment: 'right' },
    ],
    [
      { text: 'Gross subtotal', color: MUTED, alignment: 'left' },
      { text: money(invoice.gross, symbol), alignment: 'right' },
    ],
    [
      {
        text: feeDescription(invoice),
        color: MUTED,
        alignment: 'left',
      },
      { text: `-${money(invoice.feeAmount, symbol)}`, alignment: 'right' },
    ],
    [
      { text: 'Net due', bold: true, fontSize: 11, alignment: 'left' },
      { text: money(invoice.net, symbol), bold: true, fontSize: 11, alignment: 'right' },
    ],
  ];

  return {
    table: { widths: [220, 90], body: rows },
    layout: 'noBorders',
    margin: [0, 12, 0, 0],
  };
}

function feeDescription(invoice: InvoiceDto): string {
  if (!invoice.platformCompany) return 'Platform fee (absorbed)';
  const flat = invoice.feeFlat > 0 ? ` + ${money(invoice.feeFlat, invoice.currencySymbol)} flat` : '';
  return `${invoice.platformCompany} fee (${String(round2(invoice.feePercent))}%${flat}, absorbed)`;
}

/** The pdfmake document definition — exported so it can be asserted in unit tests. */
export function buildInvoiceDocDefinition(input: InvoicePdfInput): unknown {
  const { invoice, senderName } = input;
  const content: unknown[] = [
    {
      columns: [
        { text: senderName, bold: true, fontSize: 15, color: INK },
        {
          text: [
            { text: 'INVOICE\n', bold: true, fontSize: 15, color: INK },
            { text: invoice.number, fontSize: 11, color: MUTED },
          ],
          alignment: 'right',
        },
      ],
    },
    {
      canvas: [
        { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: RULE },
      ],
      margin: [0, 8, 0, 12],
    },
    {
      columns: [
        {
          stack: [
            { text: 'BILL TO', style: 'label' },
            { text: invoice.clientName, bold: true, fontSize: 10 },
            { text: invoice.contactEmail, style: 'muted' },
            ...(invoice.ccEmail ? [{ text: `cc: ${invoice.ccEmail}`, style: 'muted' }] : []),
          ],
        },
        {
          stack: [
            { text: 'BILLING PERIOD', style: 'label' },
            {
              text: `${formatDisplayDate(invoice.periodStart)} – ${formatDisplayDate(invoice.periodEnd)}`,
            },
            { text: `${formatLongDate(invoice.periodStart)} to ${formatLongDate(invoice.periodEnd)}`, style: 'muted' },
          ],
        },
        {
          stack: [
            { text: 'PAYMENT PLATFORM', style: 'label' },
            { text: invoice.platformCompany ?? '—' },
            { text: feeDescription(invoice), style: 'muted' },
          ],
        },
      ],
    },
    { text: '', margin: [0, 6, 0, 0] },
  ];

  if (invoice.lines.length === 0) {
    content.push({ text: 'No line items.', style: 'muted', margin: [0, 12, 0, 0] });
  } else {
    for (const block of groupByProject(invoice.lines)) {
      content.push(...projectTable(block, invoice.currencySymbol));
    }
  }

  content.push(totalsTable(input));
  content.push({
    text: 'The platform fee above is absorbed by the freelancer and is not charged to the client.',
    style: 'muted',
    margin: [0, 12, 0, 0],
  });

  return {
    pageSize: 'A4',
    pageMargins: [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN + 10],
    defaultStyle: { font: FONT, fontSize: 9, color: INK, lineHeight: 1.15 },
    styles: {
      label: { fontSize: 7.5, bold: true, color: MUTED, characterSpacing: 0.4 },
      muted: { fontSize: 8, color: MUTED },
    },
    content,
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${invoice.number} · ${invoice.clientName}`, style: 'muted' },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', style: 'muted' },
      ],
      margin: [PAGE_MARGIN, 8, PAGE_MARGIN, 0],
    }),
  };
}

/** Renders the invoice and resolves to the raw PDF bytes. */
export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  ensureFonts();
  return pdfmake.createPdf(buildInvoiceDocDefinition(input)).getBuffer();
}

/**
 * Contract §4.5 filename: `INV-2026-001-acme-corp.pdf`.
 * The number is kept verbatim; the client name is slugified
 * (lowercased, non-alphanumerics collapsed to `-`). Standalone work → `no-client`.
 */
export function invoiceFileName(invoice: Pick<InvoiceDto, 'number' | 'clientId' | 'clientName'>): string {
  const slug = invoice.clientId === null ? 'no-client' : invoice.clientName;
  const safe = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${invoice.number}-${safe || 'no-client'}.pdf`;
}

/** Filename for the "download all" archive (contract §4.6). */
export function invoicesZipFileName(weekNumber: number): string {
  return `invoices-week-${weekNumber}.zip`;
}