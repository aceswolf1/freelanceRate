/**
 * HTTP plumbing: the response envelope, the typed error family, Zod validation
 * helpers and the Express error/404 middleware.
 *
 * Envelope (shared conventions):
 *   success → `{ success: true, data, meta? }`
 *   failure → `{ success: false, error: { code, message, details? } }`
 */
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'WEEK_CLOSED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  success: false;
  error: ErrorBody;
}

/** Base class for every expected (non-crash) failure. */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

/** Records/close operations against a closed week. */
export class WeekClosedError extends AppError {
  constructor(message = 'Week is closed', details?: unknown) {
    super(409, 'WEEK_CLOSED', message, details);
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error', details?: unknown) {
    super(500, 'INTERNAL', message, details);
  }
}

export function ok<T>(data: T, meta?: Record<string, unknown>): SuccessEnvelope<T> {
  return meta === undefined ? { success: true, data } : { success: true, data, meta };
}

export function fail(code: ErrorCode, message: string, details?: unknown): ErrorEnvelope {
  return details === undefined
    ? { success: false, error: { code, message } }
    : { success: false, error: { code, message, details } };
}

/**
 * Parses `value` with `schema`, converting a Zod failure into a
 * `VALIDATION_ERROR` (400) with a flat, UI-friendly issue list.
 */
export function validate<S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new ValidationError('Validation failed', toIssueList(result.error));
}

function toIssueList(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

export const validateBody = <S extends ZodTypeAny>(schema: S, req: Request): z.infer<S> =>
  validate(schema, req.body);

export const validateQuery = <S extends ZodTypeAny>(schema: S, req: Request): z.infer<S> =>
  validate(schema, req.query);

export const validateParams = <S extends ZodTypeAny>(schema: S, req: Request): z.infer<S> =>
  validate(schema, req.params);

/** Wraps an async handler so rejected promises reach the error middleware. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/** Terminal 404 for unmatched routes — always the standard envelope. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(fail('NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
}

/** Maps errors to status + envelope. Unexpected errors become a generic 500. */
export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json(fail(error.code, error.message, error.details));
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json(fail('VALIDATION_ERROR', 'Validation failed', toIssueList(error)));
    return;
  }
  // Body parser errors (malformed JSON, oversized payload).
  const candidate = error as { type?: string; status?: number; message?: string } | null;
  if (candidate?.type === 'entity.parse.failed') {
    res.status(400).json(fail('VALIDATION_ERROR', 'Request body is not valid JSON'));
    return;
  }
  if (candidate?.type === 'entity.too.large') {
    res.status(413).json(fail('VALIDATION_ERROR', 'Request body is too large'));
    return;
  }
  res.status(500).json(fail('INTERNAL', 'Internal server error'));
};

/** Structured-logger accessor — `req.log` is attached by pino-http. */
interface ErrorLogger {
  error: (obj: unknown, msg?: string) => void;
}

export function logRequestError(
  req: Request,
  error: unknown,
  logger?: ErrorLogger,
): void {
  const reqLogger = logger ?? (req as Request & { log?: ErrorLogger }).log;
  reqLogger?.error({ err: error, path: req.originalUrl }, 'request failed');
}