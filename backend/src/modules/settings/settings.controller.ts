import type { Request, Response } from 'express';
import { asyncHandler, ok, validateBody } from '../../lib/http.js';
import { updateSettingsSchema } from './settings.schemas.js';
import type { SettingsService } from './settings.service.js';

/** HTTP layer: parse → delegate → envelope. */
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  readonly get = asyncHandler(async (_req: Request, res: Response) => {
    res.json(ok(await this.service.get()));
  });

  readonly update = asyncHandler(async (req: Request, res: Response) => {
    const body = validateBody(updateSettingsSchema, req);
    res.json(ok(await this.service.update(body)));
  });
}