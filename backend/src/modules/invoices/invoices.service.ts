/**
 * Service layer — invoicing business rules (R9–R12).
 *
 * Owns the closed-week precondition, idempotency, invoice numbering and the
 * snapshotting of client-facing values. All money maths is delegated to the
 * pure engine; this class only orchestrates persistence and error mapping.
 *
 * Services receive their repository through the constructor so unit tests can
 * substitute a fake without touching Postgres.
 */
import { isoWeekNumber } from '../../lib/dates.js';
import { ConflictError, NotFoundError } from '../../lib/http.js';
import { invoicesZipFileName } from '../../lib/pdf/invoice-pdf.js';
import { buildEmailDraft } from './invoices.email.js';
import { buildInvoiceDrafts, buildWarnings, type EngineDraft } from './invoices.engine.js';
import type { InvoicesRepository } from './invoices.repository.js';
import type {
  InvoiceDto,
  InvoiceEmailDraftDto,
  InvoicePreviewDto,
  InvoicePreviewRowDto,
} from './invoices.types.js';

export interface GenerateResult {
  invoices: InvoiceDto[];
  /** `false` when the week was already invoiced — the call was a no-op (idempotent). */
  created: boolean;
}

/** Invoice numbers are `{prefix}-{YYYY}-{NNN}`, sequential within a calendar year. */
export function formatInvoiceNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(3, '0')}`;
}

function toPreviewRow(draft: EngineDraft): InvoicePreviewRowDto {
  return {
    clientId: draft.clientId,
    clientName: draft.clientName,
    contactName: draft.contactName,
    contactEmail: draft.contactEmail,
    ccEmail: draft.ccEmail,
    platformCompany: draft.platformCompany,
    feePercent: draft.feePercent,
    feeFlat: draft.feeFlat,
    totalHours: draft.totalHours,
    gross: draft.gross,
    feeAmount: draft.feeAmount,
    net: draft.net,
    lines: draft.lines.map((line) => ({
      recordId: line.recordId,
      date: line.date,
      projectId: line.projectId,
      projectName: line.projectName,
      description: line.description,
      hours: line.hours,
      rate: line.rate,
      lineTotal: line.lineTotal,
    })),
    subtotals: draft.subtotals,
  };
}

export class InvoicesService {
  constructor(private readonly repository: InvoicesRepository) {}

  /**
   * Computes what *would* be invoiced without writing anything — safe on open
   * weeks, which is where the R8 below-target banner is surfaced.
   */
  async preview(weekId: number): Promise<InvoicePreviewDto> {
    const source = await this.repository.readWeekSource(weekId);
    if (!source) throw new NotFoundError(`Week ${weekId} not found`);

    const weekNumber = isoWeekNumber(source.week.startDate);
    const { drafts, totals } = buildInvoiceDrafts({
      records: source.records,
      clients: source.clients,
      settings: source.settings,
    });

    return {
      weekId,
      periodStart: source.periodStart,
      periodEnd: source.periodEnd,
      status: source.week.status,
      canGenerate: source.week.status === 'closed',
      currencySymbol: source.settings.currencySymbol,
      totals,
      warnings: buildWarnings({ weekNumber, status: source.week.status, totals }),
      invoices: drafts.map(toPreviewRow),
    };
  }

  /**
   * Generates the week's invoices. Closed weeks only; idempotent — a second call
   * returns the invoices issued by the first one and reports `created: false`.
   * The whole write runs in one transaction guarded by a row lock on the week.
   */
  async generate(weekId: number): Promise<GenerateResult> {
    const source = await this.repository.readWeekSource(weekId);
    if (!source) throw new NotFoundError(`Week ${weekId} not found`);

    const weekNumber = isoWeekNumber(source.week.startDate);
    if (source.week.status === 'open') {
      throw new ConflictError(`Close week ${weekNumber} before generating invoices`);
    }
    if (source.records.length === 0) {
      throw new ConflictError(`Week ${weekNumber} has no records to invoice`);
    }

    return this.repository.runInTransaction(async (transactional) => {
      await transactional.lockWeek(weekId);

      const existing = await transactional.listByWeek(weekId);
      if (existing.length > 0) return { invoices: existing, created: false };

      const { drafts } = buildInvoiceDrafts({
        records: source.records,
        clients: source.clients,
        settings: source.settings,
      });

      const year = Number(source.periodStart.slice(0, 4));
      let sequence = await transactional.readLastSequence(source.settings.invoicePrefix, year);

      for (const draft of drafts) {
        sequence += 1;
        const number = formatInvoiceNumber(source.settings.invoicePrefix, year, sequence);
        // Every client-facing value is frozen here, so renaming a client or
        // changing their rate later never rewrites history.
        const inserted = await transactional.insertInvoice({
          number,
          weekId,
          clientId: draft.clientId,
          clientNameSnapshot: draft.clientName,
          contactNameSnapshot: draft.contactName,
          contactEmailSnapshot: draft.contactEmail,
          ccEmailSnapshot: draft.ccEmail,
          platformCompanySnapshot: draft.platformCompany,
          feePercent: draft.feePercent,
          feeFlat: draft.feeFlat,
          totalHours: draft.totalHours,
          gross: draft.gross,
          feeAmount: draft.feeAmount,
          net: draft.net,
        });

        await transactional.insertLines(
          draft.lines.map((line) => ({
            invoiceId: inserted.id,
            recordId: line.recordId,
            date: line.date,
            projectId: line.projectId,
            projectNameSnapshot: line.projectName,
            description: line.description,
            hours: line.hours,
            rate: line.rate,
            lineTotal: line.lineTotal,
          })),
        );
      }

      return { invoices: await transactional.listByWeek(weekId), created: true };
    });
  }

  async listByWeek(weekId: number): Promise<InvoiceDto[]> {
    const week = await this.repository.findWeek(weekId);
    if (!week) throw new NotFoundError(`Week ${weekId} not found`);
    return this.repository.listByWeek(weekId);
  }

  async getById(invoiceId: number): Promise<InvoiceDto> {
    const invoice = await this.repository.findById(invoiceId);
    if (!invoice) throw new NotFoundError(`Invoice ${invoiceId} not found`);
    return invoice;
  }

  /** R12 draft — never sends mail, only prepares it. */
  async buildEmailDraftFor(invoiceId: number): Promise<InvoiceEmailDraftDto> {
    const invoice = await this.getById(invoiceId);
    const settings = await this.repository.readSettings();

    return buildEmailDraft({
      invoice,
      senderName: settings.displayName,
      currencySymbol: settings.currencySymbol,
      options: settings.emailOptions,
    });
  }

  /** Issuer name printed on the PDF. */
  async senderName(): Promise<string> {
    return (await this.repository.readSettings()).displayName;
  }

  /**
   * Everything the "download all" archive needs: the week's invoices, the
   * issuer name and the archive filename. An open or un-invoiced week is a
   * conflict — there is nothing to download yet.
   */
  async prepareWeekArchive(weekId: number): Promise<{
    invoices: InvoiceDto[];
    senderName: string;
    fileName: string;
  }> {
    const week = await this.repository.findWeek(weekId);
    if (!week) throw new NotFoundError(`Week ${weekId} not found`);

    const weekNumber = isoWeekNumber(week.startDate);
    if (week.status === 'open') {
      throw new ConflictError(`Close week ${weekNumber} before downloading invoices`);
    }

    const invoices = await this.repository.listByWeek(weekId);
    if (invoices.length === 0) {
      throw new ConflictError(`Week ${weekNumber} has no invoices to download`);
    }

    return {
      invoices,
      senderName: await this.senderName(),
      fileName: invoicesZipFileName(weekNumber),
    };
  }
}