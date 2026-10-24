import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { getDb } from './db/client.js';
import { apiRouter } from './modules/index.js';
import { asyncHandler, errorMiddleware, notFoundHandler, ok } from './lib/http.js';

/**
 * Builds the Express application. Kept separate from `server.ts` so integration
 * tests can mount it with supertest without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );
  // inflate:false rejects compressed bodies (415) — Node2Shell (CVE-2026-111497) stop-gap.
  app.use(express.json({ limit: '1mb', inflate: false }));

  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/health' },
        customLogLevel: (_req, res, error) => {
          if (error || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      }),
    );
  }

  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      await getDb().execute('select 1');
      res.json(
        ok({
          status: 'ok',
          database: 'up',
          uptimeSeconds: Math.round(process.uptime()),
        }),
      );
    }),
  );

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorMiddleware);

  return app;
}