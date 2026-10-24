/**
 * Routers for the reports feature — mounted by worker-1 in `modules/index.ts`.
 *
 * default → /api/reports  (GET /earnings)
 * Endpoint #35: GET /api/reports/earnings
 */
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { createReportsController } from './reports.controller.js';
import { ReportsRepository } from './reports.repository.js';
import { ReportsService } from './reports.service.js';

/** Memoised so importing this module never opens the database pool. */
let instance: ReportsService | undefined;
function resolveService(): ReportsService {
  instance ??= new ReportsService(new ReportsRepository(getDb()));
  return instance;
}

const controller = createReportsController(resolveService);

const router: Router = Router();
router.get('/earnings', controller.earnings);

export default router;