import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Deliberately restricted to this disposable branch. There is no production
// override: cutover requires a separate, reviewed operation.
export function rehearsalConnection(env = process.env) {
  const url = new URL(env.DATABASE_URL_UNPOOLED || 'file:///missing');
  if (env.KICK_DB_BRANCH !== 'br-old-voice-aw1siabw' ||
      url.hostname !== 'ep-jolly-snow-aw8g6rfs.c-12.us-east-1.aws.neon.tech' ||
      url.protocol !== 'postgresql:' || url.pathname !== '/neondb' ||
      url.searchParams.get('sslmode') !== 'verify-full') {
    throw new Error('Refusing database operation: expected isolated rehearsal direct connection with verified TLS');
  }
  return url.href;
}

export async function migrateRehearsal() {
  const pool = new pg.Pool({ connectionString: rehearsalConnection(), max: 1, connectionTimeoutMillis: 15000 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    console.log('Normalized schema applied to rehearsal branch only.');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrateRehearsal().catch(error => {
    // Driver error messages can contain credentials or record values.
    console.error(`Rehearsal migration failed (${error.code || 'configuration or migration error'}). Production unchanged.`);
    process.exitCode = 1;
  });
}
