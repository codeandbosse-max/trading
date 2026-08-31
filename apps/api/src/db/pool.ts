import { Pool, type QueryResultRow } from 'pg';
import { config } from '../config';

export interface Db {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

let pool: Pool | null = null;
let override: Db | null = null;

/** Injects an alternative driver (used by the test suite with pg-mem). */
export function setDb(db: Db | null): void {
  override = db;
}

export function getDb(): Db {
  if (override) return override;
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
      max: config.dbPoolMax,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
