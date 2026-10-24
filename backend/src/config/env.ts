import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4400),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (e.g. postgres://cace@localhost:5432/freelancer_invoices)'),
  /** Only used by the test runner (integration specs); defaults to DATABASE_URL. */
  DATABASE_URL_TEST: z.string().min(1).optional(),
  CORS_ORIGIN: z
    .string()
    .min(1)
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration — fix the following before starting the API:\n${details}`,
    );
  }
  return parsed.data;
}

export const env: Env = parseEnv();

/** Database used by `npm test`; falls back to DATABASE_URL when unset. */
export const testDatabaseUrl: string = env.DATABASE_URL_TEST ?? env.DATABASE_URL;