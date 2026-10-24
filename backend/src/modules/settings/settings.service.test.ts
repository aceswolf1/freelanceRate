import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsRow, SettingsRepository } from './settings.repository.js';
import { SettingsService } from './settings.service.js';

function row(overrides: Partial<SettingsRow> = {}): SettingsRow {
  return {
    id: 1,
    displayName: 'Alex Morgan',
    weeklyTargetHours: 40,
    currencySymbol: '$',
    invoicePrefix: 'INV',
    updatedAt: new Date('2026-10-22T18:04:11.001Z'),
    ...overrides,
  };
}

function createRepo(current: SettingsRow = row()): SettingsRepository {
  let state = current;
  return {
    ensure: vi.fn(async () => state),
    update: vi.fn(async (patch) => {
      state = row({ ...state, ...patch, updatedAt: new Date('2026-10-23T09:00:00.000Z') });
      return state;
    }),
  };
}

describe('SettingsService', () => {
  let repo: SettingsRepository;
  let service: SettingsService;

  beforeEach(() => {
    repo = createRepo();
    service = new SettingsService(repo);
  });

  describe('get', () => {
    it('always returns the singleton row', async () => {
      await expect(service.get()).resolves.toEqual({
        id: 1,
        displayName: 'Alex Morgan',
        weeklyTargetHours: 40,
        currencySymbol: '$',
        invoicePrefix: 'INV',
        updatedAt: '2026-10-22T18:04:11.001Z',
      });
      expect(repo.ensure).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('applies a partial patch and returns the full row', async () => {
      const updated = await service.update({ weeklyTargetHours: 35 });
      expect(updated.weeklyTargetHours).toBe(35);
      expect(updated.displayName).toBe('Alex Morgan');
      expect(updated.updatedAt).toBe('2026-10-23T09:00:00.000Z');
    });

    it('leaves omitted fields untouched', async () => {
      await service.update({ currencySymbol: '€' });
      expect(repo.update).toHaveBeenCalledWith({ currencySymbol: '€' });
    });

    it('never allows the singleton id to change', async () => {
      const updated = await service.update({ invoicePrefix: 'BILL' });
      expect(updated.id).toBe(1);
      expect(updated.invoicePrefix).toBe('BILL');
    });
  });
});