import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { verifySnapshot, parseKey } from './encrypted-snapshot.mjs';
import { decodeFields } from './legacy-values.mjs';
import { rehearsalConnection } from './rehearsal-db.mjs';
import { productionConnection } from './production-db.mjs';
import workflows from '../../server/db/workflows.cjs';

const digest = rows => createHash('sha256').update(rows.map(row => JSON.stringify(row)).sort().join('\n')).digest('hex');
const sync = row => [row.f, row.values?.m || null, row.values?.l || null, row.values?.t || null, row.values?.b || null, row.AT, row.link || null, row.cts || false];
const recognition = row => [row.team, row.ch, row.f, row.k, row.kr || false, row.cts || false, row.ts, row.AT, row.link || null, row.type || 'kudos'];
async function main() {
  const snapshot = await verifySnapshot(parseKey(process.env.BACKUP_KEY_BASE64), createInterface({ input: createReadStream(process.argv[2]), crlfDelay: Infinity }), { collect: true });
  const standups = new Map(), grants = new Map();
  for (const doc of snapshot.records) {
    const path = doc.name.split('/documents/')[1].split('/');
    if (!['sync', 'kudos'].includes(path[0])) continue;
    const data = decodeFields(doc.fields);
    const key = path[0] === 'sync' ? JSON.stringify([path[1], path[2]]) : data.team;
    const groups = path[0] === 'sync' ? standups : grants;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(data);
  }
  const client = new pg.Client({ connectionString: process.argv[3] === '--production' ? productionConnection() : rehearsalConnection() });
  await client.connect();
  let queries = 0;
  try {
    await client.query('BEGIN READ ONLY');
    const repository = workflows.createWorkflowRepository({ query: (...args) => client.query(...args) });
    for (const since of [0, Date.parse(snapshot.report.readTime) - 7 * 86400000]) {
      for (const [key, source] of standups) {
        const [team, channel] = JSON.parse(key);
        const actual = await repository.getStandups(team, channel, since); queries++;
        if (digest(actual.map(sync)) !== digest(source.filter(row => row.AT >= since).map(sync))) throw new Error('Standup report parity failed');
      }
      for (const [team, source] of grants) {
        const actual = await repository.getRecognition(team, since); queries++;
        if (digest(actual.map(recognition)) !== digest(source.filter(row => row.AT >= since).map(recognition))) throw new Error('Recognition report parity failed');
      }
    }
    await client.query('ROLLBACK');
    console.log(JSON.stringify({ parity: true, queries, standupChannels: standups.size, recognitionWorkspaces: grants.size, windows: ['all history', 'last 7 days at snapshot time'] }));
  } finally { await client.end(); }
}
main().catch(() => { console.error('Read-only report parity verification failed; no writes performed.'); process.exitCode = 1; });
