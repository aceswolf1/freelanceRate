import { Router } from 'express';
import { ClientsController } from './clients.controller.js';
import type { ClientsService } from './clients.service.js';

export function createClientsRouter(service: ClientsService): Router {
  const controller = new ClientsController(service);
  const router = Router();

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}