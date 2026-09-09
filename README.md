# Kick Slack Scrum Bot

Kick organizes daily syncs, kudos, team picks, and coins inside Slack. This repository contains both the public website and the Slack Bolt service.

The application has been migrated from a Pug/Firebase/Cloud Run setup to Next.js 16 and Vercel. Firestore remains the persistent data store so existing Slack installations and team history can continue to work.

## Architecture

- Next.js App Router renders the public website.
- The public site is statically rendered at `https://kick.bozmoz.com` with generated metadata, structured data, `robots.txt`, `sitemap.xml`, and `llms.txt`.
- `/api/slack/[[...path]]` hosts the Slack Bolt Express receiver as a Vercel Function.
- Google Cloud Firestore stores Slack OAuth installations and workflow records.
- pnpm manages dependencies and the lockfile.

## Local development

Requirements: Node.js 20.9 or newer and pnpm 11.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The website is available at `http://localhost:3000`. The Slack configuration health endpoint is `http://localhost:3000/api/slack/health`; add `?deep=1` to verify Firestore connectivity.

## Environment variables

Copy `.env.example` to `.env.local` for local development. Configure the same variables in Vercel for Production, Preview, and Development as appropriate.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public deployment origin, without a trailing slash. |
| `SLACK_CLIENT_ID` | Slack app OAuth client ID. |
| `SLACK_CLIENT_SECRET` | Slack app OAuth client secret. |
| `SLACK_SIGNING_SECRET` | Verifies incoming Slack requests. |
| `SLACK_STATE_SECRET` | A new random secret used to sign OAuth state. |
| `GCP_PROJECT_ID` | Google Cloud project containing the existing Firestore database. |
| `GCP_PROJECT_NUMBER` | Numeric Google Cloud project identifier. |
| `GCP_SERVICE_ACCOUNT_EMAIL` | Dedicated Firestore service-account identity. |
| `GCP_WORKLOAD_IDENTITY_POOL_ID` | Google workload-identity pool trusted by Vercel. |
| `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` | OIDC provider inside the workload-identity pool. |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Optional local-development fallback; not needed on Vercel. |

Vercel obtains a short-lived Google credential through OIDC and impersonates a dedicated service account with `roles/datastore.user`. No permanent Google private key is stored in Vercel. Do not commit `.env.local`, service-account JSON, or Slack credentials.

Legacy Slack secrets were embedded in old local deployment files. Rotate the Slack client secret, signing secret, bot/user tokens, and test-app credentials before production cutover.

## Slack app URLs

The production Slack app configuration uses the canonical custom domain:

- OAuth redirect URL: `https://kick.bozmoz.com/api/slack/oauth_redirect`
- Request URL for slash commands, interactivity, and events: `https://kick.bozmoz.com/api/slack/events`
- Install URL: `https://kick.bozmoz.com/api/slack/install`

Keep the Cloud Run service available until the Vercel environment variables are set, the OAuth redirect URL is accepted by Slack, and a command has been tested in a non-production workspace.

## Verification

```bash
pnpm lint
pnpm build
pnpm audit --prod
```

## Vercel deployment

Import the GitHub repository into the Nobari Vercel team. Vercel detects Next.js and pnpm from `pnpm-lock.yaml` and the `packageManager` field. Add the environment variables above before promoting the deployment to production.
