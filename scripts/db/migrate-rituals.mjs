import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { productionConnection } from './production-db.mjs';
import { rehearsalConnection } from './rehearsal-db.mjs';

// Additive, versioned migration only. Never imports or deletes core history.
const production = process.argv.includes('--production');
try {
  if (production && !process.argv.includes('--apply')) throw new Error('Explicit --apply required');
  const pool = new pg.Pool({connectionString: production ? productionConnection() : rehearsalConnection(), max: 1});
  try {
    await migrate(drizzle(pool), {migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url))});
    const { rows } = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'ritual_%' ORDER BY tablename");
    if (rows.length !== 9) throw new Error('Ritual schema verification failed');
    console.log(`${production ? 'Production' : 'Rehearsal'}: nine Postgres ritual tables verified.`);
  } finally { await pool.end(); }
} catch (e) {
  console.error(`Ritual migration failed (${e.code || 'configuration/migration error'}); no credentials printed.`);
  process.exitCode = 1;
}
