import { openSync, writeSync, fsyncSync, closeSync, linkSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { inventory, googleRequest } from './firestore-inventory.mjs';
import { parseKey, snapshotWriter } from './encrypted-snapshot.mjs';

async function main() {
  const [project, target, limit = '20000'] = process.argv.slice(2);
  if (!project || !target) throw new Error('Usage: BACKUP_KEY_BASE64=<secret> node scripts/db/firestore-export.mjs PROJECT OUTPUT');
  const key = parseKey(process.env.BACKUP_KEY_BASE64);
  const request = googleRequest();
  const destination = resolve(target);
  // Put snapshots outside the repository. Never overwrite an existing backup.
  if (destination.startsWith(`${process.cwd()}/`)) throw new Error('Choose a backup directory outside the repository');
  const partial = `${destination}.partial`;
  const fd = openSync(partial, 'wx', 0o600);
  let closed = false;
  try {
    const writer = snapshotWriter(key, line => {
      const bytes = Buffer.from(`${line}\n`);
      let offset = 0;
      while (offset < bytes.length) offset += writeSync(fd, bytes, offset);
    });
    const report = await inventory({ project, request, maxRequests: Number(limit), onDocument: document => writer.document(document),
      progress: totals => { if (totals.requests % 2000 === 0) console.error(`Export: ${totals.documents} documents read`); } });
    writer.finish(report);
    fsyncSync(fd); closeSync(fd); closed = true;
    linkSync(partial, destination); // Fails instead of replacing any existing destination.
    unlinkSync(partial);
    const dirFd = openSync(dirname(destination), 'r');
    try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
    console.log(JSON.stringify({ exported: true, documents: report.totals.documents, readTime: report.readTime }));
  } finally { if (!closed) closeSync(fd); }
}
main().catch(error => {
  const code = /^(HTTP_\d{3}|TRANSPORT_RETRIES|E[A-Z]+)$/.test(error.code || '') ? error.code : 'VALIDATION_OR_IO';
  console.error(`Export failed (${code}). Source data is unchanged; any .partial file is encrypted but incomplete.`);
  const location = error.stack?.split('\n').find(line => line.includes('/scripts/db/'))?.match(/scripts\/db\/[a-z-]+\.mjs:\d+:\d+/)?.[0];
  if (location) console.error(`Failure location: ${location}`);
  process.exitCode = 1;
});
