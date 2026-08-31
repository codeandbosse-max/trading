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
  get tickMinIntervalMs(): number {
    return Number.parseInt(process.env.TICK_MIN_INTERVAL_MS ?? '3000', 10);
  },
  // Live order routing stays off unless explicitly enabled.
  get allowLiveTrading(): boolean {
    return process.env.ALLOW_LIVE_TRADING === 'true';
  },
  get alpacaBaseUrl(): string {
    return process.env.ALPACA_BASE_URL ?? '';
  },
  get riskTimeZone(): string {
    return process.env.RISK_TIMEZONE ?? 'America/New_York';
  },
  get signupCode(): string {
    return process.env.SIGNUP_CODE ?? '';
  },
  get cookieSecure(): boolean {
    return (process.env.COOKIE_SECURE ?? String(isProduction)) === 'true';
  },
  get cookieSameSite(): 'lax' | 'none' | 'strict' {
    const value = process.env.COOKIE_SAMESITE ?? 'lax';
    return value === 'none' || value === 'strict' ? value : 'lax';
  },
  get alerts() {
    return {
      minSeverity: process.env.ALERT_MIN_SEVERITY ?? 'warning',
      webhookUrl: process.env.ALERT_WEBHOOK_URL ?? '',
      chatWebhookUrl: process.env.CHAT_WEBHOOK_URL ?? '',
      smtpUrl: process.env.SMTP_URL ?? '',
      emailFrom: process.env.ALERT_EMAIL_FROM ?? '',
      emailTo: process.env.ALERT_EMAIL_TO ?? '',
    };
  },
  // Keep this at 1 behind a connection pooler (Supabase port 6543).
  dbPoolMax: Number.parseInt(process.env.DB_POOL_MAX ?? '10', 10),
};
