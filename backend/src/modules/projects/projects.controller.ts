import type { Request, Response } from 'express';
import { asyncHandler, ok, validateBody, validateParams, validateQuery } from '../../lib/http.js';
import { idParamsSchema } from '../../lib/validation.js';
import type { ProjectFilters, ProjectsService } from './projects.service.js';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
  type ListProjectsQuery,
} from './projects.schemas.js';

/** Translates the raw query string into the repository filter shape. */
function toFilters(query: ListProjectsQuery): ProjectFilters {
  return {
    ...(query.clientId === undefined
      ? {}
      : query.clientId === 'none'
        ? { standalone: true }
        : { clientId: query.clientId }),
    ...(query.standalone === undefined ? {} : { standalone: query.standalone === 'true' }),
    ...(query.archived === undefined ? {} : { archived: query.archived }),
  };
}

/** HTTP layer: parse → delegate → envelope. */
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  readonly list = asyncHandler(async (req: Request, res: Response) => {
    const query = validateQuery(listProjectsQuerySchema, req);
    res.json(ok(await this.service.list(toFilters(query))));
  });

  readonly get = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamsSchema, req);
    res.json(ok(await this.service.get(id)));
  });

  readonly create = asyncHandler(async (req: Request, res: Response) => {
    const body = validateBody(createProjectSchema, req);
    res.status(201).json(ok(await this.service.create(body)));
  });

  readonly update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamsSchema, req);
    const body = validateBody(updateProjectSchema, req);
    res.json(ok(await this.service.update(id, body)));
  });

  readonly remove = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamsSchema, req);
    res.json(ok(await this.service.remove(id)));
  });
}