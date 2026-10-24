import type { Request, Response } from 'express';
import { asyncHandler, ok, validateBody, validateParams } from '../../lib/http.js';
import { idParamsSchema } from '../../lib/validation.js';
import type { PaymentPlatformsService } from './payment-platforms.service.js';
import {
  createPaymentPlatformSchema,
  updatePaymentPlatformSchema,
} from './payment-platforms.schemas.js';

/** HTTP layer: parse → delegate → envelope. No business rules. */
export class PaymentPlatformsController {
  constructor(private readonly service: PaymentPlatformsService) {}

  readonly list = asyncHandler(async (_req: Request, res: Response) => {
    res.json(ok(await this.service.list()));
  });

  readonly get = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamsSchema, req);
    res.json(ok(await this.service.get(id)));
  });

  readonly create = asyncHandler(async (req: Request, res: Response) => {
    const body = validateBody(createPaymentPlatformSchema, req);
    res.status(201).json(ok(await this.service.create(body)));
  });

  readonly update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamsSchema, req);
    const body = validateBody(updatePaymentPlatformSchema, req);
    res.json(ok(await this.service.update(id, body)));
  });

  readonly remove = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamsSchema, req);
    res.json(ok(await this.service.remove(id)));
  });
}