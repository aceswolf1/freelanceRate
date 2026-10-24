import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError, WeekClosedError } from '../../lib/http.js';
import type { ProjectRow, ProjectsRepository } from '../projects/projects.repository.js';
import type { WeekRow, WeeksRepository } from '../weeks/weeks.repository.js';
import type { RecordContextRow } from './record-context.js';
import type { RecordsRepository } from './records.repository.js';
import { RecordsService } from './records.service.js';

const ACME = { id: 1, name: 'Acme Corp', contactEmail: 'billing@acme.example', ccEmail: null, billingHour: 130 };

const OPEN_WEEK: WeekRow = {
  id: 1,
  startDate: '2026-10-19',
  status: 'open',
  closedAt: null,
  createdAt: new Date('2026-10-19T08:00:00Z'),
};

const CLOSED_WEEK: WeekRow = { ...OPEN_WEEK, status: 'closed', closedAt: new Date('2026-10-25T23:59:00Z') };

function project(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: 1,
    name: 'E-Commerce Storefront',
    clientId: 1,
    description: null,
    billingHour: null,
    archived: false,
    createdAt: new Date('2026-10-19T08:00:00Z'),
    updatedAt: new Date('2026-10-19T08:00:00Z'),
    client: ACME,
    recordCount: 0,
    ...overrides,
  };
}

function context(overrides: Partial<RecordContextRow> = {}): RecordContextRow {
  return {
    record: {
      id: 10,
      weekId: 1,
      projectId: 1,
      clientId: 1,
      description: 'Checkout flow rebuild',
      hours: 3.5,
      date: '2026-10-19',
      createdAt: new Date('2026-10-19T08:00:00Z'),
      updatedAt: new Date('2026-10-19T08:00:00Z'),
    },
    project: { id: 1, name: 'E-Commerce Storefront', clientId: 1 },
    projectBillingHour: null,
    client: ACME,
    ...overrides,
  };
}

