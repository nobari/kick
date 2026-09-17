import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

// Read-only: the sole POST operation is Firestore's listCollectionIds RPC.
// No document values, paths, user IDs, or credentials are printed or persisted.
export async function inventory({ request, project, database = '(default)', maxRequests = 20000, progress = () => {},
  onDocument = async () => {},
  readTime = new Date(Date.now() - 5000).toISOString() }) {
  if (!/^[a-z][a-z0-9-]+$/.test(project)) throw new Error('Invalid project ID');
  if (!/^[a-zA-Z0-9_()-]+$/.test(database)) throw new Error('Invalid database ID');
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 200000) throw new Error('Invalid request limit');
  const root = `projects/${project}/databases/${database}/documents`;
  const totals = { documents: 0, missingParents: 0, fieldJsonBytes: 0, requests: 0 };
  const groups = Object.create(null);
  let active = 0, aborted = false, failureCause;
  const waiting = [];
  const call = async (path, options) => {
    if (active >= 6) await new Promise(resolve => waiting.push(resolve));
    else active++;
    try {
      if (aborted) throw failureCause || new Error('Inventory aborted');
      if (++totals.requests > maxRequests) throw new Error('Request safety limit reached; inventory incomplete');
      if (totals.requests % 100 === 0) progress({ ...totals });
      return await request(path, options);
    } catch (error) {
      failureCause ||= error;
      aborted = true;
      throw error;
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
  async function walk(parent, group) {
    let collectionToken;
    do {
      const collections = await call(`${parent}:listCollectionIds`, {
        method: 'POST', body: { pageSize: 100, readTime, ...(collectionToken ? { pageToken: collectionToken } : {}) },
      });
      for (const collection of collections.collectionIds || []) {
        const bucket = group || collection;
        groups[bucket] ||= { documents: 0, missingParents: 0, fieldJsonBytes: 0 };
        let documentToken;
        do {
          const query = new URLSearchParams({ pageSize: '300', showMissing: 'true', readTime });
          if (documentToken) query.set('pageToken', documentToken);
          const page = await call(`${parent}/${encodeURIComponent(collection)}?${query}`, { method: 'GET' });
          const documents = [...(page.documents || [])];
          const workers = await Promise.allSettled(Array.from({ length: Math.min(6, documents.length) }, async () => {
            try {
              while (documents.length) {
                if (aborted) throw failureCause || new Error('Inventory aborted');
                const document = documents.shift();
                // Missing parents have no timestamps; empty existing documents do.
                const missing = !document.createTime && !document.updateTime;
                const key = missing ? 'missingParents' : 'documents';
                groups[bucket][key]++; totals[key]++;
                if (!missing) {
                  const bytes = Buffer.byteLength(JSON.stringify(document.fields || {}));
                  groups[bucket].fieldJsonBytes += bytes; totals.fieldJsonBytes += bytes;
                }
                if (!document.name?.startsWith(`${root}/`)) throw new Error('Invalid document resource name');
                if (!missing) await onDocument(document);
                // Legacy sync/stat parents may have only subcollections.
                await walk(document.name.split('/').map(encodeURIComponent).join('/'), bucket);
              }
            } catch (error) {
              failureCause ||= error;
              aborted = true;
              throw error;
            }
          }));
          const failure = workers.find(worker => worker.status === 'rejected');
          if (failure) throw failure.reason;
          documentToken = page.nextPageToken;
        } while (documentToken);
      }
      collectionToken = collections.nextPageToken;
    } while (collectionToken);
  }
  await walk(root);
  return { project, database, readTime, complete: true, totals, groups,
    note: 'fieldJsonBytes measures typed Firestore JSON only, not billed storage or Postgres table/index size.' };
}

export function retryingFirestoreRequest({ getToken, fetcher = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  return async (path, options) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      let response;
      try {
        response = await fetcher(`https://firestore.googleapis.com/v1/${path}`, {
          method: options.method, signal: AbortSignal.timeout(30000),
          headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        });
        if (response.ok) return await response.json();
        if (![429, 500, 502, 503, 504].includes(response.status)) {
          const error = new Error('Firestore request rejected');
          error.code = `HTTP_${response.status}`;
          throw error;
        }
      } catch (error) {
        if (typeof error.code === 'string' && error.code.startsWith('HTTP_')) throw error;
        if (attempt === 4) throw Object.assign(new Error('Firestore transport retries exhausted'), { code: 'TRANSPORT_RETRIES' });
      }
      if (attempt === 4) throw Object.assign(new Error('Firestore service retries exhausted'), { code: `HTTP_${response.status}` });
      await sleep(Math.min(8000, 500 * 2 ** attempt));
    }
  };
}

export function googleRequest() {
  let token;
  try {
    token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    throw new Error('Google Cloud login unavailable. Run gcloud auth login, then retry.');
  }
  return retryingFirestoreRequest({ getToken: () => token });
}

async function main() {
  const project = process.argv[2];
  if (!project) throw new Error('Usage: node scripts/db/firestore-inventory.mjs PROJECT_ID');
  const request = googleRequest();
  const maxRequests = Number(process.argv[3] || 20000);
  const report = await inventory({ request, project, maxRequests,
    progress: totals => {
      if (totals.requests % 1000 === 0) console.error(`Inventory: ${totals.documents} documents, ${totals.requests} requests, ${(totals.fieldJsonBytes / 1048576).toFixed(1)} MiB field JSON`);
    } });
  if (process.argv[4]) writeFileSync(process.argv[4], `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
