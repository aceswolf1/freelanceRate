import { ConflictError, NotFoundError } from '../../lib/http.js';
import type { PaymentPlatform } from '../../db/schema/index.js';
import type { PaymentPlatformRepository } from './payment-platforms.repository.js';

export interface PaymentPlatformInput {
  company: string;
  feePercent: number;
  feeFlat: number;
}

export type PaymentPlatformUpdate = Partial<PaymentPlatformInput>;

export interface PaymentPlatformDTO {
  id: number;
  company: string;
  feePercent: number;
  feeFlat: number;
  createdAt: string;
}

export type DeletedResource = { id: number; deleted: true };

function toDTO(row: PaymentPlatform): PaymentPlatformDTO {
  return {
    id: row.id,
    company: row.company,
    feePercent: row.feePercent,
    feeFlat: row.feeFlat,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Business rules for payment platforms (R3). Stateless and repository-injected. */
export class PaymentPlatformsService {
  constructor(private readonly repo: PaymentPlatformRepository) {}

  async list(): Promise<PaymentPlatformDTO[]> {
    const rows = await this.repo.list();
    return rows.map(toDTO);
  }

  async get(id: number): Promise<PaymentPlatformDTO> {
    return toDTO(await this.require(id));
  }

  async create(input: PaymentPlatformInput): Promise<PaymentPlatformDTO> {
    await this.assertCompanyAvailable(input.company);
    return toDTO(await this.repo.insert(input));
  }

  async update(id: number, patch: PaymentPlatformUpdate): Promise<PaymentPlatformDTO> {
    const current = await this.require(id);
    if (patch.company !== undefined && patch.company !== current.company) {
      await this.assertCompanyAvailable(patch.company);
    }
    const updated = await this.repo.update(id, patch);
    if (!updated) throw new NotFoundError(`Payment platform ${id} not found`);
    return toDTO(updated);
  }

  async remove(id: number): Promise<DeletedResource> {
    await this.require(id);
    await this.repo.remove(id);
    return { id, deleted: true };
  }

  private async require(id: number): Promise<PaymentPlatform> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundError(`Payment platform ${id} not found`);
    return row;
  }

  private async assertCompanyAvailable(company: string): Promise<void> {
    const existing = await this.repo.findByCompany(company);
    if (existing) {
      throw new ConflictError(`Payment platform "${company}" already exists`);
    }
  }
}