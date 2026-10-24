import { beforeEach, describe, expect, it } from 'vitest';
import { api, resetDatabase, seedFixtures } from './helpers.js';

beforeEach(resetDatabase);

describe('projects CRUD', () => {
  it('inherits the client rate when no override is given', async () => {
    const { clientId } = await seedFixtures();
    const response = await api()
      .post('/api/projects')
      .send({ name: 'API Microservice', clientId })
      .expect(201);

    expect(response.body.data).toMatchObject({
      name: 'API Microservice',
      clientId,
      billingHour: null,
      effectiveRate: 130,
      rateSource: 'client',
      standalone: false,
      archived: false,
    });
    expect(response.body.data.client).toMatchObject({ id: clientId, name: 'Acme Corp', billingHour: 130 });
  });

  it('prefers a project rate override', async () => {
    const { clientId } = await seedFixtures();
    const response = await api()
      .post('/api/projects')
      .send({ name: 'Video App', clientId, billingHour: 115 })
      .expect(201);
    expect(response.body.data).toMatchObject({ effectiveRate: 115, rateSource: 'project' });
  });

  it('creates a standalone project with its own rate', async () => {
    const response = await api()
      .post('/api/projects')
      .send({ name: 'Internal Tools', clientId: null, billingHour: 95 })
      .expect(201);
    expect(response.body.data).toMatchObject({
      clientId: null,
      client: null,
      standalone: true,
      effectiveRate: 95,
      rateSource: 'project',
    });
  });

  it('rejects a standalone project without a rate (R2)', async () => {
    const response = await api()
      .post('/api/projects')
      .send({ name: 'No Rate', clientId: null })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].path).toBe('billingHour');
  });

  it('filters by client, standalone and archived', async () => {
    // One fixture is enough: it creates one client (id 1) with one project plus
    // one standalone project. Seeding twice would create a second "Payoneer"
    // platform and a second "Acme Corp" client, both of which are duplicates.
    await seedFixtures();

    const standalone = await api().get('/api/projects?standalone=true').expect(200);
    expect(standalone.body.data.map((p: { name: string }) => p.name)).toEqual(['Internal Tools']);

    const byClient = await api().get('/api/projects?clientId=1').expect(200);
    expect(byClient.body.data.map((p: { name: string }) => p.name)).toEqual(['E-Commerce Storefront']);

    const none = await api().get('/api/projects?clientId=none').expect(200);
    expect(none.body.data).toHaveLength(1);

    const all = await api().get('/api/projects').expect(200);
    expect(all.body.data).toHaveLength(2);
  });

  it('hides archived projects unless explicitly requested', async () => {
    const { projectId } = await seedFixtures();
    await api().patch(`/api/projects/${projectId}`).send({ archived: true }).expect(200);

    const visible = await api().get('/api/projects').expect(200);
    expect(visible.body.data.map((p: { name: string }) => p.name)).toEqual(['Internal Tools']);

    const withArchived = await api().get('/api/projects?archived=all').expect(200);
    expect(withArchived.body.data).toHaveLength(2);

    const onlyArchived = await api().get('/api/projects?archived=true').expect(200);
    expect(onlyArchived.body.data.map((p: { name: string }) => p.name)).toEqual(['E-Commerce Storefront']);
  });

  it('rejects an invalid filter value', async () => {
    await api().get('/api/projects?archived=maybe').expect(400);
  });

  it('rejects an unknown client', async () => {
    const response = await api()
      .post('/api/projects')
      .send({ name: 'Ghost', clientId: 999 })
      .expect(400);
    expect(response.body.error.details[0].path).toBe('clientId');
  });

  it('rejects a duplicate name for the same client with 409', async () => {
    await seedFixtures();
    const response = await api()
      .post('/api/projects')
      .send({ name: 'e-commerce storefront', clientId: 1 })
      .expect(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('updates a project and recomputes the effective rate', async () => {
    const { projectId } = await seedFixtures();
    const response = await api()
      .patch(`/api/projects/${projectId}`)
      .send({ billingHour: 111 })
      .expect(200);
    expect(response.body.data).toMatchObject({ effectiveRate: 111, rateSource: 'project' });
  });

  it('refuses to make a rate-less project standalone', async () => {
    const { projectId } = await seedFixtures();
    await api().patch(`/api/projects/${projectId}`).send({ clientId: null }).expect(400);
  });

  it('blocks deletion while work records reference it (409)', async () => {
    const { standaloneProjectId } = await seedFixtures();
    const week = await api().get('/api/weeks/current').expect(200);
    const weekId = week.body.data.id as number;
    await api()
      .post(`/api/weeks/${weekId}/records`)
      .send({
        projectId: standaloneProjectId,
        description: 'Cleanup',
        hours: 1.5,
        date: week.body.data.startDate,
      })
      .expect(201);

    const response = await api().delete(`/api/projects/${standaloneProjectId}`).expect(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('deletes an unreferenced project', async () => {
    const { projectId } = await seedFixtures();
    const response = await api().delete(`/api/projects/${projectId}`).expect(200);
    expect(response.body.data).toEqual({ id: projectId, deleted: true });
    await api().get(`/api/projects/${projectId}`).expect(404);
  });
});