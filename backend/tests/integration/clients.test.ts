import { beforeEach, describe, expect, it } from 'vitest';
import { api, resetDatabase, seedFixtures } from './helpers.js';

beforeEach(resetDatabase);

describe('clients CRUD', () => {
  it('creates a client with its embedded platform and counts', async () => {
    const { payoneerId } = await seedFixtures();
    const response = await api()
      .post('/api/clients')
      .send({
        // `seedFixtures()` already created an "Acme Corp"; client names are
        // unique (case-insensitive), so a second one would be a 409.
        name: 'Globex Corp',
        contactEmail: 'billing@globex.example',
        ccEmail: 'finance@globex.example',
        billingHour: 130,
        paymentPlatformId: payoneerId,
        notes: 'Net 15',
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      name: 'Globex Corp',
      contactEmail: 'billing@globex.example',
      ccEmail: 'finance@globex.example',
      billingHour: 130,
      paymentPlatformId: payoneerId,
      notes: 'Net 15',
    });
    expect(response.body.data.paymentPlatform).toMatchObject({
      id: payoneerId,
      company: 'Payoneer',
      feePercent: 1,
    });
    expect(response.body.data.projectCount).toBe(0);
    expect(response.body.data.totalHours).toBe(0);
    expect(response.body.data.totalGross).toBe(0);
  });

  it('lists clients ordered by name with a null platform when unset', async () => {
    await api()
      .post('/api/clients')
      .send({ name: 'Zeta', contactEmail: 'z@zeta.example', billingHour: 50 })
      .expect(201);
    await api()
      .post('/api/clients')
      .send({ name: 'Acme Corp', contactEmail: 'a@acme.example', billingHour: 130 })
      .expect(201);

    const listed = await api().get('/api/clients').expect(200);
    expect(listed.body.data.map((c: { name: string }) => c.name)).toEqual(['Acme Corp', 'Zeta']);
    expect(listed.body.data[0].paymentPlatform).toBeNull();
  });

  it('updates only the supplied fields', async () => {
    const { clientId } = await seedFixtures();
    const response = await api()
      .patch(`/api/clients/${clientId}`)
      .send({ billingHour: 140 })
      .expect(200);
    expect(response.body.data).toMatchObject({ id: clientId, billingHour: 140, name: 'Acme Corp' });
  });

  it('rejects an invalid email, a zero rate and unknown keys', async () => {
    await api()
      .post('/api/clients')
      .send({ name: 'Bad', contactEmail: 'not-an-email', billingHour: 0 })
      .expect(400);
    await api()
      .post('/api/clients')
      .send({ name: 'Bad', contactEmail: 'ok@x.example', billingHour: 10, extra: 1 })
      .expect(400);
  });

  it('rejects a payment platform that does not exist', async () => {
    const response = await api()
      .post('/api/clients')
      .send({ name: 'Ghost', contactEmail: 'g@g.example', billingHour: 10, paymentPlatformId: 999 })
      .expect(400);
    expect(response.body.error.details[0].path).toBe('paymentPlatformId');
  });

  it('rejects a duplicate name with 409', async () => {
    await seedFixtures();
    const response = await api()
      .post('/api/clients')
      .send({ name: 'acme corp', contactEmail: 'x@acme.example', billingHour: 99 })
      .expect(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('blocks deletion while projects reference the client (409)', async () => {
    const { clientId } = await seedFixtures();
    const response = await api().delete(`/api/clients/${clientId}`).expect(409);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.details.projectCount).toBeGreaterThan(0);
  });

  it('deletes an unreferenced client', async () => {
    const created = await api()
      .post('/api/clients')
      .send({ name: 'Temp', contactEmail: 't@t.example', billingHour: 10 })
      .expect(201);
    const id = created.body.data.id as number;
    const response = await api().delete(`/api/clients/${id}`).expect(200);
    expect(response.body.data).toEqual({ id, deleted: true });
    await api().get(`/api/clients/${id}`).expect(404);
  });

  it('404s on an unknown id', async () => {
    await api().get('/api/clients/4242').expect(404);
  });
});