/**
 * HTTP layer for the reports feature (contract §4.8).
 *
 * Controllers only: parse the query with Zod, delegate, shape the envelope.
 */
import type { Request, RequestHandler } from 'express';
import { asyncHandler, ok, validateQuery } from '../../lib/http.js';
import { earningsQuerySchema } from './reports.schemas.js';
import type { ReportsService } from './reports.service.js';

/**
 * `resolveService` is a factory so the router module can defer opening the
 * database pool, and so tests can inject a fake service.
 */
export function createReportsController(resolveService: () => ReportsService) {
  const earnings: RequestHandler = asyncHandler(async (req: Request, res) => {
    const { from, to, groupBy } = validateQuery(earningsQuerySchema, req);
    res.json(ok(await resolveService().earnings({ from, to, groupBy })));
  });

  return { earnings };
}