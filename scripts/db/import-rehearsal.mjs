import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { parseKey, verifySnapshot } from './encrypted-snapshot.mjs';
import { normalizedPlan } from './normalized-plan.mjs';
import { rehearsalConnection } from './rehearsal-db.mjs';
import { reconcilePlan } from './reconcile-plan.mjs';

export async function insertRows(client, table, rows) {
  // Identifiers come only from the application mapping, never source fields.
  if (!/^[a-z_]+$/.test(table)) throw new Error('Invalid table');
  const groups = new Map();
  for (const row of rows) {
    const columns = Object.keys(row).sort();
    if (columns.some(column => !/^[a-z_]+$/.test(column))) throw new Error('Invalid column');
    const signature = columns.join(',');
    if (!groups.has(signature)) groups.set(signature, { columns, rows: [] });
    groups.get(signature).rows.push(row);
  }
  for (const { columns, rows: group } of groups.values()) {
    for (let start = 0; start < group.length; start += 250) {
      const batch = group.slice(start, start + 250), parameters = [];
      const values = batch.map(row => `(${columns.map(column => {
        parameters.push(row[column]); return `$${parameters.length}`;
      }).join(',')})`).join(',');
      await client.query(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(',')}) VALUES ${values}`, parameters);
    }
  }
}

async function main() {
  const [file, mode] = process.argv.slice(2);
  if (!file || (mode && mode !== '--apply')) throw new Error('Expected snapshot path and optional --apply');
  const snapshot = await verifySnapshot(parseKey(process.env.BACKUP_KEY_BASE64), createInterface({ input: createReadStream(file), crlfDelay: Infinity }), { collect: true });
  const plan = normalizedPlan(snapshot, process.env.KICK_DATA_KEY);
  const counts = Object.fromEntries(Object.entries(plan.tables).map(([name, rows]) => [name, rows.size]));
  console.log(JSON.stringify({ verified: true, sourceDocuments: snapshot.documents, ready: plan.ready, tables: counts, failures: plan.failures }));
  if (!plan.ready) throw new Error('Mapping failures block import');
  if (mode !== '--apply') return;
  const client = new pg.Client({ connectionString: rehearsalConnection(), connectionTimeoutMillis: 15000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query('SELECT pg_advisory_xact_lock(672493215)');
    const existing = await client.query('SELECT completed_at,source_count FROM migration_runs WHERE snapshot_digest=$1', [snapshot.digest]);
    if (existing.rows.length) {
      if (!existing.rows[0].completed_at || existing.rows[0].source_count !== snapshot.documents) throw new Error('Conflicting migration run');
      await reconcilePlan(client, plan, process.env.KICK_DATA_KEY);
      await client.query('ROLLBACK');
      console.log('Existing import reconciled by row values and decrypted credentials; no writes performed.');
      return;
    }
    // A new snapshot must not overwrite history or installations already loaded.
    for (const table of Object.keys(plan.tables)) {
      const result = await client.query(`SELECT EXISTS(SELECT 1 FROM "${table}" LIMIT 1) AS occupied`);
      if (result.rows[0].occupied) throw new Error('Rehearsal database is not empty');
    }
    const { rows: [run] } = await client.query('INSERT INTO migration_runs(source_project,snapshot_digest,snapshot_at,source_count) VALUES($1,$2,$3,$4) RETURNING id',
      [snapshot.report.project, snapshot.digest, snapshot.report.readTime, snapshot.documents]);
    for (const [table, rows] of Object.entries(plan.tables)) {
      await insertRows(client, table, [...rows.values()]);
      console.log(`Imported ${rows.size} rows into ${table}`);
    }
    await insertRows(client, 'migration_records', plan.audit.map(row => ({ run_id: run.id, ...row })));
    await reconcilePlan(client, plan, process.env.KICK_DATA_KEY);
    await client.query('UPDATE migration_runs SET completed_at=now(),imported_count=$2 WHERE id=$1', [run.id, plan.audit.length]);
    await client.query('COMMIT');
    console.log('Rehearsal import committed; all source documents accounted for. Production unchanged.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  const code = /^[0-9A-Z]{5}$/.test(error.code || '') ? error.code : 'VALIDATION_OR_IO';
  console.error(`Import stopped (${code}); no partial transaction committed.`);
  process.exitCode = 1;
});
