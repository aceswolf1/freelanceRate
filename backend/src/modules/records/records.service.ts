import { NotFoundError, ValidationError, WeekClosedError } from '../../lib/http.js';
import { formatDisplayDate, isWithinWeek, isoWeekNumber, addDays } from '../../lib/dates.js';
import type { ProjectRow, ProjectsRepository } from '../projects/projects.repository.js';
import type { WeekRow, WeeksRepository } from '../weeks/weeks.repository.js';
import type { RecordContextRow, WorkRecordDTO } from './record-context.js';
import { toWorkRecordDTO } from './record-context.js';
import type { RecordsRepository } from './records.repository.js';

export interface WorkRecordInput {
  projectId: number;
  description: string;
  hours: number;
  date: string;
}

export type WorkRecordUpdate = Partial<WorkRecordInput>;

export type DeletedResource = { id: number; deleted: true };

function describeWeek(week: WeekRow): string {
  return `week ${isoWeekNumber(week.startDate)} (${formatDisplayDate(week.startDate)} – ${formatDisplayDate(
    addDays(week.startDate, 6),
  )})`;
}

/** Business rules for work records (R5) and their week lock (R7). */
export class RecordsService {
  constructor(
    private readonly repo: RecordsRepository,
    private readonly projects: Pick<ProjectsRepository, 'findById'>,
    private readonly weeks: WeeksRepository,
  ) {}

  async createForWeek(weekId: number, input: WorkRecordInput): Promise<WorkRecordDTO> {
    const week = await this.requireOpenWeek(weekId);
    this.assertDateInWeek(input.date, week);
    const project = await this.requireUsableProject(input.projectId);

    const created = await this.repo.insert({
      weekId: week.id,
      projectId: project.id,
      // Denormalized from the project so invoicing can bucket without a join.
      clientId: project.clientId,
      description: input.description,
      hours: input.hours,
      date: input.date,
    });
    if (!created) throw new NotFoundError('Work record could not be created');
    return this.toDTO(created.id, `Work record ${created.id} not found after insert`);
  }

  async update(id: number, patch: WorkRecordUpdate): Promise<WorkRecordDTO> {
    const existing = await this.requireRecord(id);
    const week = await this.requireOpenWeek(existing.record.weekId);
    if (patch.date !== undefined) this.assertDateInWeek(patch.date, week);

    // Only re-derive the client when the project itself changes.
    const clientId =
      patch.projectId === undefined
        ? undefined
        : (await this.requireUsableProject(patch.projectId)).clientId;

    const updated = await this.repo.update(id, {
      ...patch,
      ...(clientId === undefined ? {} : { clientId }),
    });
    if (!updated) throw new NotFoundError(`Work record ${id} not found`);
    return this.toDTO(updated.id, `Work record ${id} not found after update`);
  }

  async remove(id: number): Promise<DeletedResource> {
    const existing = await this.requireRecord(id);
    await this.requireOpenWeek(existing.record.weekId);
    await this.repo.remove(id);
    return { id, deleted: true };
  }

  private async toDTO(id: number, message: string): Promise<WorkRecordDTO> {
    const context = await this.repo.findContextById(id);
    if (!context) throw new NotFoundError(message);
    return toWorkRecordDTO(context);
  }

  private async requireRecord(id: number): Promise<RecordContextRow> {
    const context = await this.repo.findContextById(id);
    if (!context) throw new NotFoundError(`Work record ${id} not found`);
    return context;
  }

  private async requireOpenWeek(weekId: number): Promise<WeekRow> {
    const week = await this.weeks.findById(weekId);
    if (!week) throw new NotFoundError(`Week ${weekId} not found`);
    if (week.status === 'closed') {
      throw new WeekClosedError(`${describeWeek(week)} is closed`);
    }
    return week;
  }

  private assertDateInWeek(date: string, week: WeekRow): void {
    if (isWithinWeek(date, week.startDate)) return;
    throw new ValidationError('Validation failed', [
      { path: 'date', message: `Date ${date} is outside ${describeWeek(week)}` },
    ]);
  }

  private async requireUsableProject(projectId: number): Promise<ProjectRow> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError(`Project ${projectId} not found`);
    if (project.archived) {
      throw new ValidationError('Validation failed', [
        { path: 'projectId', message: `Project ${projectId} is archived and cannot receive new records` },
      ]);
    }
    return project;
  }
}