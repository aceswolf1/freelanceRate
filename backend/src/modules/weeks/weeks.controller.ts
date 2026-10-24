import type { Request, Response } from 'express';
import { asyncHandler, ok, validateParams } from '../../lib/http.js';
import { weekDateParamsSchema, weekIdParamsSchema } from './weeks.schemas.js';
import type { WeeksService } from './weeks.service.js';

/** HTTP layer: parse → delegate → envelope. */
export class WeeksController {
  constructor(private readonly service: WeeksService) {}

  readonly current = asyncHandler(async (_req: Request, res: Response) => {
    res.json(ok(await this.service.current()));
  });

  readonly byDate = asyncHandler(async (req: Request, res: Response) => {
    const { date } = validateParams(weekDateParamsSchema, req);
    res.json(ok(await this.service.byDate(date)));
  });

  readonly get = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(weekIdParamsSchema, req);
    res.json(ok(await this.service.get(id)));
  });

  readonly listRecords = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(weekIdParamsSchema, req);
    res.json(ok(await this.service.listRecords(id)));
  });

  readonly close = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(weekIdParamsSchema, req);
    res.json(ok(await this.service.close(id)));
  });

  readonly reopen = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(weekIdParamsSchema, req);
    res.json(ok(await this.service.reopen(id)));
  });
}