import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { productionConnection } from './production-db.mjs';
const production = parseEnv(readFileSync('.env.migration.local', 'utf8'));
const rehearsal = parseEnv(readFileSync('.env.rehearsal.local', 'utf8'));
for (const key of ['DATABASE_URL', 'DATABASE_URL_UNPOOLED']) {
  const url = new URL(production[key]);
  url.searchParams.set('sslmode', 'verify-full');
  production[key] = url.href;
}
production.KICK_DB_BRANCH = 'br-plain-union-awztoj84';
productionConnection(production);
const keys = { DATABASE_URL: production.DATABASE_URL, DATABASE_URL_UNPOOLED: production.DATABASE_URL_UNPOOLED,
  KICK_DB_BRANCH: production.KICK_DB_BRANCH, KICK_DATA_KEY: rehearsal.KICK_DATA_KEY, BACKUP_KEY_BASE64: rehearsal.BACKUP_KEY_BASE64 };
writeFileSync('.env.cutover.local', Object.entries(keys).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n')+'\n', { mode: 0o600, flag: 'wx' });
console.log('Created owner-only production cutover credentials. No values printed.');
