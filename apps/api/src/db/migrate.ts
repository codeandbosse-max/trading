import { readFileSync } from 'fs';
import { join } from 'path';
import { getDb } from './pool';

export function schemaSql(): string {
  return readFileSync(join(__dirname, 'schema.sql'), 'utf8');
}

/** Splits on statement boundaries; the schema contains no functions or dollar-quoting. */
export function schemaStatements(): string[] {
  return schemaSql()
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function migrate(): Promise<void> {
  const db = getDb();
  for (const statement of schemaStatements()) {
    await db.query(statement);
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('[db] schéma appliqué.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[db] échec de la migration:', err);
      process.exit(1);
    });
}
