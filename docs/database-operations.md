# Database operations

Kick uses Neon Postgres exclusively. The website and Slack receiver run on Vercel at `https://kick.bozmoz.com`.

## Schema and verification

- Core tables: `server/db/schema.ts` and `drizzle/0000_normalized_kick.sql`.
- Team rituals: `server/db/ritual-schema.ts` and `drizzle/0001_postgres_rituals.sql`.
- Test schema changes on the isolated rehearsal branch first. Existing production guard scripts validate the exact database target and verified TLS.
- `pnpm test:db` runs local connection and safety checks; database-dependent cases require the rehearsal environment.
- `pnpm test:ritual-db` runs ritual integration checks against the guarded rehearsal branch.
- `https://kick.bozmoz.com/api/slack/health?deep=1` verifies the live database connection without exposing credentials.

## Recovery

Preserve the installation encryption key separately from database backups. Do not replace current production data with a historical snapshot: new records have been written since cutover.

One-time migration tools, their tests, and the historical runbook were removed from the active repository. A recovery archive is retained locally at `/Users/spro/Developer/personal/kick-retired-tools-20260917-cuOWSh/migration-and-legacy-hosting.tgz`. This archive contains tooling, not an additional data export. Existing encrypted data snapshots are preserved separately. Git history also retains the removed source files.

Historical tooling is not a supported runtime path and must not be run against production without reviewing its target, dependencies, and data reconciliation requirements. Prefer recovery into an isolated Postgres branch, followed by verification before promotion.

## Retired infrastructure

On September 17, 2026, a fresh recursive scan of the previous datastore found zero documents. Its empty database container was then deleted. The owner explicitly authorized shutdown of the entire old project `slack-manage`, including its legacy hosting redirects. Provider-managed deletion/recovery retention is not immediate physical erasure; local encrypted recovery copies remain subject to the privacy policy's deletion-request process.

Shutdown verification returned `lifecycleState: DELETE_REQUESTED`, `billingEnabled: false`, and an empty billing-account association. The live canonical-domain deep health check continued to report `ok: true`, `backend: postgres`, and `database: connected`. Other cloud projects were not modified. The project has a provider-managed 30-day recovery window; recovery of individual resources is not guaranteed. See [project deletion lifecycle](https://docs.cloud.google.com/resource-manager/docs/delete-restore-projects).

See [team rituals](team-rituals.md) for scheduler and Slack permission activation status. Neither project retirement nor a code deployment enables paused schedules or grants new Slack permissions.
