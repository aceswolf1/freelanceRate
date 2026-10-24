import { ConflictError, NotFoundError, WeekClosedError } from '../../lib/http.js';
import {
  addDays,
  dayOfWeek,
  isoWeekNumber,
  todayIso,
  weekDays,
  weekStart,
  weekTitle,
} from '../../lib/dates.js';
import { fromCents, roundHours, sumCents, toCents } from '../../lib/money.js';
import type { RecordContextRow, WorkRecordDTO } from '../records/record-context.js';
import { toWorkRecordDTO } from '../records/record-context.js';
import type { SettingsService } from '../settings/settings.service.js';
import type { WeekRow, WeeksRepository } from './weeks.repository.js';

export interface WeekProjectTotal {
  projectId: number;
  projectName: string;
  clientId: number | null;
  clientName: string | null;
  rate: number;
  hours: number;
  gross: number;
}

export interface WeekClientTotal {
  clientId: number | null;
  clientName: string | null;
  hours: number;
  gross: number;
}

export interface WeekTotals {
  totalHours: number;
  projectedGross: number;
  targetHours: number;
  belowTarget: boolean;
  hoursBelowTarget: number;
  clientCount: number;
  recordCount: number;
  byProject: WeekProjectTotal[];
  byClient: WeekClientTotal[];
}

export interface WeekDay {
  date: string;
  dayName: string;
  dayOfWeek: number;
  isWeekend: boolean;
  hours: number;
  projectedGross: number;
  records: WorkRecordDTO[];
}

export interface WeekDTO {
  id: number;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  label: string;
  isoWeek: number;
  invoiceCount: number;
  totals: WeekTotals;
  days: WeekDay[];
}

