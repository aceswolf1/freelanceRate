/**
 * Service layer for the earnings report (R13).
 *
 * Resolves the date range (defaulting to the earliest / latest record), reads the
 * records once, and hands them to the pure engine. No business arithmetic here.
 */
import { todayIso } from '../../lib/dates.js';
import { ValidationError } from '../../lib/http.js';
import { buildEarningsReport } from './reports.engine.js';
import type { ReportsRepository } from './reports.repository.js';
import type { EarningsGroupBy, EarningsReportDto } from './reports.types.js';

export interface EarningsQueryInput {
  from?: string | undefined;
  to?: string | undefined;
  groupBy?: EarningsGroupBy | undefined;
}

export class ReportsService {
  constructor(private readonly repository: ReportsRepository) {}

  async earnings(query: EarningsQueryInput): Promise<EarningsReportDto> {
    const groupBy = query.groupBy ?? 'project';
    const range = await this.resolveRange(query);
    const [records, currencySymbol] = await Promise.all([
      this.repository.readRecords(range.from, range.to),
      this.repository.readCurrencySymbol(),
    ]);

    return buildEarningsReport({
      records,
      from: range.from,
      to: range.to,
      groupBy,
      currencySymbol,
    });
  }

  /**
   * `from` / `to` default to the earliest and latest record dates. With no
   * records at all the range collapses to today, so the response always carries
   * a real, well-formed date pair.
   */
  private async resolveRange(query: EarningsQueryInput): Promise<{ from: string; to: string }> {
    const needsBounds = !query.from || !query.to;
    const bounds = needsBounds ? await this.repository.readBounds() : { from: null, to: null };

    const from = query.from ?? bounds.from ?? todayIso();
    const to = query.to ?? bounds.to ?? todayIso();

    if (from > to) {
      throw new ValidationError('Validation failed', [
        { path: 'from', message: `from (${from}) must not be after to (${to})` },
      ]);
    }

    return { from, to };
  }
}