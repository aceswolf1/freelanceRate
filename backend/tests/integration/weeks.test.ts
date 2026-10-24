import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, todayIso, weekStart } from '../../src/lib/dates.js';
import { api, resetDatabase, seedFixtures } from './helpers.js';

beforeEach(resetDatabase);

describe('weeks', () => {
  it('auto-creates and returns the current Monday–Sunday week with 7 days', async () => {
    const response = await api().get('/api/weeks/current').expect(200);
    const week = response.body.data;

    expect(week.startDate).toBe(weekStart(todayIso()));
    expect(week.endDate).toBe(addDays(week.startDate, 6));
    expect(week.days).toHaveLength(7);
    expect(week.days.map((d: { dayName: string }) => d.dayName)).toEqual([
      'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
    ]);
    expect(week.days[0].date).toBe(week.startDate);
    expect(week.days[6].date).toBe(week.endDate);
    expect(week.status).toBe('open');
    expect(week.label).toMatch(/^Week \d+: \d{2}-\d{2}-\d{4} – \d{2}-\d{2}-\d{4}$/);
  });

  it('returns the same week row on a second call instead of creating another', async () => {
    const first = await api().get('/api/weeks/current').expect(200);
    const second = await api().get('/api/weeks/current').expect(200);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it('resolves any date to its week via by-date, creating it on demand', async () => {
    const target = addDays(weekStart(todayIso()), 3); // a Thursday this week
    const response = await api().get(`/api/weeks/by-date/${target}`).expect(200);
    expect(response.body.data.startDate).toBe(weekStart(todayIso()));
  });

  it('rolls a Sunday back to the previous Monday', async () => {
    const sunday = addDays(weekStart(todayIso()), 6);
    const response = await api().get(`/api/weeks/by-date/${sunday}`).expect(200);
    expect(response.body.data.startDate).toBe(weekStart(todayIso()));
  });

  it('400s on a malformed date', async () => {
    await api().get('/api/weeks/by-date/2026-02-30').expect(400);
    await api().get('/api/weeks/by-date/not-a-date').expect(400);
  });

  it('404s on an unknown week id', async () => {
    await api().get('/api/weeks/9999').expect(404);
  });

  it('aggregates hours, gross, per-project and per-client totals', async () => {
    const { projectId, standaloneProjectId } = await seedFixtures();
    const week = await api().get('/api/weeks/current').expect(200);
    const weekId = week.body.data.id as number;
    const monday = week.body.data.startDate as string;

    await api()
      .post(`/api/weeks/${weekId}/records`)
      .send({ projectId, description: 'Storefront work', hours: 3.5, date: monday })
      .expect(201);
    await api()
      .post(`/api/weeks/${weekId}/records`)
      .send({ projectId, description: 'More storefront', hours: 4, date: addDays(monday, 1) })
      .expect(201);
    await api()
      .post(`/api/weeks/${weekId}/records`)
      .send({
        projectId: standaloneProjectId,
        description: 'Internal cleanup',
        hours: 2.5,
        date: addDays(monday, 5),
      })
      .expect(201);

    const totals = (await api().get(`/api/weeks/${weekId}`).expect(200)).body.data.totals;
    expect(totals).toMatchObject({
      totalHours: 10,
      projectedGross: 1212.5, // 7.5*130 + 2.5*95 = 975 + 237.5
      targetHours: 40,
      belowTarget: true,
      hoursBelowTarget: 30,
      clientCount: 1,
      recordCount: 3,
    });
    expect(totals.byProject).toEqual([
      { projectId, projectName: 'E-Commerce Storefront', clientId: 1, clientName: 'Acme Corp', rate: 130, hours: 7.5, gross: 975 },
      { projectId: standaloneProjectId, projectName: 'Internal Tools', clientId: null, clientName: null, rate: 95, hours: 2.5, gross: 237.5 },
    ]);
    expect(totals.byClient).toEqual([
      { clientId: 1, clientName: 'Acme Corp', hours: 7.5, gross: 975 },
      { clientId: null, clientName: null, hours: 2.5, gross: 237.5 },
    ]);
  });

  it('computes per-day totals and flags the weekend', async () => {
    const { projectId } = await seedFixtures();
    const week = await api().get('/api/weeks/current').expect(200);
    const monday = week.body.data.startDate as string;

    await api()
      .post(`/api/weeks/${week.body.data.id}/records`)
      .send({ projectId, description: 'Weekend work', hours: 2, date: addDays(monday, 5) })
      .expect(201);

    const days = (await api().get(`/api/weeks/${week.body.data.id}`).expect(200)).body.data.days;
    const saturday = days[5];
    expect(saturday.isWeekend).toBe(true);
    expect(saturday.dayOfWeek).toBe(6);
    expect(saturday.hours).toBe(2);
    expect(saturday.projectedGross).toBe(260);
    expect(saturday.records).toHaveLength(1);
  });

  it('exposes week records via the dedicated listing endpoint', async () => {
    const { projectId } = await seedFixtures();
    const week = await api().get('/api/weeks/current').expect(200);
    await api()
      .post(`/api/weeks/${week.body.data.id}/records`)
      .send({
        projectId,
        description: 'Listed',
        hours: 1,
        date: week.body.data.startDate,
      })
      .expect(201);

    const records = await api().get(`/api/weeks/${week.body.data.id}/records`).expect(200);
    expect(records.body.data).toHaveLength(1);
    expect(records.body.data[0]).toMatchObject({ hours: 1, rate: 130, lineTotal: 130 });
  });

  describe('close / reopen', () => {
    it('closes then reopens a week', async () => {
      const week = await api().get('/api/weeks/current').expect(200);
      const id = week.body.data.id as number;

      const closed = await api().post(`/api/weeks/${id}/close`).expect(200);
      expect(closed.body.data).toMatchObject({ id, status: 'closed' });
      expect(closed.body.data.closedAt).toEqual(expect.any(String));

      const reopened = await api().post(`/api/weeks/${id}/reopen`).expect(200);
      expect(reopened.body.data).toEqual({ id, status: 'open', closedAt: null });
    });

    it('409 WEEK_CLOSED when closing twice', async () => {
      const week = await api().get('/api/weeks/current').expect(200);
      const id = week.body.data.id as number;
      await api().post(`/api/weeks/${id}/close`).expect(200);

      const response = await api().post(`/api/weeks/${id}/close`).expect(409);
      expect(response.body.error.code).toBe('WEEK_CLOSED');
    });

    it('409 CONFLICT when reopening an open week', async () => {
      const week = await api().get('/api/weeks/current').expect(200);
      const response = await api().post(`/api/weeks/${week.body.data.id}/reopen`).expect(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('404s when closing an unknown week', async () => {
      await api().post('/api/weeks/9999/close').expect(404);
      await api().post('/api/weeks/9999/reopen').expect(404);
    });
  });
});