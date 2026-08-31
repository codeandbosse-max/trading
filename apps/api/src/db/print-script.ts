import { writeFileSync } from 'fs';
import { join } from 'path';
import { schemaSql } from './migrate';
import { rlsSql } from './harden';

const header = `-- =====================================================================
-- SignalDesk — script d'initialisation PostgreSQL / Supabase
-- Généré par : npm run db:script
-- Ne pas modifier à la main : éditez apps/api/src/db/schema.sql ou rls.sql.
--
-- Utilisation (Supabase) : SQL Editor > New query > coller > Run.
-- Puis, pour insérer les données de démarrage :
--   DATABASE_URL="postgresql://..." DATABASE_SSL=true npm run db:seed
-- =====================================================================

`;

const output = `${header}${schemaSql().trim()}\n\n${rlsSql().trim()}\n`;
const target = join(__dirname, '../../../../supabase-setup.sql');

writeFileSync(target, output, 'utf8');
console.log(`[db] script écrit dans ${target}`);
