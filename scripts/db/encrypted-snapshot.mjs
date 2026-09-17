import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const FORMAT = 'kick-firestore-snapshot-v1';
export function parseKey(value) {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error('Backup key must be 32 bytes encoded as base64');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('Invalid backup key length');
  return key;
}

// Every record authenticates its snapshot ID and sequence number. The encrypted
// footer authenticates completeness; dropping/reordering/appending lines fails.
export function snapshotWriter(key, writeLine) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Invalid backup key');
  const id = randomBytes(16).toString('hex');
  const hash = createHash('sha256');
  let sequence = 0, documents = 0, finished = false;
  writeLine(JSON.stringify({ format: FORMAT, id }));
  function seal(value) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(`${FORMAT}:${id}:${sequence++}`));
    const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    writeLine(JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }));
  }
  return {
    document(document) {
      if (finished) throw new Error('Snapshot already finalized');
      const text = JSON.stringify(document);
      hash.update(text).update('\n'); documents++;
      seal({ type: 'document', document });
    },
    finish(report) {
      if (finished) throw new Error('Snapshot already finalized');
      if (!report.complete || report.totals.documents !== documents) throw new Error('Incomplete snapshot');
      finished = true;
      seal({ type: 'footer', documents, digest: hash.digest('hex'), report });
    },
  };
}

export async function verifySnapshot(key, lines, { collect = false, maxBytes = 64 * 1024 * 1024 } = {}) {
  const hash = createHash('sha256');
  const records = [];
  let bytes = 0;
  let header, sequence = 0, documents = 0, footer;
  for await (const line of lines) {
    if (!line) throw new Error('Invalid empty snapshot record');
    let item;
    try { item = JSON.parse(line); } catch { throw new Error('Invalid snapshot encoding'); }
    if (!header) {
      if (item.format !== FORMAT || !/^[a-f0-9]{32}$/.test(item.id)) throw new Error('Unsupported snapshot format');
      header = item;
      continue;
    }
    if (footer) throw new Error('Data after snapshot footer');
    let value;
    try {
      const iv = Buffer.from(item.iv, 'base64'), tag = Buffer.from(item.tag, 'base64');
      if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid authentication fields');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(Buffer.from(`${FORMAT}:${header.id}:${sequence++}`));
      decipher.setAuthTag(tag);
      value = JSON.parse(Buffer.concat([decipher.update(Buffer.from(item.data, 'base64')), decipher.final()]).toString('utf8'));
    } catch { throw new Error('Snapshot authentication failed'); }
    if (value.type === 'document') {
      if (!value.document?.name || !value.document.createTime) throw new Error('Invalid snapshot document');
      const text = JSON.stringify(value.document);
      bytes += Buffer.byteLength(text);
      if (bytes > maxBytes) throw new Error('Snapshot size limit exceeded');
      hash.update(text).update('\n'); documents++;
      if (collect) records.push(value.document);
    } else if (value.type === 'footer') footer = value;
    else throw new Error('Invalid snapshot record type');
  }
  if (!footer || footer.documents !== documents || footer.digest !== hash.digest('hex') ||
    !footer.report?.complete || footer.report.totals.documents !== documents) throw new Error('Incomplete snapshot');
  // Never expose records until the entire authenticated footer has passed.
  return { verified: true, documents, digest: footer.digest, report: footer.report, ...(collect ? { records } : {}) };
}
