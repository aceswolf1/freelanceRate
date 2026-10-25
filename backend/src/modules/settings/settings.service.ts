import type { SettingsRow, SettingsRepository } from './settings.repository.js';

export interface SettingsUpdate {
  displayName?: string;
  weeklyTargetHours?: number;
  currencySymbol?: string;
  invoicePrefix?: string;
  emailShowRate?: boolean;
  emailShowGross?: boolean;
  emailShowFee?: boolean;
}

export interface SettingsDTO {
  id: 1;
  displayName: string;
  weeklyTargetHours: number;
  currencySymbol: string;
  invoicePrefix: string;
  /** Copied-email content toggles — all false by default. */
  emailShowRate: boolean;
  emailShowGross: boolean;
  emailShowFee: boolean;
  updatedAt: string;
}

function toDTO(row: SettingsRow): SettingsDTO {
  return {
    id: 1,
    displayName: row.displayName,
    weeklyTargetHours: row.weeklyTargetHours,
    currencySymbol: row.currencySymbol,
    invoicePrefix: row.invoicePrefix,
    emailShowRate: row.emailShowRate,
    emailShowGross: row.emailShowGross,
    emailShowFee: row.emailShowFee,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Business rules for the settings singleton (R15). */
export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {}

  async get(): Promise<SettingsDTO> {
    return toDTO(await this.repo.ensure());
  }

  async update(patch: SettingsUpdate): Promise<SettingsDTO> {
    return toDTO(await this.repo.update(patch));
  }
}