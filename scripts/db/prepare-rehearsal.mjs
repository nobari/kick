import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Credential provisioning artifact, not application config: never overwrites
// .env.local, existing rehearsal credentials, or Vercel production variables.
const project = 'autumn-fog-25069635';
const branch = 'br-old-voice-aw1siabw';
try {
  if (!process.env.NEON_API_KEY) throw new Error('Missing API key');
  const connection = pooled => execFileSync('pnpm', ['dlx', 'neon', 'connection-string', branch,
    '--project-id', project, '--role-name', 'neondb_owner', '--database-name', 'neondb',
    '--ssl', 'verify-full', ...(pooled ? ['--pooled'] : [])],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const direct = connection(false), pooled = connection(true);
  for (const value of [direct, pooled]) {
    if (!new URL(value).hostname.startsWith('ep-jolly-snow-aw8g6rfs')) throw new Error('Unexpected endpoint');
  }
  writeFileSync('.env.rehearsal.local', [
    `DATABASE_URL=${JSON.stringify(pooled)}`, `DATABASE_URL_UNPOOLED=${JSON.stringify(direct)}`,
    `KICK_DB_BRANCH=${branch}`, `KICK_DATA_KEY=${randomBytes(32).toString('base64')}`,
    `BACKUP_KEY_BASE64=${randomBytes(32).toString('base64')}`, '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Created owner-only, Git-ignored rehearsal credentials; production configuration unchanged.');
} catch {
  console.error('Rehearsal credential provisioning failed; no credential values printed. Check branch access or an existing output file.');
  process.exitCode = 1;
}