function createRepos(week: WeekRow = OPEN_WEEK) {
  const weeks: WeeksRepository = {
    findById: vi.fn(async (id) => (id === week.id ? week : null)),
    findByStartDate: vi.fn(async () => null),
    insert: vi.fn(async () => week),
    updateStatus: vi.fn(async () => week),
    getRecordContexts: vi.fn(async () => []),
    countInvoices: vi.fn(async () => 0),
  };
  const projects: Pick<ProjectsRepository, 'findById'> = {
    findById: vi.fn(async (id) => (id === 1 || id === 4 ? project({ id }) : null)),
  };
  const records: RecordsRepository = (() => {
    // Holds the current row so `update` is reflected by the follow-up read.
    let current = context();
    return {
      findContextById: vi.fn(async (id) => (id === current.record.id ? current : null)),
      insert: vi.fn(async (values) => {
        current = context({
          record: {
            ...values,
            clientId: values.clientId ?? null,
            id: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        return current.record;
      }),
      update: vi.fn(async (_id, patch) => {
        current = context({ record: { ...current.record, ...patch } });
        return current.record;
      }),
      remove: vi.fn(async () => true),
    };
  })();
  return { weeks, projects, records };
}

describe('RecordsService', () => {
  let weeks: WeeksRepository;
  let projects: Pick<ProjectsRepository, 'findById'>;
  let records: RecordsRepository;
  let service: RecordsService;

  beforeEach(() => {
    ({ weeks, projects, records } = createRepos());
    service = new RecordsService(records, projects, weeks);
  });

  describe('create', () => {
    const input = { projectId: 1, description: 'Checkout flow rebuild', hours: 3.5, date: '2026-10-19' };

    it('creates a record and derives clientId from the project', async () => {
      const created = await service.createForWeek(1, input);
      expect(records.insert).toHaveBeenCalledWith(
        expect.objectContaining({ weekId: 1, projectId: 1, clientId: 1, hours: 3.5, date: '2026-10-19' }),
      );
      expect(created).toMatchObject({ weekId: 1, clientId: 1, rate: 130, lineTotal: 455 });
    });

    it('stores a null client for a standalone project', async () => {
      vi.mocked(projects.findById).mockResolvedValueOnce(
        project({ id: 4, name: 'Internal Tools', clientId: null, billingHour: 95, client: null }),
      );
      vi.mocked(records.insert).mockImplementationOnce(async (values) => ({
        ...values,
        clientId: values.clientId ?? null,
        id: 11,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      vi.mocked(records.findContextById).mockResolvedValueOnce(
        context({
          record: {
            id: 11,
            weekId: 1,
            projectId: 4,
            clientId: null,
            description: 'Cleanup',
            hours: 2,
            date: '2026-10-19',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          project: { id: 4, name: 'Internal Tools', clientId: null },
          projectBillingHour: 95,
          client: null,
        }),
      );
      const created = await service.createForWeek(1, { ...input, projectId: 4 });
      expect(records.insert).toHaveBeenCalledWith(expect.objectContaining({ clientId: null }));
      expect(created.rate).toBe(95);
      expect(created.lineTotal).toBe(190);
    });

    it('rejects a record in a closed week with WEEK_CLOSED', async () => {
      const closed = createRepos(CLOSED_WEEK);
      const svc = new RecordsService(closed.records, closed.projects, closed.weeks);
      await expect(svc.createForWeek(1, input)).rejects.toBeInstanceOf(WeekClosedError);
      expect(closed.records.insert).not.toHaveBeenCalled();
    });

    it('rejects a date outside the week with a helpful 400', async () => {
      await expect(service.createForWeek(1, { ...input, date: '2026-10-26' })).rejects.toBeInstanceOf(
        ValidationError,
      );
      await expect(service.createForWeek(1, { ...input, date: '2026-10-18' })).rejects.toMatchObject({
        details: [
          { path: 'date', message: 'Date 2026-10-18 is outside week 43 (19-10-2026 – 25-10-2026)' },
        ],
      });
      expect(records.insert).not.toHaveBeenCalled();
    });

    it('accepts both endpoints of the week', async () => {
      await expect(service.createForWeek(1, { ...input, date: '2026-10-19' })).resolves.toBeTruthy();
      await expect(service.createForWeek(1, { ...input, date: '2026-10-25' })).resolves.toBeTruthy();
    });

    it('rejects an unknown week', async () => {
      await expect(service.createForWeek(99, input)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('rejects an unknown project', async () => {
      await expect(service.createForWeek(1, { ...input, projectId: 77 })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('rejects an archived project', async () => {
      vi.mocked(projects.findById).mockResolvedValueOnce(project({ archived: true }));
      await expect(service.createForWeek(1, input)).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('update', () => {
    it('applies a partial patch', async () => {
      const updated = await service.update(10, { hours: 4 });
      expect(records.update).toHaveBeenCalledWith(10, { hours: 4 });
      expect(updated.hours).toBe(4);
    });

    it('keeps the week client when only the description changes', async () => {
      await service.update(10, { description: 'Renamed task' });
      expect(records.update).toHaveBeenCalledWith(10, { description: 'Renamed task' });
      expect(projects.findById).not.toHaveBeenCalled();
    });

    it('re-derives clientId when the project changes', async () => {
      await service.update(10, { projectId: 4 });
      expect(projects.findById).toHaveBeenCalledWith(4);
    });

    it('rejects moving a record to another week date', async () => {
      await expect(service.update(10, { date: '2026-10-30' })).rejects.toBeInstanceOf(ValidationError);
      expect(records.update).not.toHaveBeenCalled();
    });

    it('rejects editing a record in a closed week', async () => {
      const closed = createRepos(CLOSED_WEEK);
      vi.mocked(closed.records.findContextById).mockResolvedValue(
        context({ record: { ...context().record } }),
      );
      const svc = new RecordsService(closed.records, closed.projects, closed.weeks);
      await expect(svc.update(10, { hours: 4 })).rejects.toBeInstanceOf(WeekClosedError);
      expect(closed.records.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown record', async () => {
      vi.mocked(records.findContextById).mockResolvedValueOnce(null);
      await expect(service.update(99, { hours: 4 })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('remove', () => {
    it('deletes the record', async () => {
      await expect(service.remove(10)).resolves.toEqual({ id: 10, deleted: true });
      expect(records.remove).toHaveBeenCalledWith(10);
    });

    it('rejects deleting from a closed week', async () => {
      const closed = createRepos(CLOSED_WEEK);
      const svc = new RecordsService(closed.records, closed.projects, closed.weeks);
      await expect(svc.remove(10)).rejects.toBeInstanceOf(WeekClosedError);
      expect(closed.records.remove).not.toHaveBeenCalled();
    });

    it('rejects an unknown record', async () => {
      vi.mocked(records.findContextById).mockResolvedValueOnce(null);
      await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});