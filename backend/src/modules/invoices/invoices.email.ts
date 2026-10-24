/**
 * "Send as Email Text" (R12) — builds the `mailto:` draft and the
 * clipboard-ready HTML body for one invoice.
 *
 * Nothing is ever sent: SMTP is out of scope. The UI offers
 *   1. a `mailto:` link that opens the user's mail client, and
 *   2. "Copy formatted" which puts `html` on the clipboard.
 *
 * Pure module — no I/O, no network, no mail library.
 */
import { dayOfWeek, formatDisplayDate } from '../../lib/dates.js';
import { formatMoney, round2 } from '../../lib/money.js';
import type { InvoiceDto, InvoiceEmailDraftDto, InvoiceLineDto } from './invoices.types.js';

/**
 * Contract §4.7: a body whose percent-encoded form exceeds this is shortened
 * and flagged `truncated: true`, so a cut-off invoice is never silently mailed.
 */
export const MAILTO_BODY_LIMIT = 2000;

export interface EmailInput {
  invoice: InvoiceDto;
  senderName: string;
  currencySymbol: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** Plain-text column widths — fixed so every row lines up in any mail client. */
const COL = { date: 14, hours: 7, rate: 11, total: 13 } as const;
const TOTAL_LABEL_WIDTH = 26;

const TABLE_BASE_STYLE =
  'border-collapse:collapse;width:100%;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#1b1b1f;';
const TH_STYLE =
  'text-align:left;padding:6px 8px;border-bottom:2px solid #1b1b1f;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5b5b66;';
const TD_STYLE = 'padding:6px 8px;border-bottom:1px solid #e4e2e6;vertical-align:top;';
const RIGHT = 'text-align:right;';

interface ProjectBlock {
  projectId: number | null;
  projectName: string;
  lines: InvoiceLineDto[];
  hours: number;
  gross: number;
}

/** `2026-10-19` → `Mon, Oct 19` (contract §4.7 body format). */
function formatLineDate(iso: string): string {
  const [, month, day] = iso.split('-');
  const monthIndex = Number(month) - 1;
  const monthName = MONTHS[monthIndex] ?? month;
  return `${DAY_NAMES[dayOfWeek(iso)]}, ${monthName} ${Number(day)}`;
}

function formatHours(hours: number): string {
  return String(round2(hours));
}

function money(amount: number, symbol: string): string {
  return formatMoney(amount, symbol, { inCents: false });
}

function formatPercent(percent: number): string {
  return `${String(round2(percent))}%`;
}

/** Groups lines per project, preserving first-appearance order. */
function groupByProject(lines: readonly InvoiceLineDto[]): ProjectBlock[] {
  const blocks: ProjectBlock[] = [];
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

function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function padLeft(value: string, width: number): string {
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

function greeting(invoice: InvoiceDto): string {
  return invoice.clientId === null ? 'Hello,' : `Hi ${invoice.clientName} team,`;
}

function intro(invoice: InvoiceDto): string {
  const period = `${formatDisplayDate(invoice.periodStart)} to ${formatDisplayDate(invoice.periodEnd)}`;
  const billTo = invoice.clientId === null ? ' (No client — internal work)' : '';
  return `Please find invoice ${invoice.number}${billTo} covering ${period}.`;
}

function feeLabel(invoice: InvoiceDto): string {
  if (!invoice.platformCompany) return 'Platform fee';
  const parts = [formatPercent(invoice.feePercent)];
  if (invoice.feeFlat > 0) parts.push(`${money(invoice.feeFlat, invoice.currencySymbol)} flat`);
  return `${invoice.platformCompany} fee (${parts.join(' + ')})`;
}

function buildPlainText(invoice: InvoiceDto, senderName: string): string {
  const symbol = invoice.currencySymbol;
  const header =
    padRight('Date', COL.date) +
    padLeft('Hours', COL.hours) +
    padLeft('Rate', COL.rate) +
    padLeft('Total', COL.total);

  const sections = groupByProject(invoice.lines).map((block) => {
    const rows = block.lines.map(
      (line) =>
        padRight(formatLineDate(line.date), COL.date) +
        padLeft(formatHours(line.hours), COL.hours) +
        padLeft(money(line.rate, symbol), COL.rate) +
        padLeft(money(line.lineTotal, symbol), COL.total),
    );
    const subtotal =
      padRight(`Subtotal (${formatHours(block.hours)} h)`, COL.date + COL.hours) +
      padLeft('', COL.rate) +
      padLeft(money(block.gross, symbol), COL.total);

    return [`${block.projectName}`, '', header, ...rows, subtotal].join('\n');
  });

  const totals = [
    padRight(`Hours (${formatHours(invoice.totalHours)} h)`, TOTAL_LABEL_WIDTH) +
      padLeft(money(invoice.gross, symbol), 14),
    padRight('Gross', TOTAL_LABEL_WIDTH) + padLeft(money(invoice.gross, symbol), 14),
    padRight(feeLabel(invoice), TOTAL_LABEL_WIDTH) +
      padLeft(`-${money(invoice.feeAmount, symbol)}`, 14),
    padRight('Net due', TOTAL_LABEL_WIDTH) + padLeft(money(invoice.net, symbol), 14),
  ];

  return [
    greeting(invoice),
    '',
    intro(invoice),
    '',
    ...sections.flatMap((section) => [section, '']),
    'TOTALS',
    '',
    ...totals,
    '',
    'Full itemised breakdown in the attached PDF.',
    '',
    'Thanks,',
    senderName,
  ].join('\n');
}

/** Totals-only body used when the mailto body would exceed the length limit. */
function buildShortText(invoice: InvoiceDto, senderName: string): string {
  const symbol = invoice.currencySymbol;
  const lines = groupByProject(invoice.lines).map(
    (block) =>
      padRight(`${block.projectName} (${formatHours(block.hours)} h)`, TOTAL_LABEL_WIDTH + 6) +
      padLeft(money(block.gross, symbol), 14),
  );

  return [
    greeting(invoice),
    '',
    intro(invoice),
    '',
    ...lines,
    '',
    padRight('Gross', TOTAL_LABEL_WIDTH) + padLeft(money(invoice.gross, symbol), 14),
    padRight(feeLabel(invoice), TOTAL_LABEL_WIDTH) +
      padLeft(`-${money(invoice.feeAmount, symbol)}`, 14),
    padRight('Net due', TOTAL_LABEL_WIDTH) + padLeft(money(invoice.net, symbol), 14),
    '',
    'Full line-by-line breakdown in the attached PDF — or use "Copy formatted" to paste a table.',
    '',
    'Thanks,',
    senderName,
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function projectTable(block: ProjectBlock, symbol: string): string {
  const header =
    `<tr><th style="${TH_STYLE}">Date</th>` +
    `<th style="${TH_STYLE}${RIGHT}">Hours</th>` +
    `<th style="${TH_STYLE}${RIGHT}">Rate</th>` +
    `<th style="${TH_STYLE}${RIGHT}">Total</th></tr>`;

  const rows = block.lines
    .map(
      (line) =>
        '<tr>' +
        `<td style="${TD_STYLE}">${escapeHtml(formatLineDate(line.date))}<br>` +
        `<span style="color:#5b5b66">${escapeHtml(line.description)}</span></td>` +
        `<td style="${TD_STYLE}${RIGHT}">${escapeHtml(formatHours(line.hours))}</td>` +
        `<td style="${TD_STYLE}${RIGHT}">${escapeHtml(money(line.rate, symbol))}</td>` +
        `<td style="${TD_STYLE}${RIGHT}">${escapeHtml(money(line.lineTotal, symbol))}</td>` +
        '</tr>',
    )
    .join('');

  const subtotal =
    `<tr><td colspan="3" style="${TD_STYLE}${RIGHT};font-weight:700;border-bottom:none">` +
    `Subtotal (${escapeHtml(formatHours(block.hours))} h)</td>` +
    `<td style="${TD_STYLE}${RIGHT};font-weight:700;border-bottom:none">` +
    `${escapeHtml(money(block.gross, symbol))}</td></tr>`;

  return (
    `<table cellpadding="0" cellspacing="0" border="0" style="${TABLE_BASE_STYLE}">` +
    `<thead>${header}</thead><tbody>${rows}</tbody><tfoot>${subtotal}</tfoot></table>`
  );
}

function totalsTable(invoice: InvoiceDto): string {
  const symbol = invoice.currencySymbol;
  const row = (label: string, value: string, strong = false) => {
    const weight = strong ? 'font-weight:700;' : '';
    return (
      `<tr><td style="padding:4px 8px;${weight}color:#5b5b66">${escapeHtml(label)}</td>` +
      `<td style="padding:4px 8px;${RIGHT}${weight}">${escapeHtml(value)}</td></tr>`
    );
  };

  return (
    `<table cellpadding="0" cellspacing="0" border="0" style="${TABLE_BASE_STYLE}max-width:420px">` +
    '<tbody>' +
    row('Hours', formatHours(invoice.totalHours)) +
    row('Gross', money(invoice.gross, symbol)) +
    row(feeLabel(invoice), `-${money(invoice.feeAmount, symbol)}`) +
    row('Net due', money(invoice.net, symbol), true) +
    '</tbody></table>'
  );
}

function buildHtml(invoice: InvoiceDto, senderName: string): string {
  const blocks = groupByProject(invoice.lines)
    .map(
      (block) =>
        `<p style="margin:16px 0 4px;font-weight:700;font-size:13px">${escapeHtml(block.projectName)}</p>` +
        projectTable(block, invoice.currencySymbol),
    )
    .join('');

  return (
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
    'font-size:14px;color:#1b1b1f;max-width:720px">' +
    `<p>${escapeHtml(greeting(invoice))}</p>` +
    `<p>${escapeHtml(intro(invoice))}</p>` +
    blocks +
    '<p style="margin:20px 0 6px;font-weight:700;font-size:11px;letter-spacing:.04em;' +
    `text-transform:uppercase;color:#5b5b66">Totals</p>` +
    totalsTable(invoice) +
    '<p style="margin:16px 0 0;color:#5b5b66;font-size:12px">Full itemised breakdown in the attached PDF.</p>' +
    `<p style="margin:16px 0 0">Thanks,<br>${escapeHtml(senderName)}</p>` +
    '</div>'
  );
}

function buildMailto(to: string, cc: string | null, subject: string, body: string): string {
  const ccParam = cc ? `cc=${encodeURIComponent(cc)}&` : '';
  return `mailto:${to}?${ccParam}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Builds the complete R12 email draft for one invoice. */
export function buildEmailDraft(input: EmailInput): InvoiceEmailDraftDto {
  const { invoice, senderName } = input;
  const subject = `Invoice ${invoice.number} — ${invoice.clientName} — ${formatDisplayDate(
    invoice.periodStart,
  )} to ${formatDisplayDate(invoice.periodEnd)}`;

  const fullText = buildPlainText(invoice, senderName);
  const truncated = encodeURIComponent(fullText).length > MAILTO_BODY_LIMIT;
  const text = truncated ? buildShortText(invoice, senderName) : fullText;

  return {
    to: invoice.contactEmail,
    cc: invoice.ccEmail,
    subject,
    text,
    // "Copy formatted" has no length limit, so it always carries the full table.
    html: buildHtml(invoice, senderName),
    mailto: buildMailto(invoice.contactEmail, invoice.ccEmail, subject, text),
    truncated,
  };
}