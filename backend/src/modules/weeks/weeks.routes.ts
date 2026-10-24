import { Router } from 'express';
import { WeeksController } from './weeks.controller.js';
import type { WeeksService } from './weeks.service.js';

export function createWeeksRouter(service: WeeksService): Router {
  const controller = new WeeksController(service);
  const router = Router();

  // Literal paths first: `/current` and `/by-date/:date` must not be swallowed
  // by the `/:id` route.
  router.get('/current', controller.current);
  router.get('/by-date/:date', controller.byDate);
  router.get('/:id', controller.get);
  router.get('/:id/records', controller.listRecords);
  router.post('/:id/close', controller.close);
  router.post('/:id/reopen', controller.reopen);

  return router;
}