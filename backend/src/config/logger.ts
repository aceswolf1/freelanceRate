import pino from 'pino';
import { env } from './env.js';

/**
 * Process-wide structured logger. `LOG_LEVEL=silent` (or NODE_ENV=test) keeps
 * test output clean.
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  base: env.NODE_ENV === 'production' ? undefined : { service: 'freelancer-invoices-api' },
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
});