import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
  WeekClosedError,
  asyncHandler,
  errorMiddleware,
  fail,
  notFoundHandler,
  ok,
  validate,
} from './http.js';

function fakeRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

const fakeReq = { originalUrl: '/api/nope', method: 'GET' } as unknown as Request;
const noop = (() => undefined) as unknown as NextFunction;

describe('envelope helpers', () => {
  it('wraps success data', () => {
    expect(ok({ id: 1 })).toEqual({ success: true, data: { id: 1 } });
  });

  it('includes meta only when provided', () => {
    expect(ok([1], { total: 1 })).toEqual({ success: true, data: [1], meta: { total: 1 } });
  });

  it('wraps failure data', () => {
    expect(fail('NOT_FOUND', 'Client 9 not found')).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client 9 not found' },
    });
  });

  it('carries error details when provided', () => {
    expect(fail('VALIDATION_ERROR', 'bad', { path: 'name' }).error.details).toEqual({ path: 'name' });
  });
});

describe('error family', () => {
  it('maps every error class to its status and code', () => {
    expect(new ValidationError()).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(new NotFoundError()).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(new ConflictError()).toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(new WeekClosedError()).toMatchObject({ status: 409, code: 'WEEK_CLOSED' });
    expect(new InternalError()).toMatchObject({ status: 500, code: 'INTERNAL' });
  });

  it('keeps a stable name per class and the base class in the chain', () => {
    expect(new WeekClosedError('Week 3 is closed')).toBeInstanceOf(AppError);
    expect(new WeekClosedError('Week 3 is closed').name).toBe('WeekClosedError');
    expect(new WeekClosedError('Week 3 is closed').message).toBe('Week 3 is closed');
  });
});

describe('validate', () => {
  const schema = z.object({ name: z.string().min(2), hours: z.number().positive() });

  it('returns parsed data on success', () => {
    expect(validate(schema, { name: 'Acme', hours: 7.5 })).toEqual({ name: 'Acme', hours: 7.5 });
  });

  it('throws a 400 ValidationError with a flat issue list', () => {
    try {
      validate(schema, { name: 'A', hours: -1 });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const details = (error as ValidationError).details as Array<{ path: string }>;
      expect(details.map((issue) => issue.path).sort()).toEqual(['hours', 'name']);
    }
  });
});

describe('asyncHandler', () => {
  it('forwards rejections to next', async () => {
    const next = vi.fn();
    const handler = asyncHandler(async () => {
      throw new NotFoundError('missing');
    });
    handler({} as Request, fakeRes(), next as unknown as NextFunction);
    await new Promise((resolve) => setImmediate(resolve));
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(NotFoundError);
  });

  it('swallows nothing when the handler resolves', async () => {
    const next = vi.fn();
    const res = fakeRes();
    const handler = asyncHandler(async (_req, response) => response.json(ok('fine')));
    handler({} as Request, res, next as unknown as NextFunction);
    await new Promise((resolve) => setImmediate(resolve));
    expect(next).not.toHaveBeenCalled();
    expect(res.body).toEqual({ success: true, data: 'fine' });
  });
});

describe('notFoundHandler', () => {
  it('returns a 404 envelope naming the route', () => {
    const res = fakeRes();
    notFoundHandler(fakeReq, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /api/nope not found',
      },
    });
  });
});

describe('errorMiddleware', () => {
  it('passes AppError straight through', () => {
    const res = fakeRes();
    errorMiddleware(new WeekClosedError('Week 3 is closed'), fakeReq, res, noop);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'WEEK_CLOSED', message: 'Week 3 is closed' },
    });
  });

  it('converts a raw ZodError into VALIDATION_ERROR', () => {
    const res = fakeRes();
    errorMiddleware(
      new z.ZodError([
        {
          code: z.ZodIssueCode.too_small,
          minimum: 2,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Too small',
          path: ['name'],
        },
      ]),
      fakeReq,
      res,
      noop,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
  });

  it('maps body-parser failures', () => {
    const parseRes = fakeRes();
    errorMiddleware({ type: 'entity.parse.failed' }, fakeReq, parseRes, noop);
    expect(parseRes.statusCode).toBe(400);

    const largeRes = fakeRes();
    errorMiddleware({ type: 'entity.too.large' }, fakeReq, largeRes, noop);
    expect(largeRes.statusCode).toBe(413);
  });

  it('hides internals behind a generic 500', () => {
    const res = fakeRes();
    errorMiddleware(new Error('connection string postgres://user:secret@host/db'), fakeReq, res, noop);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
  });
});