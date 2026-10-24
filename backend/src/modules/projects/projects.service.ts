import { ConflictError, NotFoundError, ValidationError } from '../../lib/http.js';
import type { ProjectRow, ProjectsRepository } from './projects.repository.js';

export interface ProjectInput {
  name: string;
  clientId?: number | null;
  description?: string | null;
  billingHour?: number | null;
  archived?: boolean;
}

export type ProjectUpdate = Partial<ProjectInput>;

export interface ProjectDTO {
  id: number;
  name: string;
  clientId: number | null;
  description: string | null;
  billingHour: number | null;
  effectiveRate: number;
  rateSource: 'project' | 'client';
  standalone: boolean;
  archived: boolean;
  client: {
    id: number;
    name: string;
    contactEmail: string;
    ccEmail: string | null;
    billingHour: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export type DeletedResource = { id: number; deleted: true };

export interface ProjectFilters {
  clientId?: number;
  standalone?: boolean;
  /** `'true'` / `'false'` filter, `'all'` disables the archived filter. */
  archived?: 'true' | 'false' | 'all';
}

function toDTO(row: ProjectRow): ProjectDTO {
  const standalone = row.clientId === null;
  const hasOverride = row.billingHour !== null;
  return {
    id: row.id,
    name: row.name,
    clientId: row.clientId,
    description: row.description,
    billingHour: row.billingHour,
    effectiveRate: row.billingHour ?? row.client?.billingHour ?? 0,
    rateSource: hasOverride ? 'project' : 'client',
    standalone,
    archived: row.archived,
    client: row.client,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Business rules for projects (R2). */
export class ProjectsService {
  constructor(private readonly repo: ProjectsRepository) {}

  async list(filters: ProjectFilters): Promise<ProjectDTO[]> {
    const query =
      filters.archived === 'all'
        ? { ...filters, archived: undefined }
        : { ...filters, archived: filters.archived === 'true' };
    const rows = await this.repo.list(query);
    return rows.map(toDTO);
  }

  async get(id: number): Promise<ProjectDTO> {
    return toDTO(await this.require(id));
  }

  async create(input: ProjectInput): Promise<ProjectDTO> {
    await this.assertNameAvailable(input.name, input.clientId ?? null);
    await this.assertClientExists(input.clientId ?? null);
    this.assertRateResolvable(input.clientId ?? null, input.billingHour ?? null, 'billingHour');
    const created = await this.repo.insert({ ...input, clientId: input.clientId ?? null });
    return toDTO(created);
  }

  async update(id: number, patch: ProjectUpdate): Promise<ProjectDTO> {
    const current = await this.require(id);
    const nextClientId = patch.clientId === undefined ? current.clientId : patch.clientId;
    const nextBillingHour =
      patch.billingHour === undefined ? current.billingHour : patch.billingHour;

    if (patch.name !== undefined && patch.name !== current.name) {
      await this.assertNameAvailable(patch.name, nextClientId);
    }
    await this.assertClientExists(nextClientId);
    this.assertRateResolvable(nextClientId, nextBillingHour, 'billingHour');

    const updated = await this.repo.update(id, patch);
    if (!updated) throw new NotFoundError(`Project ${id} not found`);
    return toDTO(updated);
  }

  async remove(id: number): Promise<DeletedResource> {
    await this.require(id);
    const recordCount = await this.repo.countRecords(id);
    if (recordCount > 0) {
      throw new ConflictError(
        `Project cannot be deleted — still referenced by ${recordCount} work record${recordCount === 1 ? '' : 's'}`,
        { recordCount },
      );
    }
    await this.repo.remove(id);
    return { id, deleted: true };
  }

  private async require(id: number): Promise<ProjectRow> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundError(`Project ${id} not found`);
    return row;
  }

  private async assertNameAvailable(name: string, clientId: number | null): Promise<void> {
    const existing = await this.repo.findByName(name, clientId);
    if (existing) {
      throw new ConflictError(`Project "${name}" already exists for this client`);
    }
  }

  private async assertClientExists(clientId: number | null): Promise<void> {
    if (clientId === null) return;
    const client = await this.repo.findClient(clientId);
    if (!client) {
      throw new ValidationError('Client does not exist', [
        { path: 'clientId', message: `Client ${clientId} not found` },
      ]);
    }
  }

  /** Mirrors the `projects_client_or_rate_check` DB constraint, but as a 400. */
  private assertRateResolvable(
    clientId: number | null,
    billingHour: number | null,
    path: string,
  ): void {
    if (clientId !== null || billingHour !== null) return;
    throw new ValidationError('Validation failed', [
      {
        path,
        message: 'A standalone project (no client) must define its own billingHour',
      },
    ]);
  }
}