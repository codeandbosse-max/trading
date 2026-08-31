import { config as loadEnv } from 'dotenv';

loadEnv();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value.length === 0) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: Number.parseInt(process.env.PORT ?? '4000', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseSsl: (process.env.DATABASE_SSL ?? 'false') === 'true',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // 32-byte hex key protecting broker credentials at rest.
  encryptionKey: isProduction
    ? required('ENCRYPTION_KEY')
    : process.env.ENCRYPTION_KEY ?? '0'.repeat(64),
  actor: process.env.DEFAULT_ACTOR ?? 'alex.moreau@signaldesk.io',
  webhookRateLimit: Number.parseInt(process.env.WEBHOOK_RATE_LIMIT ?? '60', 10),
  // Read lazily: the platform may inject it after this module is loaded.
  get cronSecret(): string {
    return process.env.CRON_SECRET ?? '';
  },
  // Keep this at 1 behind a connection pooler (Supabase port 6543).
  dbPoolMax: Number.parseInt(process.env.DB_POOL_MAX ?? '10', 10),
};
