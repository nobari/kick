import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseKey, verifySnapshot } from './encrypted-snapshot.mjs';

async function main() {
  if (!process.argv[2]) throw new Error('Snapshot file required');
  const key = parseKey(process.env.BACKUP_KEY_BASE64);
  const input = createReadStream(process.argv[2], { encoding: 'utf8' });
  // Propagate stream failures to the iterator without printing file contents.
  const lines = createInterface({ input, crlfDelay: Infinity });
  let streamError;
  input.on('error', error => { streamError = error; lines.close(); });
  try {
    const result = await verifySnapshot(key, lines);
    if (streamError) throw streamError;
    console.log(JSON.stringify({ verified: result.verified, documents: result.documents, readTime: result.report.readTime }));
  } finally { lines.close(); input.destroy(); }
}
main().catch(() => { console.error('Snapshot verification failed; no data was imported.'); process.exitCode = 1; });
