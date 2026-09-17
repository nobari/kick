# Kick Slack Scrum Bot

Kick organizes daily syncs, kudos, team picks, and coins inside Slack. This repository contains both the public website and the Slack Bolt service.

The application uses Next.js 16 and Vercel, with a normalized Neon Postgres backend for existing Slack installations and team history. See [the migration runbook](docs/firestore-neon-migration.md) for cutover status, verification and recovery procedures. Original Firestore records and legacy Google compute services have been deleted; the encrypted migration snapshot is retained for recovery.

## Architecture

- Next.js App Router renders the public website.
- The public site is statically rendered at `https://kick.bozmoz.com` with generated metadata, structured data, `robots.txt`, `sitemap.xml`, and `llms.txt`.
- `/api/slack/[[...path]]` hosts the Slack Bolt Express receiver as a Vercel Function.
- Neon Postgres stores tenant-scoped workflow records and encrypted Slack OAuth installations.
- pnpm manages dependencies and the lockfile.

## Local development

Requirements: Node.js 20.9 or newer and pnpm 11.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The website is available at `http://localhost:3000`. The Slack configuration health endpoint is `http://localhost:3000/api/slack/health`; add `?deep=1` to verify database connectivity. Use an isolated database branch for local development, never the production connection.

## Environment variables

Copy `.env.example` to `.env.local` for local development. Configure the same variables in Vercel for Production, Preview, and Development as appropriate.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public deployment origin, without a trailing slash. |
| `SLACK_CLIENT_ID` | Slack app OAuth client ID. |
| `SLACK_CLIENT_SECRET` | Slack app OAuth client secret. |
| `SLACK_SIGNING_SECRET` | Verifies incoming Slack requests. |
| `SLACK_STATE_SECRET` | A new random secret used to sign OAuth state. |
| `KICK_STORAGE_BACKEND` | Optional; only `postgres` is accepted. No Firestore fallback exists. |
| `DATABASE_URL` | Pooled Neon connection, server-only. |
| `DATABASE_URL_UNPOOLED` | Direct Neon connection for guarded migration tools only. |
| `KICK_DATA_KEY` | Secret 32-byte base64 key for installation encryption. Preserve separately from database backups. |
| `KICK_MAINTENANCE` | Deployment-scoped `1` pauses Slack endpoints with 503; unset or `0` enables them. |
| `CRON_SECRET` | Random shared secret for authenticated scheduler requests. |
| `KICK_SCHEDULER_ENABLED` | Set `true` after connecting the five-minute external scheduler. |
| `KICK_RITUALS_DM_ENABLED` | Set `true` after Slack DM permissions and consent are ready. |

No Google credentials or SDKs are needed at runtime. Historical migration/recovery tools are retained separately. Do not commit environment files, database URLs, encryption keys, or Slack credentials.

Legacy Slack secrets were embedded in old local deployment files. Rotate the Slack client secret, signing secret, bot/user tokens, and test-app credentials before production cutover.

## Slack app URLs

The production Slack app configuration uses the canonical custom domain:

- OAuth redirect URL: `https://kick.bozmoz.com/api/slack/oauth_redirect`
- Request URL for slash commands, interactivity, and events: `https://kick.bozmoz.com/api/slack/events`
- Install URL: `https://kick.bozmoz.com/api/slack/install`

Legacy Cloud Run and Firebase Slack endpoints are fenced during database cutover to prevent writes to the old store. Do not reopen them without following the recovery runbook.

## Verification

```bash
pnpm test
pnpm lint
pnpm build
pnpm audit --prod
```

## Team rituals

Scheduled check-ins, reminders, digests, blockers, onboarding, custom templates, fair rotations, recognition roundups, App Home, and team insights are implemented as opt-in channel workflows. See [the feature guide and activation checklist](docs/team-rituals.md) for Slack permissions, Vercel Cron configuration, retention behavior, and rollout tests.

## Vercel deployment

Import the GitHub repository into the Nobari Vercel team. Vercel detects Next.js and pnpm from `pnpm-lock.yaml` and the `packageManager` field. Add the environment variables above before promoting the deployment to production.
