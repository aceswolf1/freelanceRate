import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, NotFoundError, WeekClosedError } from '../../lib/http.js';
import { todayIso, weekStart } from '../../lib/dates.js';
import type { RecordContextRow } from '../records/record-context.js';
import type { WeekRow, WeeksRepository } from './weeks.repository.js';
import { WeeksService } from './weeks.service.js';
import type { SettingsService } from '../settings/settings.service.js';

const ACME = { id: 1, name: 'Acme Corp', contactEmail: 'billing@acme.example', ccEmail: null, billingHour: 130 };
const STARLIGHT = {
  id: 2,
  name: 'Starlight Media',
  contactEmail: 'accounts@starlight.example',
  ccEmail: null,
  billingHour: 100,
};

function week(overrides: Partial<WeekRow> = {}): WeekRow {
  return {
    id: 1,
    startDate: '2026-10-19',
    status: 'open',
    closedAt: null,
    createdAt: new Date('2026-10-19T08:00:00.000Z'),
    ...overrides,
  };
}

function recordRow(overrides: Partial<RecordContextRow> = {}): RecordContextRow {
  const record = {
    id: 1,
    weekId: 1,
    projectId: 1,
    clientId: 1,
    description: 'Checkout flow rebuild',
    hours: 3.5,
    date: '2026-10-19',
    createdAt: new Date('2026-10-19T08:00:00.000Z'),
    updatedAt: new Date('2026-10-19T08:00:00.000Z'),
    ...(overrides.record ?? {}),
  };
  return {
    record,
    project: overrides.project === undefined ? { id: 1, name: 'E-Commerce Storefront', clientId: 1 } : overrides.project,
    projectBillingHour: overrides.projectBillingHour ?? null,
    client: overrides.client === undefined ? ACME : overrides.client,
  };
}

function createRepo(seedWeeks: WeekRow[] = [week()]): WeeksRepository {
  const rows = [...seedWeeks];
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
  let invoiceCount = 0;
  return {
    findById: vi.fn(async (id) => rows.find((r) => r.id === id) ?? null),
    findByStartDate: vi.fn(async (startDate) => rows.find((r) => r.startDate === startDate) ?? null),
    insert: vi.fn(async (values) => {
      const created = week({ ...values, id: nextId++ });
      rows.push(created);
      return created;
    }),
    updateStatus: vi.fn(async (id, status, closedAt) => {
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1) return null;
      const updated = { ...rows[index]!, status, closedAt };
      rows[index] = updated;
      return updated;
    }),
    getRecordContexts: vi.fn(async () => [] as RecordContextRow[]),
    countInvoices: vi.fn(async () => invoiceCount),
    setInvoiceCount: (value: number) => {
      invoiceCount = value;
    },
  } as WeeksRepository & { setInvoiceCount: (value: number) => void };
}

function settingsStub(target = 40): SettingsService {
  return { get: vi.fn(async () => ({ weeklyTargetHours: target })) } as unknown as SettingsService;
}

