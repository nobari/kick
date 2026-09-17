import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { productionConnection } from './production-db.mjs';
import { parseKey, verifySnapshot } from './encrypted-snapshot.mjs';
import { normalizedPlan } from './normalized-plan.mjs';
import { reconcilePlan } from './reconcile-plan.mjs';
import { insertRows } from './import-rehearsal.mjs';

async function main() {
  const [mode, file] = process.argv.slice(2);
  if (!['--schema', '--import', '--reconcile'].includes(mode)) throw new Error('Explicit operation required');
  const client = new pg.Client({ connectionString: productionConnection(), connectionTimeoutMillis: 15000 });
  await client.connect();
  try {
    if (mode === '--schema') {
      await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
      console.log('Production normalized schema applied. Runtime not switched.');
      return;
    }
    const snapshot = await verifySnapshot(parseKey(process.env.BACKUP_KEY_BASE64), createInterface({ input: createReadStream(file), crlfDelay: Infinity }), { collect: true });
    if (snapshot.report.project !== 'slack-manage') throw new Error('Source mismatch');
    const plan = normalizedPlan(snapshot, process.env.KICK_DATA_KEY);
    if (!plan.ready) throw new Error('Mapping failures block import');
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query('SELECT pg_advisory_xact_lock(672493215)');
    const prior = await client.query('SELECT completed_at,source_count FROM migration_runs WHERE snapshot_digest=$1', [snapshot.digest]);
    if (prior.rows.length || mode === '--reconcile') {
      if (!prior.rows[0]?.completed_at || prior.rows[0].source_count !== snapshot.documents) throw new Error('Missing or conflicting import');
      await reconcilePlan(client, plan, process.env.KICK_DATA_KEY);
      await client.query('ROLLBACK');
      console.log(JSON.stringify({ reconciled: true, documents: snapshot.documents, writes: false }));
      return;
    }
    for (const table of Object.keys(plan.tables)) {
      if ((await client.query(`SELECT EXISTS(SELECT 1 FROM "${table}" LIMIT 1) occupied`)).rows[0].occupied) throw new Error('Target is not empty');
    }
    const { rows: [run] } = await client.query('INSERT INTO migration_runs(source_project,snapshot_digest,snapshot_at,source_count) VALUES($1,$2,$3,$4) RETURNING id', [snapshot.report.project, snapshot.digest, snapshot.report.readTime, snapshot.documents]);
    for (const [table, rows] of Object.entries(plan.tables)) {
      await insertRows(client, table, [...rows.values()]);
      console.log(`Imported ${rows.size} rows into ${table}`);
    }
    await insertRows(client, 'migration_records', plan.audit.map(row => ({ run_id: run.id, ...row })));
    await reconcilePlan(client, plan, process.env.KICK_DATA_KEY);
    await client.query('UPDATE migration_runs SET completed_at=now(),imported_count=$2 WHERE id=$1', [run.id, plan.audit.length]);
    await client.query('COMMIT');
    console.log(JSON.stringify({ committed: true, reconciled: true, documents: snapshot.documents, snapshotAt: snapshot.report.readTime }));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { await client.end(); }
}
main().catch(error => { console.error(`Production import stopped (${/^[0-9A-Z]{5}$/.test(error.code || '') ? error.code : 'VALIDATION_OR_IO'}).`); process.exitCode = 1; });
