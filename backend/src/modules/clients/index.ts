import { getDb } from '../../db/client.js';
import { DrizzleClientsRepository } from './clients.repository.js';
import { createClientsRouter } from './clients.routes.js';
import { ClientsService } from './clients.service.js';

export const clientsService = new ClientsService(new DrizzleClientsRepository(getDb()));

export { DrizzleClientsRepository } from './clients.repository.js';
export { createClientsRouter } from './clients.routes.js';
export { ClientsService } from './clients.service.js';
export type * from './clients.service.js';

export default createClientsRouter(clientsService);