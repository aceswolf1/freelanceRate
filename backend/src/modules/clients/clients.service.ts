import { ConflictError, NotFoundError, ValidationError } from '../../lib/http.js';
import type { ClientRow, ClientsRepository } from './clients.repository.js';
import type { PaymentPlatformDTO } from '../payment-platforms/payment-platforms.service.js';

export interface ClientInput {
  name: string;
  contactName?: string | null;
  contactEmail: string;
  ccEmail?: string | null;
  billingHour: number;
  paymentPlatformId?: number | null;
  notes?: string | null;
}

export type ClientUpdate = Partial<ClientInput>;

export interface ClientDTO {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string;
  ccEmail: string | null;
  billingHour: number;
  paymentPlatformId: number | null;
  paymentPlatform: PaymentPlatformDTO | null;
  projectCount: number;
  totalHours: number;
  totalGross: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DeletedResource = { id: number; deleted: true };

function platformToDTO(platform: ClientRow['platform']): PaymentPlatformDTO | null {
  if (!platform) return null;
  return {
    id: platform.id,
    company: platform.company,
    feePercent: platform.feePercent,
    feeFlat: platform.feeFlat,
    createdAt: platform.createdAt.toISOString(),
  };
}

function toDTO(row: ClientRow): ClientDTO {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    ccEmail: row.ccEmail,
    billingHour: row.billingHour,
    paymentPlatformId: row.paymentPlatformId,
    paymentPlatform: platformToDTO(row.platform),
    projectCount: row.projectCount,
    totalHours: row.totalHours,
    totalGross: row.totalGross,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Business rules for clients (R1). */
export class ClientsService {
  constructor(private readonly repo: ClientsRepository) {}

  async list(): Promise<ClientDTO[]> {
    const rows = await this.repo.list();
    return rows.map(toDTO);
  }

  async get(id: number): Promise<ClientDTO> {
    return toDTO(await this.require(id));
  }

  async create(input: ClientInput): Promise<ClientDTO> {
    await this.assertNameAvailable(input.name);
    await this.assertPlatformExists(input.paymentPlatformId);
    const created = await this.repo.insert(input);
    return toDTO(created);
  }

  async update(id: number, patch: ClientUpdate): Promise<ClientDTO> {
    const current = await this.require(id);
    if (patch.name !== undefined && patch.name !== current.name) {
      await this.assertNameAvailable(patch.name);
    }
    await this.assertPlatformExists(patch.paymentPlatformId);
    const updated = await this.repo.update(id, patch);
    if (!updated) throw new NotFoundError(`Client ${id} not found`);
    return toDTO(updated);
  }

  async remove(id: number): Promise<DeletedResource> {
    await this.require(id);
    const projectCount = await this.repo.countProjects(id);
    if (projectCount > 0) {
      throw new ConflictError(
        `Client cannot be deleted — still referenced by ${projectCount} project${projectCount === 1 ? '' : 's'}`,
        { projectCount },
      );
    }
    const recordCount = await this.repo.countRecords(id);
    if (recordCount > 0) {
      throw new ConflictError(
        `Client cannot be deleted — still referenced by ${recordCount} work record${recordCount === 1 ? '' : 's'}`,
        { recordCount },
      );
    }
    await this.repo.remove(id);
    return { id, deleted: true };
  }

  private async require(id: number): Promise<ClientRow> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundError(`Client ${id} not found`);
    return row;
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const existing = await this.repo.findByName(name);
    if (existing) throw new ConflictError(`Client "${name}" already exists`);
  }

  private async assertPlatformExists(platformId: number | null | undefined): Promise<void> {
    if (platformId === undefined || platformId === null) return;
    const platform = await this.repo.findPaymentPlatformById(platformId);
    if (!platform) throw new ValidationError('Payment platform does not exist', [
      { path: 'paymentPlatformId', message: `Payment platform ${platformId} not found` },
    ]);
  }
}