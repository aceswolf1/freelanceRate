import type { Request, Response } from 'express';
import { asyncHandler, ok, validateBody, validateParams } from '../../lib/http.js';
import { idParamsSchema } from '../../lib/validation.js';
import { createRecordSchema, updateRecordSchema, weekIdParamsSchema } from './records.schemas.js';
import type { RecordsService } from './records.service.js';

/**
 * HTTP layer for work records. Create hangs off the week
 * (`POST /api/weeks/:id/records`) because the week is what locks the write.
 */
export class RecordsController {
  constructor(private readonly service: RecordsService) {}

  readonly createForWeek = asyncHandler(async (req: Request, res: Response) => {
    const { weekId } = validateParams(weekIdParamsSchema, req);
    const body = validateBody(createRecordSchema, req);
    res.status(201).json(ok(await this.service.createForWeek(weekId, body)));
  });

  readonly update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamsSchema, req);
    const body = validateBody(updateRecordSchema, req);
    res.json(ok(await this.service.update(id, body)));
  });

  readonly remove = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamsSchema, req);
    res.json(ok(await this.service.remove(id)));
  });
}