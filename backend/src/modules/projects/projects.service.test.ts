import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/http.js';
import type { ProjectRow, ProjectsRepository } from './projects.repository.js';
import { ProjectsService } from './projects.service.js';

const ACME = {
  id: 1,
  name: 'Acme Corp',
  contactEmail: 'billing@acme.example',
  ccEmail: null,
  billingHour: 130,
};
const STARLIGHT = {
  id: 2,
  name: 'Starlight Media',
  contactEmail: 'accounts@starlight.example',
  ccEmail: null,
  billingHour: 100,
};
const CLIENTS = [ACME, STARLIGHT];

function row(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: 1,
    name: 'E-Commerce Storefront',
    clientId: 1,
    description: null,
    billingHour: null,
    archived: false,
    createdAt: new Date('2026-10-22T18:04:10.402Z'),
    updatedAt: new Date('2026-10-22T18:04:10.402Z'),
    client: ACME,
    recordCount: 4,
    ...overrides,
  };
}

function createRepo(seed: ProjectRow[] = [row()]): ProjectsRepository {
  const rows = [...seed];
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
  return {
    list: vi.fn(async (filters) =>
      [...rows]
        .filter((r) => (filters.clientId === undefined ? true : r.clientId === filters.clientId))
        .filter((r) => (filters.standalone === undefined ? true : (r.clientId === null) === filters.standalone))
        .filter((r) => (filters.archived === undefined ? true : r.archived === filters.archived))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ),
    findById: vi.fn(async (id) => rows.find((r) => r.id === id) ?? null),
    findByName: vi.fn(async (name, clientId) =>
      rows.find(
        (r) => r.name.toLowerCase() === name.toLowerCase() && r.clientId === clientId,
      ) ?? null,
    ),
    findClient: vi.fn(async (id) => CLIENTS.find((client) => client.id === id) ?? null),
    countRecords: vi.fn(async () => 0),
    insert: vi.fn(async (values) => {
      const created = row({
        ...values,
        id: nextId++,
        client: values.clientId === null ? null : (CLIENTS.find((c) => c.id === values.clientId) ?? null),
      });
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

describe('ProjectsService', () => {
  let repo: ProjectsRepository;
  let service: ProjectsService;

  beforeEach(() => {
    repo = createRepo([
      row({ id: 1, name: 'API Microservice', clientId: 1, client: ACME }),
      row({ id: 2, name: 'E-Commerce Storefront', clientId: 1, client: ACME }),
      row({ id: 3, name: 'Internal Tools', clientId: null, client: null, billingHour: 95 }),
      row({
        id: 4,
        name: 'Video Streaming Mobile App',
        clientId: 2,
        client: { ...ACME, id: 2, name: 'Starlight Media', billingHour: 100 },
        billingHour: 115,
      }),
    ]);
    service = new ProjectsService(repo);
  });

  describe('list', () => {
    it('returns every project by default, ordered by name', async () => {
      const result = await service.list({});
      expect(result.map((p) => p.name)).toEqual([
        'API Microservice',
        'E-Commerce Storefront',
        'Internal Tools',
        'Video Streaming Mobile App',
      ]);
    });

    it('filters by client', async () => {
      const result = await service.list({ clientId: 2 });
      expect(result.map((p) => p.name)).toEqual(['Video Streaming Mobile App']);
    });

    it('filters standalone projects', async () => {
      const result = await service.list({ standalone: true });
      expect(result.map((p) => p.name)).toEqual(['Internal Tools']);
    });

    it('hides archived projects unless asked for them', async () => {
      await service.list({});
      expect(repo.list).toHaveBeenLastCalledWith({ archived: false });

      await service.list({ archived: 'all' });
      expect(repo.list).toHaveBeenLastCalledWith({});
    });
  });

  describe('effective rate (R2)', () => {
    it('inherits the client rate when the project has no override', async () => {
      const project = await service.get(1);
      expect(project.billingHour).toBeNull();
      expect(project.effectiveRate).toBe(130);
      expect(project.rateSource).toBe('client');
      expect(project.standalone).toBe(false);
    });

    it('prefers the project override', async () => {
      const project = await service.get(4);
      expect(project.effectiveRate).toBe(115);
      expect(project.rateSource).toBe('project');
    });

    it('marks client-less projects standalone and uses their own rate', async () => {
      const project = await service.get(3);
      expect(project.standalone).toBe(true);
      expect(project.client).toBeNull();
      expect(project.effectiveRate).toBe(95);
      expect(project.rateSource).toBe('project');
    });
  });

  describe('get', () => {
    it('throws NOT_FOUND for an unknown id', async () => {
      await expect(service.get(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates a client project that inherits the rate', async () => {
      await expect(service.create({ name: 'New Project', clientId: 1 })).resolves.toMatchObject({
        effectiveRate: 130,
        rateSource: 'client',
      });
    });

    it('creates a standalone project with its own rate', async () => {
      await expect(service.create({ name: 'Solo', clientId: null, billingHour: 80 })).resolves.toMatchObject(
        { standalone: true, effectiveRate: 80 },
      );
    });

    it('rejects a standalone project without a rate', async () => {
      await expect(service.create({ name: 'Solo', clientId: null })).rejects.toBeInstanceOf(ValidationError);
      expect(repo.insert).not.toHaveBeenCalled();
    });

    it('rejects a client that does not exist', async () => {
      await expect(service.create({ name: 'Ghost', clientId: 77 })).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects a duplicate name for the same client, case-insensitively', async () => {
      await expect(service.create({ name: 'api microservice', clientId: 1 })).rejects.toBeInstanceOf(
        ConflictError,
      );
    });

    it('allows the same name under a different client', async () => {
      await expect(service.create({ name: 'API Microservice', clientId: 2 })).resolves.toBeTruthy();
    });
  });

  describe('update', () => {
    it('applies a partial patch', async () => {
      await expect(service.update(1, { name: 'Renamed' })).resolves.toMatchObject({ name: 'Renamed' });
    });

    it('rejects making a rate-less project standalone', async () => {
      await expect(service.update(1, { clientId: null })).rejects.toBeInstanceOf(ValidationError);
    });

    it('allows the move when an override rate is supplied in the same patch', async () => {
      await expect(
        service.update(1, { clientId: null, billingHour: 70 }),
      ).resolves.toMatchObject({ standalone: true, effectiveRate: 70 });
    });

    it('keeps an existing override when the project becomes standalone', async () => {
      await expect(service.update(4, { clientId: null })).resolves.toMatchObject({
        standalone: true,
        effectiveRate: 115,
      });
    });

    it('rejects a duplicate name for the same client', async () => {
      await expect(service.update(1, { name: 'E-Commerce Storefront' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('validates the target client when the project moves to another one', async () => {
      await expect(service.update(1, { clientId: 77 })).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws NOT_FOUND for an unknown id', async () => {
      await expect(service.update(99, { name: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('remove', () => {
    it('deletes a project without records', async () => {
      await expect(service.remove(3)).resolves.toEqual({ id: 3, deleted: true });
    });

    it('refuses while work records reference it', async () => {
      vi.mocked(repo.countRecords).mockResolvedValueOnce(9);
      await expect(service.remove(3)).rejects.toBeInstanceOf(ConflictError);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND for an unknown id', async () => {
      await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});