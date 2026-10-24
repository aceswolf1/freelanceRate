import { getDb } from '../../db/client.js';
import { settingsService } from '../settings/index.js';
import { DrizzleWeeksRepository } from './weeks.repository.js';
import { createWeeksRouter } from './weeks.routes.js';
import { WeeksService } from './weeks.service.js';

export const weeksService = new WeeksService(
  new DrizzleWeeksRepository(getDb()),
  settingsService,
);

export { DrizzleWeeksRepository } from './weeks.repository.js';
export { createWeeksRouter } from './weeks.routes.js';
export { WeeksService } from './weeks.service.js';
export type * from './weeks.service.js';

export default createWeeksRouter(weeksService);