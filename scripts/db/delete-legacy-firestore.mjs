import assert from 'node:assert/strict';
import { createReadStream, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { parseKey, verifySnapshot } from './encrypted-snapshot.mjs';
import { googleRequest, inventory } from './firestore-inventory.mjs';

// One-time owner-authorized cleanup. A record changed since backup is NOT deleted.
// No automatic mutation retries: an ambiguous result requires investigation.
const backup = '/Users/spro/Developer/personal/kick-migration-20260917-fvsPvQ/final.kickenc';
const journal = '/Users/spro/Developer/personal/kick-legacy-cleanup-20260917-ltsKbi/firestore-deletion.jsonl';
const root = 'projects/slack-manage/databases/(default)/documents';
let fd, deleted = 0;
try {
  assert.equal(process.argv[2], '--delete-verified-legacy-records');
  const health = await (await fetch('https://kick.bozmoz.com/api/slack/health?deep=1')).json();
  assert.equal(health.backend, 'postgres'); assert.equal(health.database, 'connected'); assert.equal(health.ok, true);
  const snapshot = await verifySnapshot(parseKey(process.env.BACKUP_KEY_BASE64), createInterface({ input: createReadStream(backup), crlfDelay: Infinity }), { collect: true });
  assert.equal(snapshot.documents, 39380);
  assert.equal(snapshot.report.project, 'slack-manage');
  assert.equal(snapshot.report.readTime, '2026-09-17T08:11:10.653Z');
  for (const doc of snapshot.records) {
    assert.ok(doc.name.startsWith(root + '/'));
    assert.ok(doc.updateTime);
  }
  fd = openSync(journal, 'wx', 0o600);
  const record = entry => { writeSync(fd, JSON.stringify(entry) + '\n'); fsyncSync(fd); };
  record({ backup, digest: snapshot.digest, documents: snapshot.documents, startedAt: new Date().toISOString() });
  const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  for (let start = 0; start < snapshot.records.length; start += 400) {
    const batch = snapshot.records.slice(start, start + 400);
    record({ phase: 'attempt', start, count: batch.length });
    const response = await fetch(`https://firestore.googleapis.com/v1/${root}:commit`, {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: batch.map(doc => ({ delete: doc.name, currentDocument: { updateTime: doc.updateTime } })) }),
    });
    if (!response.ok) throw Object.assign(new Error('Delete batch rejected'), { code: `HTTP_${response.status}` });
    const result = await response.json();
    assert.equal(result.writeResults.length, batch.length);
    deleted += batch.length;
    record({ phase: 'committed', start, count: batch.length, deleted, commitTime: result.commitTime });
    if (deleted % 4000 === 0) console.log(JSON.stringify({ deleted }));
  }
  const report = await inventory({ project: 'slack-manage', request: googleRequest(), readTime: new Date().toISOString(), maxRequests: 100000 });
  record({ phase: 'verified', deleted, remaining: report.totals.documents, verifiedAt: report.readTime });
  assert.equal(report.totals.documents, 0);
  console.log(JSON.stringify({ deleted, remaining: 0, backupPreserved: true }));
} catch (error) {
  console.error(JSON.stringify({ cleanup: 'stopped', deleted, code: /^HTTP_\d+$/.test(error.code || '') ? error.code : 'VALIDATION_OR_IO', warning: 'Inspect journal before resuming; never blindly rerun deletes.' }));
  process.exitCode = 1;
} finally { if (fd !== undefined) closeSync(fd); }
