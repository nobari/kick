# Firestore → Neon migration status

Updated September 17, 2026.

**Current status: production migration complete.** `https://kick.bozmoz.com` uses Neon Postgres as of approximately 08:21 UTC. Final import/reconciliation, 164 report comparisons, and a signed production Slack workflow passed. See [Production cutover](#production-cutover--september-17-2026) below for the deployment, backup and recovery record. Earlier sections preserve the rehearsal history.

**Subsequent cleanup authorized and completed:** original Firestore records and legacy Google compute services were deleted. The old-deployment rollback instructions below are historical and no longer executable without recreating infrastructure and restoring data. See the cleanup record at the end.

## Provisioning completed

- Vercel scope/project: `nobari/kick`.
- Neon resource: `kick-db`, ID `store_hLYIxpPKE6ngiDk4`.
- Explicit plan: `free_v3`; region: `iad1`; Neon Auth disabled (Slack remains the identity provider).
- Connected to the **production environment only**. No production database credentials were connected to preview or development.
- SQL connectivity check succeeded. Empty database size approximately 7.7 MB (Postgres size, not provider billable storage).
- Added `@neondatabase/serverless` using pnpm.
- Integration-installed Neon skills are present in `.agents/skills` with `skills-lock.json`.
- Production variables pulled to ignored `.env.migration.local`; existing `.env.local` was not overwritten. Four unrelated sensitive values are placeholders, so this file must not be used to run the Slack app.

## Completed source inventory

At snapshot time `2026-09-17T01:03:32.940Z`, the complete read-only pass found **39,372 documents**, **95 missing parents**, and **27,109,433 bytes (25.9 MiB)** of typed field JSON across 39,906 requests. The private aggregate report is `/tmp/kick-firestore-inventory-20260917.json`; no document values or IDs were written there.

| Root collection | Documents, including descendants |
| --- | ---: |
| auth | 132 |
| err | 7,892 |
| info | 4,872 |
| kudos | 13,045 |
| pick | 423 |
| stat | 863 |
| statc | 1,552 |
| sync | 10,593 |

The 95 missing parents are in `stat` (61), `statc` (17), and `sync` (17). Their subcollections contain real data and must not be skipped. The measured data volume looks compatible with the free allocation, but final fit is gated on actual imported tables/indexes, encryption overhead, and growth headroom. The scan is not an export or a backup.

## Pre-cutover state (historical)

Before the explicitly authorized cutover recorded below, the published app continued using Firestore: provisioning a database URL alone did not switch storage. Earlier incomplete exports remain encrypted `.partial` files and must not be imported. A subsequent full export and rehearsal import succeeded, as recorded below.

Google Cloud was reauthenticated successfully. Source database: Firestore Native, `slack-manage/(default)`, region `asia-east1`. The target is `iad1`, matching the Vercel app; this is a cross-region migration, not preservation of the previous storage location.

Neon CLI authorization now works via ignored `.env.neon.local`. Created isolated branch `migration-rehearsal-20260917` (`br-old-voice-aw1siabw`), expiring September 24. Direct and pooled URLs plus separate random database-encryption and snapshot-encryption keys are in owner-only, ignored `.env.rehearsal.local`. Never print or commit these values.

## Normalized relational schema

The requested design replaces Firestore's document structure rather than emulating it. `server/db/schema.ts` is the Drizzle source, with a versioned SQL migration in `drizzle/`:

- Workspaces, enterprise accounts, members, channels and channel membership have explicit keys and relationships.
- Installation metadata is queryable; the Slack credential envelope has a dedicated encrypted field and key version. Partial unique indexes permit one active installation per workspace/enterprise and environment while retaining revocation history.
- Standup threads and updates are separate, indexed by workspace/channel/time and member/time. Slack timestamps remain exact text rather than floating-point numbers.
- Recognition events and recipient grants are separate, supporting multi-recipient kudos and coins without duplicating event metadata.
- Picks and participants are separate, allowing future candidate-pool tracking without inventing missing historical candidates.
- Composite foreign keys reject cross-workspace relationships. Quantity checks and natural-message uniqueness protect data integrity.
- Request deduplication and leased outbox tables provide foundations for atomic workflows; handlers still need integration. They do not guarantee exactly-once Slack delivery by themselves.
- Migration audit records and legacy metric baselines are separate from operational tables. Raw legacy records belong in the encrypted snapshot, not a generic JSON document store.

The migration runner is restricted to the exact rehearsal endpoint and verified TLS; it has no production override:

```sh
node --env-file=.env.rehearsal.local scripts/db/rehearsal-db.mjs
node --env-file=.env.rehearsal.local --test tests/database-schema.test.mjs
```

Database tests use synthetic records inside a rolled-back transaction. Runtime integration, historical report parity, live Slack smoke testing and production cutover are verified as recorded below.

## Verified rehearsal completed

- Consistent source snapshot: `2026-09-17T01:55:07.766Z`, **39,380 documents**. Eight additional standup documents appeared after the earlier inventory; the export uses one fixed read time, not a moving view.
- Complete encrypted file: `/tmp/kick-migration-snapshot-7HFqzZ/rehearsal-resilient.kickenc`. Footer, record authentication, ordering and source-content digest verified successfully. This local temporary file is a rehearsal backup, not the durable final-cutover backup.
- Dry run: zero mapping failures. Import committed atomically on `br-old-voice-aw1siabw` only. A repeat invocation compared all mapped field values and decrypted credential envelopes and made no writes.
- Audit accounts for every source document: 29,906 imported, 1,582 derived (thread/statistical state), 7,892 archived (legacy error records retained in encrypted snapshot, not copied into an operational log table).
- Target rows: 132 workspaces, 4 enterprise accounts, 5,296 members, 121 channels, 477 channel memberships, 133 encrypted installation envelopes (production/test separated), 3 settings, 1,552 standup threads, 10,601 standup updates, 7,691 recognition events, 13,045 recipient grants, 423 picks, 476 pick participants and 1,349 legacy metric baseline rows.
- Neon table/index diagnostics and `pg_database_size` measured **44,646,400 bytes (~42.6 MiB)**, including audit and database overhead. This is a Postgres measurement, not a provider billing estimate; it is comfortably below the configured 512 MiB branch limit. Free compute/egress limits and future growth still require monitoring.
- `server/db/installations.cjs` implements encrypted installation storage, reinstalls, token updates, environment separation and revocation. Live rehearsal tests cover workspace installations inside enterprise accounts and enterprise-wide installations. Bolt now selects this repository only when `KICK_STORAGE_BACKEND=postgres`.
- `server/db/connection.cjs` supplies a lazy, bounded pooled connection with verified TLS, Vercel lifecycle attachment, transaction rollback and connection release. The Postgres handler path uses it without initializing Firestore; Firestore remains the default until explicitly switched.
- `pnpm build`, TypeScript and lint checks pass. Migration tests cover snapshot integrity, retries (including numeric DOMException timeout codes), normalization, constraints, credential encryption, installation lifecycle, batch inserts, rollback, transaction cleanup and field-level reconciliation.

Re-run the dry run without writes:

```sh
node --env-file=.env.rehearsal.local scripts/db/import-rehearsal.mjs /tmp/kick-migration-snapshot-7HFqzZ/rehearsal-resilient.kickenc
```

Adding `--apply` is restricted to the rehearsal endpoint. A new snapshot refuses a non-empty target. The already imported snapshot is reconciled without writes. Imports are atomic and restartable, not partial-batch resumable. Neither a completed import nor schema constraints alone prove command-handler or Slack delivery correctness.

## Application integration and isolated release

- `server/db/workflows.cjs` provides native relational operations for context/membership caches, settings, standup threads and updates, kudos/coins, picks and reports. Standup + attached recognition writes are atomic. Repeated writes of the same Slack message identity do not create duplicate database events/grants.
- `server/slack.js` selects Postgres explicitly using `KICK_STORAGE_BACKEND=postgres`. Required server-only values are `DATABASE_URL` (pooled) and `KICK_DATA_KEY`, alongside the existing Slack credentials. There is no silent fallback to Firestore after a Postgres error. `DATABASE_URL_UNPOOLED` is only for migration/admin tooling.
- The encryption key must match the imported credentials. It is not a `NEXT_PUBLIC_` variable. No real environment values have been changed as part of this integration.
- Postgres mode suppresses legacy payload logging, disables the unreleased rituals registration and does not request the draft `im:write` scope. Membership refresh paginates both Slack member APIs.
- Handler integration tests execute registered sync/kudos/coins/pick modal callbacks against the real rehearsal Postgres database using a **simulated Slack client**, with synthetic data rolled back afterward. They check tenant isolation, atomic failure rollback, report rendering, settings and membership. No real Slack messages were sent.
- Read-only historical report parity passed **164 queries**: 30 standup channels and 52 recognition workspaces, each over all history and the final seven-day snapshot window. The comparison uses independent decoded source records and canonical report values, not only counts.
- Isolated release directory: `/tmp/kick-postgres-release-Y7h3p8`. Based on the published website baseline `/tmp/kick-onboarding-5PynCe`, with migration server/dependencies overlaid. Draft rituals and scheduler are removed from this artifact; no scheduler route is built. Frozen pnpm install and production build pass. This artifact is local only: **not deployed or promoted**.
- Remaining reliability limitation: message-ID uniqueness protects database writes, not arbitrary Slack side effects. The existing send-before-save behavior and concurrent thread creation can still require operational reconciliation after an ambiguous Slack/DB failure. The outbox and processed-request tables are foundations, not implemented delivery guarantees. Do not describe this release as exactly-once or fully retry-safe.
- Owner authorized live tests in `saamoj` / `C8PBFSSC9` (#general). On September 17, the isolated release's actual sync/kudos/coins/pick callbacks sent five successful Slack API messages beneath one labeled bot-only root: https://saamoj.slack.com/archives/C8PBFSSC9/p1789631653689689 . No humans were selected and no published callbacks were changed.
- The live test exposed a missing direct `@slack/web-api` dependency in the isolated pnpm release; pinned 7.19.0 explicitly in both manifests/lockfiles. Initial dependency failures sent no messages. The later live run completed all sends/callbacks, but a harness assertion incorrectly read `ts` from the standup report DTO. Fixed the assertion to use its thread field `cts`, then verified all database results with recorded successful Slack responses (no duplicate sends). Standup, three recognition records including one coin, and pick checks passed. Both transactions rolled back; Slack test messages remain visible. This is live outbound API plus callback/repository verification, **not** inbound HTTP/signature, OAuth, real modal UI, or deployed Vercel verification. Pick used one bot candidate; multi-person UI selection was not tested live.
- `scripts/db/slack-smoke.mjs` is strictly guarded to the rehearsal branch and approved channel, with Slack retries disabled. Do not rerun its posting mode without checking existing messages. Its recorded-response verification mode does not post. Production stays on Firestore.

```sh
node --env-file=.env.rehearsal.local --test tests/postgres-handlers.test.mjs
node --env-file=.env.rehearsal.local scripts/db/verify-report-parity.mjs /tmp/kick-migration-snapshot-7HFqzZ/rehearsal-resilient.kickenc
```

## Read-only inventory

`scripts/db/firestore-inventory.mjs` uses the logged-in gcloud account to read Firestore via REST. It fixes a read timestamp for the run, paginates collection IDs and documents, and traverses missing parents using `showMissing=true`. It outputs only counts and estimated field JSON bytes grouped by root collection; it does not print tokens, document IDs, or values and does not persist source records.

The tool uses billable Firestore reads. It defaults to a 20,000-request cap and six concurrent requests. An initial run reached the cap after approximately 19,800 documents; that was an incomplete inventory, not a free-tier sizing result. The successful second pass used an explicit 100,000-request cap and saved an aggregate report to `/tmp/kick-firestore-inventory-20260917.json` only on completion (choose a new output filename to rerun):

```sh
node scripts/db/firestore-inventory.mjs slack-manage 100000 /tmp/kick-firestore-inventory-20260917.json
```

It fails without claiming a complete report if authorization, snapshot age, or another request fails. Its size estimate excludes Postgres indexes and row overhead and is not a billed-size measurement.

## Encrypted snapshot tooling

- `scripts/db/firestore-export.mjs PROJECT OUTPUT MAX_REQUESTS` streams raw Firestore documents into AES-256-GCM encrypted records, preserving original value types and precision. Use an explicit cap of 100000 for this dataset; the default is 20000.
- `BACKUP_KEY_BASE64` must be a separately stored 32-byte random encryption key. Never print it or commit it. Losing this key makes the backup unrecoverable.
- The output must be outside the repository. Files are owner-only, created exclusively, and never overwrite existing backups. Failed exports leave encrypted `.partial` files rather than complete backups.
- Snapshot ID and sequence numbers are authenticated. An encrypted footer records the document count and content digest.
- `scripts/db/verify-snapshot.mjs FILE` validates every record and footer without printing record contents. Verify before importing any data.
- The exporter restarts an interrupted snapshot. Transient transport/429/5xx failures have up to five attempts per logical request; authorization and validation failures stop immediately. The request cap counts logical requests, not retry attempts. Concurrent failures preserve the original diagnostic code without exposing upstream response bodies.
- Run `pnpm test:db` for offline tests; live database tests skip without rehearsal configuration. To include the isolated database tests, run `node --env-file=.env.rehearsal.local --test tests/*.test.mjs`.

## Original pre-cutover sequence (completed; do not replay against live data)

1. Preserve the verified rehearsal snapshot and its separately stored key. Rehearsal export/import and initial size checks are complete; do not reuse this aging snapshot for final production cutover.
2. Use the built isolated migration release, refreshing it only with reviewed migration changes. Do not deploy all uncommitted feature work.
3. Complete the owner-approved live Slack smoke test and evaluate the documented send-before-save/retry limitation before cutover. Automated handler and historical report tests are complete; no exactly-once delivery guarantee is claimed.
4. Preserve reconciliation/tenant-isolation tests and verify backup restoration/final import. Never point ordinary previews at production data.
5. Ask for the production maintenance window before pausing writes. Drain in-flight work, take a consistent final export, import/reconcile, switch and smoke-test before reopening.
6. Update public storage disclosures at cutover, including temporary Firestore backup retention. Do not claim Neon is the live datastore before the switch.
7. Keep Firestore unchanged for the agreed rollback window. After Neon accepts writes, rollback requires reconciling new data, not just reverting a deployment. Remove old credentials/data only with approval.

No paid plan upgrade or automatic data truncation is authorized.

## Production cutover — September 17, 2026

Owner explicitly authorized immediate migration after the rehearsal smoke test.

- Main target: `br-plain-union-awztoj84`, direct endpoint `ep-muddy-pine-awoaob9z.c-12.us-east-1.aws.neon.tech`. `production-db.mjs` guards it independently of rehearsal tools. Schema applied with the tested Drizzle migration; target tables verified empty before import.
- Production-only `KICK_DATA_KEY` and `KICK_STORAGE_BACKEND=postgres` configured. Existing Slack secrets and database integration retained; no preview environment given production credentials.
- Maintenance deployment: `dpl_BLoBoKxUN8JYNpj5prBRP4t3aAUv` / `kick-b9mfn6pr3-nobari.vercel.app`. API returns 503 with Retry-After. Promoted around 08:03 UTC. Website remains accessible.
- Candidate: `dpl_5CLNG145CHQRC2LCV2fzrr6KNBSc` / `kick-jzvmx5koe-nobari.vercel.app`. Production build, deep Postgres health, and signed Slack challenge passed. Candidate has no crons or unreleased rituals. Privacy policy discloses Neon storage and retained migration recovery copies.
- Source fencing: removed only `allUsers` invoker bindings from Cloud Run `grun` and `grun-test` (asia-northeast1) and Firebase function `s` (us-central1). Removed `roles/datastore.user` from the dedicated `vercel-kick@slack-manage.iam.gserviceaccount.com` account. Public legacy requests return 403; previous Vercel deep health confirms Firestore unavailable. No records, services, or service accounts deleted. Other Google services and shared service-account roles untouched.
- Drain: legacy Cloud Run requests have a 300-second timeout; wait past that interval after fencing before the export. Firebase/Vercel routes have a 60-second timeout.
- Encrypted final backup location: `/Users/spro/Developer/personal/kick-migration-20260917-fvsPvQ/final.kickenc`. Credentials/keys are in owner-only ignored `.env.cutover.local`, separate from backup. Backup completed and authenticated: 39,380 documents at `2026-09-17T08:11:10.653Z`, 50,548,297 encrypted bytes, permissions 0600. Preserve the key separately; do not commit or print it.

Recovery before any new Postgres writes: keep maintenance active; restore the dedicated Vercel account's `roles/datastore.user` binding; restore legacy public invoker bindings only if returning those endpoints to service; wait for propagation; verify old deployment deep health; then promote `dpl_7wbEgyorUDrhZLpN9BWfBxJ3XvBc`. Reset production `KICK_STORAGE_BACKEND` to `firestore` before future rebuilds. **After Postgres accepts writes, do not perform this simple rollback: reconcile new records back into Firestore first.**

### Completed

- Final import committed atomically after value-level reconciliation (including decrypted installation envelopes): all 39,380 source documents accounted for. Runtime data includes 132 workspaces, 133 installation records, 10,601 standups, 7,691 recognition events / 13,045 recipients, and 423 historical picks. Legacy diagnostic error documents remain in the encrypted backup rather than the runtime schema. Source Firestore remains intact.
- Production report parity: **164 comparisons passed**, covering 30 standup channels and 52 recognition workspaces across all history and seven-day windows. Ran before reopening production and adding any smoke-test record.
- Final release: **`dpl_BUEv6uLhx8TY7uL85vMGk1zHPBQf`**, `kick-owl740osf-nobari.vercel.app`, promoted around **08:21 UTC** to `https://kick.bozmoz.com`. The default `kick-nobari.vercel.app` alias also points to this release. Maintenance is off. Deep health confirms `backend: postgres`, `database: connected`, no missing environment variables.
- The final release's signed Slack URL challenge passed; prior equivalent candidate rejected unsigned requests with 401. OAuth entry redirects to Slack's v2 authorization page with the existing client ID, state protection, and unchanged scopes. As in the published baseline, it relies on Slack's configured default callback rather than an explicit `redirect_uri` query parameter. A real user OAuth consent/reinstall was not performed.
- Signed synthetic `pick_submit` request sent through the **public canonical production endpoint**, exercising signature verification, migrated installation lookup/decryption, real Slack API posting, and production Postgres persistence. Passed: https://saamoj.slack.com/archives/C8PBFSSC9/p1789633290582939 . Test selected only Kick itself and was labeled `[TEST]`; one test pick and its participant remain as evidence. This is a signed synthetic callback, not manual modal UI testing.
- Final public landing, privacy, support and getting-started pages return 200. Landing and privacy disclosures now name Neon Postgres and describe retained recovery copies. No Slack URLs, scopes, or app listing settings changed.
- Automated verification: 35 tests passed with rehearsal integration enabled, 7 website compliance checks passed, production build passed. Main database measured 43,565,056 bytes before the live smoke record. Free-plan configuration unchanged; no plan upgrade.
- Durable code artifact (no environment files or dependencies): `/Users/spro/Developer/personal/kick-migration-20260917-fvsPvQ/release/`. Workspace still contains unrelated unshipped feature work: do not deploy it wholesale.
- Early post-promotion error scan (08:22 UTC, final deployment, preceding ten minutes) returned no error entries. Monitoring currently relies on Vercel runtime logs and health checks; no paid drain or external monitoring integration was added.

Production now accepts Postgres writes. Keep legacy endpoints fenced; the simple pre-write rollback instructions above are no longer sufficient.

## Legacy infrastructure cleanup — September 17, 2026

Owner requested deletion of Firestore records and unused infrastructure, and separately confirmed deletion of `samo` after it was identified as an unrelated image-generation proxy.

- Verified the authenticated final snapshot and live Postgres deep health before deleting anything. Deleted **39,380 Firestore documents** in batches with each document's backed-up `updateTime` as a precondition. Any newer record would have failed its batch rather than being silently deleted. A fresh recursive scan confirmed **zero documents remaining**. The empty database container was left intact.
- Deletion script: `scripts/db/delete-legacy-firestore.mjs`. It is bound to the exact snapshot/project, refuses journal overwrite, and does not automatically retry ambiguous mutations. Owner-only audit journal: `/Users/spro/Developer/personal/kick-legacy-cleanup-20260917-ltsKbi/firestore-deletion.jsonl`.
- Deleted Cloud Run services `grun` and `grun-test` (asia-northeast1), Firebase functions `s` and `hello` (us-central1), and confirmed function `samo` (asia-east1) together with its managed Cloud Run service. No Cloud Run services or Cloud Functions remain in this project.
- Deleted the four Cloud Run mappings for `api.notbutsimple.com`, `api.sadeandmoji.com`, `test.notbutsimple.com`, and `test.sadeandmoji.com`. External DNS records were not modified.
- Deleted the dedicated `vercel-kick` Google service account and `vercel` workload identity pool after confirming that it was the only account using that pool. Shared Google/Firebase service accounts were not deleted.
- Removed all five obsolete `GCP_*` connection variables from Vercel production and preview (10 entries). Slack, Postgres, encryption keys and canonical-domain settings remain intact. The new deployment was built without those Google variables.
- Deleted the `cloud-run-source-deploy` Artifact Registry repository after confirming it contained only `grun` / `grun-test` images. Deleted the four empty legacy GCR repositories (`asia.gcr.io`, `gcr.io`, `us.gcr.io`, `eu.gcr.io`).
- Deleted the confirmed legacy source archives under `run-sources-slack-manage-asia-northeast1/services/grun/`, `slack-manage_cloudbuild/source/` (47 objects, 671,283,413 bytes), and six legacy function prefixes in `gcf-sources-69564326211-us-central1`. Empty/system-managed bucket containers and their platform marker were preserved. Cloud Storage soft-deleted copies can remain until the configured retention expires (the inspected Cloud Run source bucket uses seven days); this is not a promise of immediate zero billing.
- Preserved the encrypted final database backup, recovery keys, current Vercel release artifact, Google project, and shared/system-managed resources. Existing Neon runtime/test resources were not deleted.
- Privacy policy now states that original Firestore records are deleted and encrypted recovery snapshots remain. Cleanup release: **`dpl_83n2T5QT2NdFP27CbZ9BCsizV47F`**, `kick-5s1ps0t66-nobari.vercel.app`, promoted to the canonical domain and default alias. Build and seven website compliance tests passed; deep database health passed without Google credentials.

Recovery now requires restoring from the encrypted snapshot into recreated infrastructure, not merely re-enabling the old deployment. Postgres remains authoritative for all post-cutover activity. Keep `BACKUP_KEY_BASE64` and `KICK_DATA_KEY` safe and separate from backups.
