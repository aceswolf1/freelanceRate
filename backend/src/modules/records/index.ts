import { getDb } from '../../db/client.js';
import { DrizzleProjectsRepository } from '../projects/projects.repository.js';
import { DrizzleWeeksRepository } from '../weeks/weeks.repository.js';
import { DrizzleRecordsRepository } from './records.repository.js';
import { createRecordsRouters } from './records.routes.js';
import { RecordsService } from './records.service.js';

export const recordsService = new RecordsService(
  new DrizzleRecordsRepository(getDb()),
  new DrizzleProjectsRepository(getDb()),
  new DrizzleWeeksRepository(getDb()),
);

export const { weekRecordsRouter, recordsRouter } = createRecordsRouters(recordsService);

export { DrizzleRecordsRepository } from './records.repository.js';
export { createRecordsRouters } from './records.routes.js';
export { RecordsService } from './records.service.js';
export type * from './records.service.js';
export * from './record-context.js';