import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, NotFoundError } from '../../lib/http.js';
import type { NewPaymentPlatform, PaymentPlatform } from '../../db/schema/index.js';
import type { PaymentPlatformRepository } from './payment-platforms.repository.js';
import { PaymentPlatformsService } from './payment-platforms.service.js';

function row(overrides: Partial<PaymentPlatform> = {}): PaymentPlatform {
  return {
    id: 1,
    company: 'Payoneer',
    feePercent: 1,
    feeFlat: 0,
    createdAt: new Date('2026-10-22T18:04:10.117Z'),
    ...overrides,
  };
}

/** Minimal in-memory stand-in for the Drizzle repository. */
function createRepo(seed: PaymentPlatform[] = []): PaymentPlatformRepository {
  const rows = [...seed];
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
  return {
    list: vi.fn(async () => [...rows].sort((a, b) => a.company.localeCompare(b.company))),
    findById: vi.fn(async (id) => rows.find((r) => r.id === id) ?? null),
    findByCompany: vi.fn(async (company) =>
      rows.find((r) => r.company.toLowerCase() === company.toLowerCase()) ?? null,
    ),
    insert: vi.fn(async (values: NewPaymentPlatform) => {
      const created = row({ ...values, id: nextId++ });
      rows.push(created);
      return created;
    }),
    update: vi.fn(async (id, patch) => {
      const index = rows.findIndex((r) => r.id === id);
      const current = rows[index];
      if (index === -1 || !current) return null;
      const updated = { ...current, ...patch };
      rows[index] = updated;
      return updated;
    }),
    remove: vi.fn(async (id) => {
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1) return false;
      rows.splice(index, 1);
      return true;
    }),
  };
}

describe('PaymentPlatformsService', () => {
  let repo: PaymentPlatformRepository;
  let service: PaymentPlatformsService;

  beforeEach(() => {
    repo = createRepo([
      row({ id: 1, company: 'Payoneer', feePercent: 1, feeFlat: 0 }),
      row({ id: 2, company: 'Domestic Wire', feePercent: 0, feeFlat: 15 }),
      row({ id: 3, company: 'Wise', feePercent: 0.5, feeFlat: 0 }),
    ]);
    service = new PaymentPlatformsService(repo);
  });

  describe('list', () => {
    it('returns every platform ordered by company with ISO timestamps', async () => {
      const result = await service.list();
      expect(result.map((p) => p.company)).toEqual(['Domestic Wire', 'Payoneer', 'Wise']);
      expect(result[0]).toEqual({
        id: 2,
        company: 'Domestic Wire',
        feePercent: 0,
        feeFlat: 15,
        createdAt: '2026-10-22T18:04:10.117Z',
      });
    });
  });

  describe('get', () => {
    it('returns a single platform', async () => {
      await expect(service.get(1)).resolves.toMatchObject({ company: 'Payoneer', feePercent: 1 });
    });

    it('throws NOT_FOUND for an unknown id', async () => {
      await expect(service.get(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('create', () => {
    it('inserts and returns the created platform', async () => {
      const created = await service.create({ company: 'Stripe', feePercent: 2.9, feeFlat: 0.3 });
      expect(created.company).toBe('Stripe');
      expect(created.id).toBe(4);
      expect(repo.insert).toHaveBeenCalledOnce();
    });

    it('rejects a duplicate company regardless of case', async () => {
      await expect(service.create({ company: 'payoneer', feePercent: 1, feeFlat: 0 })).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect(repo.insert).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('applies a partial patch', async () => {
      const updated = await service.update(1, { feePercent: 1.5 });
      expect(updated.feePercent).toBe(1.5);
      expect(updated.feeFlat).toBe(0);
    });

    it('allows renaming when the new name is free', async () => {
      await expect(service.update(1, { company: 'Payoneer Inc' })).resolves.toMatchObject({
        company: 'Payoneer Inc',
      });
    });

    it('keeps the same name when it is not part of the patch', async () => {
      await service.update(1, { feeFlat: 5 });
      expect(repo.findByCompany).not.toHaveBeenCalled();
    });

    it('rejects renaming onto another platform name', async () => {
      await expect(service.update(1, { company: 'Wise' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('throws NOT_FOUND for an unknown id', async () => {
      await expect(service.update(99, { feeFlat: 1 })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('remove', () => {
    it('deletes an existing platform', async () => {
      await expect(service.remove(2)).resolves.toEqual({ id: 2, deleted: true });
      expect(repo.remove).toHaveBeenCalledWith(2);
    });

    it('throws NOT_FOUND for an unknown id', async () => {
      await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});