import type { Request, Response } from 'express';
import { asyncHandler, ok, validateBody, validateParams } from '../../lib/http.js';
import { idParamsSchema } from '../../lib/validation.js';
import type { ClientsService } from './clients.service.js';
import { createClientSchema, updateClientSchema } from './clients.schemas.js';

/** HTTP layer: parse → delegate → envelope. */
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  readonly list = asyncHandler(async (_req: Request, res: Response) => {
    res.json(ok(await this.service.list()));
  });

  readonly get = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamsSchema, req);
    res.json(ok(await this.service.get(id)));
  });

  readonly create = asyncHandler(async (req: Request, res: Response) => {
    const body = validateBody(createClientSchema, req);
    res.status(201).json(ok(await this.service.create(body)));
  });

  readonly update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamsSchema, req);
    const body = validateBody(updateClientSchema, req);
    res.json(ok(await this.service.update(id, body)));
  });

  readonly remove = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamsSchema, req);
    res.json(ok(await this.service.remove(id)));
  });
}