describe('WeeksService', () => {
  let repo: WeeksRepository;
  let service: WeeksService;

  beforeEach(() => {
    repo = createRepo();
    service = new WeeksService(repo, settingsStub());
  });

  describe('current', () => {
    // "Today" must fall inside the fixture week (2026-10-19 … 25) or these
    // assertions depend on the real calendar. Midday UTC is the same date in
    // every timezone from UTC-11 to UTC+11. Only Date is faked.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('creates the week containing today when it does not exist', async () => {
      const empty = createRepo([]);
      const svc = new WeeksService(empty, settingsStub());
      const result = await svc.current();
      expect(empty.insert).toHaveBeenCalledWith({
        startDate: weekStart(todayIso()),
        status: 'open',
      });
      expect(result.startDate).toBe(weekStart(todayIso()));
    });

    it('reuses an existing week instead of inserting', async () => {
      const result = await service.current();
      expect(result.id).toBe(1);
      expect(repo.insert).not.toHaveBeenCalled();
    });

    it('re-reads the row when a concurrent insert wins the unique index race', async () => {
      const loser = createRepo([week()]);
      // First read misses (other writer has not committed yet), then the insert
      // trips the unique index and the row is there on the re-read.
      vi.mocked(loser.findByStartDate).mockResolvedValueOnce(null);
      vi.mocked(loser.insert).mockRejectedValueOnce(
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      );
      const svc = new WeeksService(loser, settingsStub());
      const result = await svc.current();
      expect(result.id).toBe(1); // the row the other writer inserted
    });
  });

  describe('byDate', () => {
    it('resolves any date to the Monday of its week', async () => {
      const svc = new WeeksService(repo, settingsStub());
      await svc.byDate('2026-10-25'); // Sunday
      expect(repo.findByStartDate).toHaveBeenCalledWith('2026-10-19');
    });
  });

  describe('get', () => {
    it('throws NOT_FOUND for an unknown id', async () => {
      await expect(service.get(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('close / reopen', () => {
    it('closes an open week', async () => {
      const result = await service.close(1);
      expect(result).toEqual({
        id: 1,
        status: 'closed',
        closedAt: expect.any(String),
      });
    });

    it('refuses to close a closed week', async () => {
      const closed = createRepo([week({ status: 'closed', closedAt: new Date('2026-10-25T23:59:00Z') })]);
      const svc = new WeeksService(closed, settingsStub());
      await expect(svc.close(1)).rejects.toBeInstanceOf(WeekClosedError);
    });

    it('throws NOT_FOUND when closing an unknown week', async () => {
      await expect(service.close(99)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('reopens a closed week with no invoices', async () => {
      const closed = createRepo([week({ status: 'closed', closedAt: new Date('2026-10-25T23:59:00Z') })]);
      const svc = new WeeksService(closed, settingsStub());
      const result = await svc.reopen(1);
      expect(result).toEqual({ id: 1, status: 'open', closedAt: null });
    });

    it('refuses to reopen a week that already has invoices', async () => {
      const withRepo = createRepo([week({ status: 'closed', closedAt: new Date('2026-10-25T23:59:00Z') })]);
      vi.mocked(withRepo.countInvoices).mockResolvedValueOnce(2);
      const svc = new WeeksService(withRepo, settingsStub());
      await expect(svc.reopen(1)).rejects.toBeInstanceOf(ConflictError);
    });

    it('refuses to reopen a week that is already open', async () => {
      await expect(service.reopen(1)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('week payload', () => {
    beforeEach(() => {
      vi.mocked(repo.getRecordContexts).mockResolvedValue([
        recordRow({ record: { id: 1, weekId: 1, projectId: 1, clientId: 1, description: 'a', hours: 3.5, date: '2026-10-19', createdAt: new Date('2026-10-19T08:00:00Z'), updatedAt: new Date('2026-10-19T08:00:00Z') } }),
        recordRow({
          record: { id: 2, weekId: 1, projectId: 2, clientId: 1, description: 'b', hours: 2, date: '2026-10-19', createdAt: new Date('2026-10-19T09:00:00Z'), updatedAt: new Date('2026-10-19T09:00:00Z') },
          project: { id: 2, name: 'API Microservice', clientId: 1 },
        }),
        recordRow({
          record: { id: 3, weekId: 1, projectId: 3, clientId: null, description: 'c', hours: 2.5, date: '2026-10-24', createdAt: new Date('2026-10-24T08:00:00Z'), updatedAt: new Date('2026-10-24T08:00:00Z') },
          project: { id: 3, name: 'Internal Tools', clientId: null },
          projectBillingHour: 95,
          client: null,
        }),
        recordRow({
          record: { id: 4, weekId: 1, projectId: 4, clientId: 2, description: 'd', hours: 14.5, date: '2026-10-20', createdAt: new Date('2026-10-20T08:00:00Z'), updatedAt: new Date('2026-10-20T08:00:00Z') },
          project: { id: 4, name: 'Video Streaming Mobile App', clientId: 2 },
          projectBillingHour: 115,
          client: STARLIGHT,
        }),
      ]);
    });

    it('builds seven days, Monday first, including empty ones', async () => {
      const result = await service.get(1);
      expect(result.days).toHaveLength(7);
      expect(result.days.map((day) => day.date)).toEqual([
        '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
        '2026-10-23', '2026-10-24', '2026-10-25',
      ]);
      expect(result.days[0]?.records).toHaveLength(2);
      expect(result.days[2]?.records).toHaveLength(0);
    });

    it('flags weekend days but keeps them insertable', async () => {
      const result = await service.get(1);
      expect(result.days[5]?.isWeekend).toBe(true); // Sat
      expect(result.days[5]?.dayName).toBe('Sat');
      expect(result.days[0]?.isWeekend).toBe(false);
    });

    it('exposes the R4 label and ISO week number', async () => {
      const result = await service.get(1);
      expect(result.label).toBe('Week 43: 19-10-2026 – 25-10-2026');
      expect(result.isoWeek).toBe(43);
      expect(result.endDate).toBe('2026-10-25');
    });

    it('computes per-day hours and gross using effective rates', async () => {
      const result = await service.get(1);
      const monday = result.days[0];
      expect(monday?.hours).toBe(5.5);
      expect(monday?.projectedGross).toBe(715); // 3.5*130 + 2*130
    });

    it('applies the project rate override', async () => {
      const result = await service.get(1);
      expect(result.days[1]?.projectedGross).toBe(1667.5); // 14.5 * 115
      expect(result.days[1]?.records[0]?.rate).toBe(115);
    });

    it('sums week totals with the target comparison', async () => {
      const { totals } = await service.get(1);
      expect(totals.totalHours).toBe(22.5);
      // 3.5*130 + 2*130 + 2.5*95 + 14.5*115
      expect(totals.projectedGross).toBe(2620);
      expect(totals.targetHours).toBe(40);
      expect(totals.belowTarget).toBe(true);
      expect(totals.hoursBelowTarget).toBe(17.5);
      expect(totals.recordCount).toBe(4);
      expect(totals.clientCount).toBe(2); // standalone is not a client
    });

    it('groups totals per project with the rate that was applied', async () => {
      const { totals } = await service.get(1);
      const byProject = totals.byProject;
      expect(byProject).toHaveLength(4);
      expect(byProject.find((p) => p.projectId === 1)).toMatchObject({
        projectName: 'E-Commerce Storefront',
        clientName: 'Acme Corp',
        rate: 130,
        hours: 3.5,
        gross: 455,
      });
      expect(byProject.find((p) => p.projectId === 4)).toMatchObject({ rate: 115, gross: 1667.5 });
    });

    it('buckets standalone work under a null client', async () => {
      const { totals } = await service.get(1);
      expect(totals.byClient).toEqual(
        expect.arrayContaining([
          { clientId: 1, clientName: 'Acme Corp', hours: 5.5, gross: 715 },
          { clientId: 2, clientName: 'Starlight Media', hours: 14.5, gross: 1667.5 },
          { clientId: null, clientName: null, hours: 2.5, gross: 237.5 },
        ]),
      );
    });

    it('honours a custom weekly target', async () => {
      const svc = new WeeksService(repo, settingsStub(20));
      const { totals } = await svc.get(1);
      expect(totals.targetHours).toBe(20);
      expect(totals.belowTarget).toBe(false);
      expect(totals.hoursBelowTarget).toBe(0);
    });

    it('never reports belowTarget when the target is exactly met', async () => {
      const svc = new WeeksService(repo, settingsStub(22.5));
      const { totals } = await svc.get(1);
      expect(totals.belowTarget).toBe(false);
      expect(totals.hoursBelowTarget).toBe(0);
    });

    it('reports the week as empty when it has no records', async () => {
      vi.mocked(repo.getRecordContexts).mockResolvedValue([]);
      const result = await service.get(1);
      expect(result.totals.totalHours).toBe(0);
      expect(result.totals.byProject).toEqual([]);
      expect(result.days.every((day) => day.records.length === 0)).toBe(true);
    });
  });

  describe('records listing', () => {
    it('returns the week records as DTOs', async () => {
      vi.mocked(repo.getRecordContexts).mockResolvedValue([recordRow()]);
      const records = await service.listRecords(1);
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ rate: 130, lineTotal: 455, clientId: 1 });
    });

    it('throws NOT_FOUND for an unknown week', async () => {
      await expect(service.listRecords(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('invoiceCount', () => {
    it('is included in the week payload', async () => {
      vi.mocked(repo.countInvoices).mockResolvedValue(3);
      const result = await service.get(1);
      expect(result.invoiceCount).toBe(3);
    });
  });
});