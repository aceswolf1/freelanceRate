import { Router } from 'express';
import { ProjectsController } from './projects.controller.js';
import type { ProjectsService } from './projects.service.js';

export function createProjectsRouter(service: ProjectsService): Router {
  const controller = new ProjectsController(service);
  const router = Router();

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}