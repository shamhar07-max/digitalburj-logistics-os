import 'dotenv/config';
import { z } from 'zod';

const bool = (d: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default('postgresql://digitalburj:dev_password@localhost:5432/digitalburj_dev'),
  DATABASE_SSL: bool(false),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me-please'),
  ENCRYPTION_KEY: z.string().length(64).default('0'.repeat(64)),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(14),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('me-central-1'),
  S3_ENDPOINT: z.string().optional(),
  /** max pg connections per process; keep small (2-3) on serverless so instances do not exhaust the database */
  PG_POOL_MAX: z.coerce.number().int().min(1).default(20),
  ENABLE_SCHEDULER: bool(true),
  /** max login attempts per IP per 15 min (raise only for automated test runs) */
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).default(30),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('DigitalBurj <no-reply@example.com>'),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().default('change-me'),
  WHATSAPP_APP_SECRET: z.string().optional(),
  NAVO24_API_KEY: z.string().optional(),
  ASP_ENDPOINT: z.string().optional(),
  ASP_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof schema>;

function load(): Config {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  const c = parsed.data;
  if (c.NODE_ENV === 'production') {
    if (c.JWT_SECRET.startsWith('dev-only') || c.JWT_SECRET.includes('change-me')) {
      console.error('FATAL: JWT_SECRET must be set to a strong random value in production');
      process.exit(1);
    }
    if (/^0+$/.test(c.ENCRYPTION_KEY)) {
      console.error('FATAL: ENCRYPTION_KEY must be set (64 hex chars) in production');
      process.exit(1);
    }
  }
  return c;
}

export const config = load();
export const isProd = config.NODE_ENV === 'production';
