import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/http.js';
import type { ClientRow, ClientsRepository } from './clients.repository.js';
import { ClientsService } from './clients.service.js';

const PLATFORM = {
  id: 1,
  company: 'Payoneer',
  feePercent: 1,
  feeFlat: 0,
  createdAt: new Date('2026-10-22T18:04:10.117Z'),
};

function row(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: 1,
    name: 'Acme Corp',
    contactEmail: 'billing@acme.example',
    ccEmail: null,
    billingHour: 130,
    paymentPlatformId: 1,
    notes: null,
    platform: PLATFORM,
    projectCount: 2,
    totalHours: 17.5,
    totalGross: 2275,
    createdAt: new Date('2026-10-22T18:04:10.301Z'),
    updatedAt: new Date('2026-10-22T18:04:10.301Z'),
    ...overrides,
  };
}

function createRepo(seed: ClientRow[] = [row()]): ClientsRepository {
  const rows = [...seed];
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
  return {
    list: vi.fn(async () => [...rows].sort((a, b) => a.name.localeCompare(b.name))),
    findById: vi.fn(async (id) => rows.find((r) => r.id === id) ?? null),
    findByName: vi.fn(async (name) =>
      rows.find((r) => r.name.toLowerCase() === name.toLowerCase()) ?? null,
    ),
    countProjects: vi.fn(async () => 0),
    countRecords: vi.fn(async () => 0),
    findPaymentPlatformById: vi.fn(async (id) => (id === PLATFORM.id ? PLATFORM : null)),
    insert: vi.fn(async () => {
      const created = row({ id: nextId++ });
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

describe('ClientsService', () => {
  let repo: ClientsRepository;
  let service: ClientsService;

  beforeEach(() => {
    repo = createRepo([
      row({ id: 1, name: 'Acme Corp' }),
      row({ id: 2, name: 'Starlight Media', billingHour: 100, projectCount: 1, totalHours: 14.5, totalGross: 1667.5 }),
    ]);
    service = new ClientsService(repo);
  });

  describe('list', () => {
    it('returns clients ordered by name with the embedded platform and totals', async () => {
      const result = await service.list();
      expect(result.map((c) => c.name)).toEqual(['Acme Corp', 'Starlight Media']);
      expect(result[0]).toEqual({
        id: 1,
        name: 'Acme Corp',
        contactEmail: 'billing@acme.example',
        ccEmail: null,
        billingHour: 130,
        paymentPlatformId: 1,
        paymentPlatform: {
          id: 1,
          company: 'Payoneer',
          feePercent: 1,
          feeFlat: 0,
          createdAt: '2026-10-22T18:04:10.117Z',
        },
        projectCount: 2,
        totalHours: 17.5,
        totalGross: 2275,
        notes: null,
        createdAt: '2026-10-22T18:04:10.301Z',
        updatedAt: '2026-10-22T18:04:10.301Z',
      });
    });

    it('reports a null platform when the client has none', async () => {
      vi.mocked(repo.list).mockResolvedValueOnce([row({ paymentPlatformId: null, platform: null })]);
      const [client] = await service.list();
      expect(client?.paymentPlatform).toBeNull();
    });
  });

  describe('get', () => {
    it('returns a single client', async () => {
      await expect(service.get(2)).resolves.toMatchObject({ name: 'Starlight Media', billingHour: 100 });
    });

    it('throws NOT_FOUND for an unknown id', async () => {
      await expect(service.get(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('create', () => {
    const input = {
      name: 'Northwind',
      contactEmail: 'ap@northwind.example',
      billingHour: 90,
      paymentPlatformId: 1,
    };

    it('creates a client', async () => {
      await expect(service.create(input)).resolves.toMatchObject({ id: 3 });
      expect(repo.insert).toHaveBeenCalledOnce();
    });

    it('rejects a duplicate name regardless of case', async () => {
      await expect(service.create({ ...input, name: 'acme corp' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('rejects a payment platform that does not exist', async () => {
      await expect(service.create({ ...input, paymentPlatformId: 77 })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('allows clearing the payment platform with null', async () => {
      await expect(service.create({ ...input, paymentPlatformId: null })).resolves.toMatchObject({ id: 3 });
      expect(repo.findPaymentPlatformById).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('applies a partial patch and leaves other fields alone', async () => {
      const updated = await service.update(1, { billingHour: 140 });
      expect(updated.billingHour).toBe(140);
      expect(updated.name).toBe('Acme Corp');
    });

    it('rejects renaming onto another client', async () => {
      await expect(service.update(1, { name: 'Starlight Media' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('allows renaming to the same name', async () => {
      await expect(service.update(1, { name: 'Acme Corp' })).resolves.toMatchObject({ id: 1 });
      expect(repo.findByName).not.toHaveBeenCalled();
    });

    it('validates a referenced payment platform only when it changes', async () => {
      await service.update(1, { notes: 'hello' });
      expect(repo.findPaymentPlatformById).not.toHaveBeenCalled();

      await expect(service.update(1, { paymentPlatformId: 77 })).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws NOT_FOUND for an unknown id', async () => {
      await expect(service.update(99, { billingHour: 1 })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('remove', () => {
    it('deletes an unreferenced client', async () => {
      await expect(service.remove(1)).resolves.toEqual({ id: 1, deleted: true });
      expect(repo.remove).toHaveBeenCalledWith(1);
    });

    it('refuses while projects still reference the client', async () => {
      vi.mocked(repo.countProjects).mockResolvedValueOnce(2);
      await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictError);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('refuses while work records still reference the client', async () => {
      vi.mocked(repo.countProjects).mockResolvedValueOnce(0);
      vi.mocked(repo.countRecords).mockResolvedValueOnce(7);
      await expect(service.remove(1)).rejects.toThrow(/referenced by 7 work records/);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND for an unknown id', async () => {
      await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});