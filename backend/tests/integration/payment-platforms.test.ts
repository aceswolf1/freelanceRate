import { beforeEach, describe, expect, it } from 'vitest';
import { api, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);

describe('payment-platforms CRUD', () => {
  it('creates, lists, updates and deletes', async () => {
    const created = await api()
      .post('/api/payment-platforms')
      .send({ company: 'Payoneer', feePercent: 1, feeFlat: 0 })
      .expect(201);
    expect(created.body.data).toMatchObject({ company: 'Payoneer', feePercent: 1, feeFlat: 0 });
    expect(typeof created.body.data.id).toBe('number');
    expect(created.body.data.createdAt).toEqual(expect.any(String));

    const listed = await api().get('/api/payment-platforms').expect(200);
    expect(listed.body.data).toHaveLength(1);

    const id = created.body.data.id as number;
    const fetched = await api().get(`/api/payment-platforms/${id}`).expect(200);
    expect(fetched.body.data.company).toBe('Payoneer');

    const patched = await api()
      .patch(`/api/payment-platforms/${id}`)
      .send({ feePercent: 1.5 })
      .expect(200);
    expect(patched.body.data).toMatchObject({ feePercent: 1.5, company: 'Payoneer' });

    const removed = await api().delete(`/api/payment-platforms/${id}`).expect(200);
    expect(removed.body.data).toEqual({ id, deleted: true });

    const emptied = await api().get('/api/payment-platforms').expect(200);
    expect(emptied.body.data).toHaveLength(0);
  });

  it('lists platforms ordered by company', async () => {
    await api().post('/api/payment-platforms').send({ company: 'Wise', feePercent: 0.5 }).expect(201);
    await api().post('/api/payment-platforms').send({ company: 'Domestic Wire', feeFlat: 15 }).expect(201);
    const listed = await api().get('/api/payment-platforms').expect(200);
    expect(listed.body.data.map((p: { company: string }) => p.company)).toEqual([
      'Domestic Wire',
      'Wise',
    ]);
  });

  it('defaults both fees to zero', async () => {
    const created = await api().post('/api/payment-platforms').send({ company: 'Stripe' }).expect(201);
    expect(created.body.data).toMatchObject({ feePercent: 0, feeFlat: 0 });
  });

  it('rejects a duplicate company with 409', async () => {
    await api().post('/api/payment-platforms').send({ company: 'Payoneer' }).expect(201);
    const conflict = await api().post('/api/payment-platforms').send({ company: 'payoneer' }).expect(409);
    expect(conflict.body.error).toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects an invalid payload with 400 and issue details', async () => {
    const response = await api()
      .post('/api/payment-platforms')
      .send({ company: '', feePercent: 150 })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'company',
      'feePercent',
    ]);
  });

  it('rejects unknown keys', async () => {
    await api()
      .post('/api/payment-platforms')
      .send({ company: 'Payoneer', sneaky: true })
      .expect(400);
  });

  it('404s on an unknown id and 400s on a malformed id', async () => {
    const missing = await api().get('/api/payment-platforms/999').expect(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');

    const malformed = await api().get('/api/payment-platforms/abc').expect(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
  });
});