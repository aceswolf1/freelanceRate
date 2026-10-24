import { getDb } from '../../db/client.js';
import { DrizzleProjectsRepository } from './projects.repository.js';
import { createProjectsRouter } from './projects.routes.js';
import { ProjectsService } from './projects.service.js';

export const projectsService = new ProjectsService(new DrizzleProjectsRepository(getDb()));

export { DrizzleProjectsRepository } from './projects.repository.js';
export { createProjectsRouter } from './projects.routes.js';
export { ProjectsService } from './projects.service.js';
export type * from './projects.service.js';

export default createProjectsRouter(projectsService);