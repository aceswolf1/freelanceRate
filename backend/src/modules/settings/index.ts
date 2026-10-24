import { getDb } from '../../db/client.js';
import { DrizzleSettingsRepository } from './settings.repository.js';
import { createSettingsRouter } from './settings.routes.js';
import { SettingsService } from './settings.service.js';

export const settingsService = new SettingsService(new DrizzleSettingsRepository(getDb()));

export { DrizzleSettingsRepository } from './settings.repository.js';
export { createSettingsRouter } from './settings.routes.js';
export { SettingsService } from './settings.service.js';
export type * from './settings.service.js';

export default createSettingsRouter(settingsService);