export interface WeekStatusDTO {
  id: number;
  status: 'open' | 'closed';
  closedAt: string | null;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Postgres unique-violation code — raised when two requests create the same week. */
const UNIQUE_VIOLATION = '23505';

function sumHours(records: readonly WorkRecordDTO[]): number {
  return roundHours(records.reduce((total, record) => total + record.hours, 0));
}

/** Sum in integer cents, then convert once — no floating-point drift. */
function sumGross(records: readonly WorkRecordDTO[]): number {
  return fromCents(sumCents(records.map((record) => toCents(record.lineTotal))));
}

function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

/** Biggest earners first, ties broken by name for a stable UI order. */
function byGrossThenName<T extends { gross: number }>(rows: T[], nameOf: (row: T) => string): T[] {
  return [...rows].sort(
    (a, b) => b.gross - a.gross || nameOf(a).localeCompare(nameOf(b)),
  );
}

function projectTotals(records: readonly WorkRecordDTO[]): WeekProjectTotal[] {
  const rows = [...groupBy(records, (record) => record.projectId)].map(([projectId, group]) => {
    const first = group[0] as WorkRecordDTO;
    return {
      projectId,
      projectName: first.project?.name ?? `Project ${projectId}`,
      clientId: first.clientId,
      clientName: first.client?.name ?? null,
      rate: first.rate,
      hours: sumHours(group),
      gross: sumGross(group),
    };
  });
  return byGrossThenName(rows, (row) => row.projectName);
}

function clientTotals(records: readonly WorkRecordDTO[]): WeekClientTotal[] {
  const rows = [...groupBy(records, (record) => record.clientId)].map(([clientId, group]) => ({
    clientId,
    // The standalone bucket has no client, so it reports a null name.
    clientName: clientId === null ? null : ((group[0] as WorkRecordDTO).client?.name ?? null),
    hours: sumHours(group),
    gross: sumGross(group),
  }));
  return byGrossThenName(rows, (row) => row.clientName ?? '');
}

/**
 * Week totals derived from the week's records. Pure — the R8 below-target
 * comparison never blocks anything, it only informs the UI banner.
 */
export function computeTotals(records: readonly WorkRecordDTO[], targetHours: number): WeekTotals {
  const totalHours = sumHours(records);
  return {
    totalHours,
    projectedGross: sumGross(records),
    targetHours,
    belowTarget: totalHours < targetHours,
    hoursBelowTarget: Math.max(0, roundHours(targetHours - totalHours)),
    // Standalone work is not a client, so it never counts towards this.
    clientCount: new Set(records.map((record) => record.clientId).filter((id) => id !== null)).size,
    recordCount: records.length,
    byProject: projectTotals(records),
    byClient: clientTotals(records),
  };
}

function buildDays(startDate: string, records: readonly WorkRecordDTO[]): WeekDay[] {
  const byDate = groupBy(records, (record) => record.date);
  return weekDays(startDate).map((date) => {
    const rows = byDate.get(date) ?? [];
    const weekday = dayOfWeek(date);
    return {
      date,
      dayName: DAY_NAMES[weekday] as string,
      dayOfWeek: weekday === 0 ? 7 : weekday, // ISO: Monday = 1 … Sunday = 7
      isWeekend: weekday === 0 || weekday === 6,
      hours: sumHours(rows),
      projectedGross: sumGross(rows),
      records: [...rows].sort((a, b) => a.id - b.id),
    };
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

/** Business rules for weeks (R4, R7, R8). */
export class WeeksService {
  constructor(
    private readonly repo: WeeksRepository,
    private readonly settings: SettingsService,
  ) {}

  async current(): Promise<WeekDTO> {
    return this.toDTO(await this.resolveWeek(todayIso()));
  }

  async byDate(date: string): Promise<WeekDTO> {
    return this.toDTO(await this.resolveWeek(date));
  }

  async get(id: number): Promise<WeekDTO> {
    return this.toDTO(await this.requireWeek(id));
  }

  async listRecords(id: number): Promise<WorkRecordDTO[]> {
    await this.requireWeek(id);
    const contexts = await this.repo.getRecordContexts(id);
    return contexts.map(toWorkRecordDTO);
  }

  async close(id: number): Promise<WeekStatusDTO> {
    const week = await this.requireWeek(id);
    if (week.status === 'closed') {
      throw new WeekClosedError(`${weekTitle(week.startDate)} is already closed`);
    }
    return this.applyStatus(id, 'closed');
  }

  async reopen(id: number): Promise<WeekStatusDTO> {
    const week = await this.requireWeek(id);
    if (week.status === 'open') {
      throw new ConflictError(`${weekTitle(week.startDate)} is already open`);
    }
    const invoiceCount = await this.repo.countInvoices(id);
    if (invoiceCount > 0) {
      throw new ConflictError(
        `${weekTitle(week.startDate)} has ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'} and cannot be reopened`,
        { invoiceCount },
      );
    }
    return this.applyStatus(id, 'open');
  }

  /** The week containing `date`, created on first access. */
  private async resolveWeek(date: string): Promise<WeekRow> {
    const startDate = weekStart(date);
    const existing = await this.repo.findByStartDate(startDate);
    if (existing) return existing;
    try {
      return await this.repo.insert({ startDate, status: 'open' });
    } catch (error) {
      // Another request inserted the same week first — adopt its row.
      if (isUniqueViolation(error)) {
        const raced = await this.repo.findByStartDate(startDate);
        if (raced) return raced;
      }
      throw error;
    }
  }

  private async requireWeek(id: number): Promise<WeekRow> {
    const week = await this.repo.findById(id);
    if (!week) throw new NotFoundError(`Week ${id} not found`);
    return week;
  }

  private async applyStatus(id: number, status: 'open' | 'closed'): Promise<WeekStatusDTO> {
    const updated = await this.repo.updateStatus(id, status, status === 'closed' ? new Date() : null);
    if (!updated) throw new NotFoundError(`Week ${id} not found`);
    return {
      id: updated.id,
      status: updated.status,
      closedAt: updated.closedAt ? updated.closedAt.toISOString() : null,
    };
  }

  private async toDTO(week: WeekRow): Promise<WeekDTO> {
    const [contexts, settings, invoiceCount] = await Promise.all([
      this.repo.getRecordContexts(week.id),
      this.settings.get(),
      this.repo.countInvoices(week.id),
    ]);
    const records = contexts.map(toWorkRecordDTO);
    return {
      id: week.id,
      startDate: week.startDate,
      endDate: addDays(week.startDate, 6),
      status: week.status,
      closedAt: week.closedAt ? week.closedAt.toISOString() : null,
      label: weekTitle(week.startDate),
      isoWeek: isoWeekNumber(week.startDate),
      invoiceCount,
      totals: computeTotals(records, settings.weeklyTargetHours),
      days: buildDays(week.startDate, records),
    };
  }
}