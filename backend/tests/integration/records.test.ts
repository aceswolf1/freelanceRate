import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, todayIso, weekStart } from '../../src/lib/dates.js';
import { api, resetDatabase, seedFixtures } from './helpers.js';

beforeEach(resetDatabase);

const monday = () => weekStart(todayIso());

async function openWeek(): Promise<{ id: number; startDate: string }> {
  const response = await api().get('/api/weeks/current').expect(200);
  return { id: response.body.data.id as number, startDate: response.body.data.startDate as string };
}

describe('work records', () => {
  it('creates a record and derives clientId, rate and lineTotal from the project', async () => {
    const { projectId } = await seedFixtures();
    const week = await openWeek();

    const response = await api()
      .post(`/api/weeks/${week.id}/records`)
      .send({ projectId, description: 'Checkout rebuild', hours: 3.5, date: week.startDate })
      .expect(201);

    expect(response.body.data).toMatchObject({
      weekId: week.id,
      projectId,
      clientId: 1,
      description: 'Checkout rebuild',
      hours: 3.5,
      date: week.startDate,
      rate: 130,
      lineTotal: 455,
    });
    expect(response.body.data.project).toMatchObject({ id: projectId, name: 'E-Commerce Storefront' });
    expect(response.body.data.client).toMatchObject({ id: 1, name: 'Acme Corp' });
  });

  it('stores a null client for standalone projects', async () => {
    const { standaloneProjectId } = await seedFixtures();
    const week = await openWeek();

    const response = await api()
      .post(`/api/weeks/${week.id}/records`)
      .send({ projectId: standaloneProjectId, description: 'Cleanup', hours: 2.5, date: week.startDate })
      .expect(201);

    expect(response.body.data).toMatchObject({ clientId: null, client: null, rate: 95, lineTotal: 237.5 });
  });

  it('accepts records on both weekends days', async () => {
    const { projectId } = await seedFixtures();
    const week = await openWeek();

    await api()
      .post(`/api/weeks/${week.id}/records`)
      .send({ projectId, description: 'Saturday work', hours: 1, date: addDays(week.startDate, 5) })
      .expect(201);
    await api()
      .post(`/api/weeks/${week.id}/records`)
      .send({ projectId, description: 'Sunday work', hours: 1, date: addDays(week.startDate, 6) })
      .expect(201);
  });

  it('rejects a date outside the week with 400 (R5)', async () => {
    const { projectId } = await seedFixtures();
    const week = await openWeek();

    const tooLate = await api()
      .post(`/api/weeks/${week.id}/records`)
      .send({ projectId, description: 'x', hours: 1, date: addDays(week.startDate, 7) })
      .expect(400);
    expect(tooLate.body.error.code).toBe('VALIDATION_ERROR');
    expect(tooLate.body.error.details[0].path).toBe('date');
    expect(tooLate.body.error.details[0].message).toContain('outside week');

    const tooEarly = await api()
      .post(`/api/weeks/${week.id}/records`)
      .send({ projectId, description: 'x', hours: 1, date: addDays(week.startDate, -1) })
      .expect(400);
    expect(tooEarly.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validates the hours range (R5)', async () => {
    const { projectId } = await seedFixtures();
    const week = await openWeek();

    for (const hours of [0, -1, 25, 7.555]) {
      const response = await api()
        .post(`/api/weeks/${week.id}/records`)
        .send({ projectId, description: 'x', hours, date: week.startDate })
        .expect(400);
      expect(response.body.error.details[0].path).toBe('hours');
    }
  });

  it('rejects an unknown project and an unknown week', async () => {
    const week = await openWeek();
    await api()
      .post(`/api/weeks/${week.id}/records`)
      .send({ projectId: 9999, description: 'x', hours: 1, date: week.startDate })
      .expect(404);
    await api()
      .post('/api/weeks/9999/records')
      .send({ projectId: 1, description: 'x', hours: 1, date: monday() })
      .expect(404);
  });

  it('rejects unknown fields and missing required fields', async () => {
    const { projectId } = await seedFixtures();
    const week = await openWeek();

    await api()
      .post(`/api/weeks/${week.id}/records`)
      .send({ projectId, description: 'x', hours: 1, date: week.startDate, clientId: 5 })
      .expect(400);
    await api().post(`/api/weeks/${week.id}/records`).send({ projectId }).expect(400);
  });

  it('updates a record with a partial patch', async () => {
    const { projectId } = await seedFixtures();
    const week = await openWeek();
    const created = await api()
      .post(`/api/weeks/${week.id}/records`)
      .send({ projectId, description: 'Original', hours: 2, date: week.startDate })
      .expect(201);
    const id = created.body.data.id as number;

    const updated = await api()
      .patch(`/api/records/${id}`)
      .send({ hours: 4, description: 'Revised' })
      .expect(200);
    expect(updated.body.data).toMatchObject({ id, hours: 4, description: 'Revised', date: week.startDate });
    expect(updated.body.data.lineTotal).toBe(520);
  });

  it('re-derives clientId when the record moves to another project', async () => {
    const { projectId, standaloneProjectId } = await seedFixtures();
    const week = await openWeek();
    const created = await api()
      .post(`/api/weeks/${week.id}/records`)
      .send({ projectId, description: 'x', hours: 2, date: week.startDate })
      .expect(201);

    const updated = await api()
      .patch(`/api/records/${created.body.data.id}`)
      .send({ projectId: standaloneProjectId })
      .expect(200);
    expect(updated.body.data).toMatchObject({ clientId: null, rate: 95, lineTotal: 190 });
  });

  it('rejects moving a record outside its week', async () => {
    const { projectId } = await seedFixtures();
    const week = await openWeek();
    const created = await api()
      .post(`/api/weeks/${week.id}/records`)
      .send({ projectId, description: 'x', hours: 2, date: week.startDate })
      .expect(201);

    await api()
      .patch(`/api/records/${created.body.data.id}`)
      .send({ date: addDays(week.startDate, 9) })
      .expect(400);
  });

  it('deletes a record', async () => {
    const { projectId } = await seedFixtures();
    const week = await openWeek();
    const created = await api()
      .post(`/api/weeks/${week.id}/records`)
      .send({ projectId, description: 'x', hours: 2, date: week.startDate })
      .expect(201);
    const id = created.body.data.id as number;

    const response = await api().delete(`/api/records/${id}`).expect(200);
    expect(response.body.data).toEqual({ id, deleted: true });

    const week2 = await api().get(`/api/weeks/${week.id}`).expect(200);
    expect(week2.body.data.totals.recordCount).toBe(0);
  });

  it('404s for an unknown record', async () => {
    await api().patch('/api/records/9999').send({ hours: 1 }).expect(404);
    await api().delete('/api/records/9999').expect(404);
  });

  describe('closed-week lock (R7)', () => {
    it('409 WEEK_CLOSED when creating a record in a closed week', async () => {
      const { projectId } = await seedFixtures();
      const week = await openWeek();
      await api().post(`/api/weeks/${week.id}/close`).expect(200);

      const response = await api()
        .post(`/api/weeks/${week.id}/records`)
        .send({ projectId, description: 'Too late', hours: 1, date: week.startDate })
        .expect(409);
      expect(response.body.error.code).toBe('WEEK_CLOSED');
    });

    it('409 WEEK_CLOSED when updating or deleting a record in a closed week', async () => {
      const { projectId } = await seedFixtures();
      const week = await openWeek();
      const created = await api()
        .post(`/api/weeks/${week.id}/records`)
        .send({ projectId, description: 'x', hours: 1, date: week.startDate })
        .expect(201);
      const id = created.body.data.id as number;

      await api().post(`/api/weeks/${week.id}/close`).expect(200);

      const update = await api().patch(`/api/records/${id}`).send({ hours: 2 }).expect(409);
      expect(update.body.error.code).toBe('WEEK_CLOSED');

      const remove = await api().delete(`/api/records/${id}`).expect(409);
      expect(remove.body.error.code).toBe('WEEK_CLOSED');
    });

    it('allows writes again after reopening', async () => {
      const { projectId } = await seedFixtures();
      const week = await openWeek();
      await api().post(`/api/weeks/${week.id}/close`).expect(200);
      await api().post(`/api/weeks/${week.id}/reopen`).expect(200);

      await api()
        .post(`/api/weeks/${week.id}/records`)
        .send({ projectId, description: 'Back on track', hours: 1, date: week.startDate })
        .expect(201);
    });

    it('rejects records against an archived project', async () => {
      const { projectId } = await seedFixtures();
      const week = await openWeek();
      await api().patch(`/api/projects/${projectId}`).send({ archived: true }).expect(200);

      const response = await api()
        .post(`/api/weeks/${week.id}/records`)
        .send({ projectId, description: 'x', hours: 1, date: week.startDate })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});