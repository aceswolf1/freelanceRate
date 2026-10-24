import { beforeEach, describe, expect, it } from 'vitest';
import { api, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);

describe('settings', () => {
  it('creates the singleton row on first read with the documented defaults', async () => {
    const response = await api().get('/api/settings').expect(200);
    expect(response.body.data).toMatchObject({
      id: 1,
      displayName: 'Alex Morgan',
      weeklyTargetHours: 40,
      currencySymbol: '$',
      invoicePrefix: 'INV',
    });
    expect(response.body.data.updatedAt).toEqual(expect.any(String));
  });

  it('keps returning the same single row on repeat reads', async () => {
    const first = await api().get('/api/settings').expect(200);
    const second = await api().get('/api/settings').expect(200);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it('applies a partial update and returns the full row', async () => {
    const response = await api()
      .put('/api/settings')
      .send({ weeklyTargetHours: 35, currencySymbol: '€' })
      .expect(200);
    expect(response.body.data).toMatchObject({
      weeklyTargetHours: 35,
      currencySymbol: '€',
      displayName: 'Alex Morgan',
      invoicePrefix: 'INV',
    });
  });

  it('drives the below-target computation on the weekly timesheet', async () => {
    await api().put('/api/settings').send({ weeklyTargetHours: 1 }).expect(200);

    const client = await api()
      .post('/api/clients')
      .send({ name: 'Acme', contactEmail: 'a@acme.example', billingHour: 100 })
      .expect(201);
    const project = await api()
      .post('/api/projects')
      .send({ name: 'Work', clientId: client.body.data.id })
      .expect(201);

    const week = await api().get('/api/weeks/current').expect(200);
    await api()
      .post(`/api/weeks/${week.body.data.id}/records`)
      .send({
        projectId: project.body.data.id,
        description: 'Some work',
        hours: 2,
        date: week.body.data.startDate,
      })
      .expect(201);

    const updated = await api().get('/api/weeks/current').expect(200);
    expect(updated.body.data.totals).toMatchObject({
      totalHours: 2,
      targetHours: 1,
      belowTarget: false,
      hoursBelowTarget: 0,
    });
  });

  it('rejects invalid settings values', async () => {
    await api().put('/api/settings').send({ weeklyTargetHours: 0 }).expect(400);
    await api().put('/api/settings').send({ weeklyTargetHours: 200 }).expect(400);
    await api().put('/api/settings').send({ invoicePrefix: 'bad prefix!' }).expect(400);
    await api().put('/api/settings').send({ displayName: '' }).expect(400);
  });

  it('refuses to change the singleton id', async () => {
    await api().put('/api/settings').send({ id: 2 } as Record<string, unknown>).expect(400);
  });
});