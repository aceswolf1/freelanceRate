import { fromCents, mulHoursRate } from '../../lib/money.js';
import type { WorkRecord } from '../../db/schema/index.js';

/**
 * Shared record enrichment used by both the `weeks` and `records` modules:
 * a work record plus the project/client it points at, and the effective rate
 * derived from them.
 */

export interface ClientSummary {
  id: number;
  name: string;
  contactEmail: string;
  ccEmail: string | null;
  billingHour: number;
}

export interface ProjectSummary {
  id: number;
  name: string;
  clientId: number | null;
}

export interface RecordContextRow {
  record: WorkRecord;
  project: ProjectSummary | null;
  projectBillingHour: number | null;
  client: ClientSummary | null;
}

export interface WorkRecordDTO {
  id: number;
  weekId: number;
  projectId: number;
  project: ProjectSummary | null;
  clientId: number | null;
  client: ClientSummary | null;
  description: string;
  hours: number;
  date: string;
  rate: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
}

/** Effective rate (R2): the project's override, else the client's rate. */
export function effectiveRate(
  projectBillingHour: number | null,
  clientBillingHour: number | null,
): number {
  return projectBillingHour ?? clientBillingHour ?? 0;
}

export function rateSource(projectBillingHour: number | null): 'project' | 'client' {
  return projectBillingHour === null ? 'client' : 'project';
}

/** Line total in decimal currency, computed in integer cents. */
export function lineTotalFor(hours: number, rate: number): number {
  return fromCents(mulHoursRate(hours, rate));
}

export function toWorkRecordDTO(row: RecordContextRow): WorkRecordDTO {
  const rate = effectiveRate(row.projectBillingHour, row.client?.billingHour ?? null);
  return {
    id: row.record.id,
    weekId: row.record.weekId,
    projectId: row.record.projectId,
    project: row.project,
    clientId: row.record.clientId,
    client: row.client,
    description: row.record.description,
    hours: row.record.hours,
    date: row.record.date,
    rate,
    lineTotal: lineTotalFor(row.record.hours, rate),
    createdAt: row.record.createdAt.toISOString(),
    updatedAt: row.record.updatedAt.toISOString(),
  };
}