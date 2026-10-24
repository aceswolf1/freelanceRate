import { Router } from 'express';
import { RecordsController } from './records.controller.js';
import type { RecordsService } from './records.service.js';

/** Routers that hang off `/weeks/:weekId/records` and `/records/:id`. */
export function createRecordsRouters(service: RecordsService): {
  weekRecordsRouter: Router;
  recordsRouter: Router;
} {
  const controller = new RecordsController(service);
  // `:weekId` is declared on the parent mount in `modules/index.ts`, so this
  // router must merge params in — otherwise `req.params.weekId` is undefined and
  // every request fails Zod validation with 400.
  const weekRecordsRouter = Router({ mergeParams: true });
  const recordsRouter = Router();

  weekRecordsRouter.post('/', controller.createForWeek);
  recordsRouter.patch('/:id', controller.update);
  recordsRouter.delete('/:id', controller.remove);

  return { weekRecordsRouter, recordsRouter };
}