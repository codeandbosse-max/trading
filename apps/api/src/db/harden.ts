import { readFileSync } from 'fs';
import { join } from 'path';
import { getDb } from './pool';

export function rlsSql(): string {
  return readFileSync(join(__dirname, 'rls.sql'), 'utf8');
}

/** Sent as a single statement: the file contains a DO block. */
export async function harden(): Promise<void> {
  await getDb().query(rlsSql());
}

if (require.main === module) {
  harden()
    .then(() => {
      console.log('[db] RLS activé et privilèges publics révoqués.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[db] échec du durcissement:', err);
      process.exit(1);
    });
}
