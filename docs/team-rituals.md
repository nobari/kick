# Kick team rituals: implementation and activation

The ten roadmap features are implemented in `server/rituals` using **Postgres only**. Existing installations and command history remain in their migrated Postgres tables. No channel is scheduled automatically. Setup defaults to **Paused** and requires preview/confirmation. Production activation status is recorded below; code availability is not proof of Slack settings or live delivery.

## Feature guide

| Feature | Entry point | Behavior |
| --- | --- | --- |
| Scheduled standups | `/sync setup` | Public channel, 1–50 participants, weekdays, IANA time zone, check-in and same-day digest times. |
| Gentle reminders | `/sync preferences` | One private reminder after an hour; personal time zone, quiet hours, disable, one-hour snooze, and leave-through date. |
| Daily digest | Channel setup | Summary of submitted answers, pending participants, and open-blocker count. Full updates remain available from Home. |
| Blocker follow-up | Check-in form and Home | Optional blocker/helper, reassignment, resolution, weekday helper reminders after 24 hours. |
| Guided onboarding | `/sync setup` or Home | Choose channel, set options, preview questions and delivery schedule, confirm. |
| Custom templates | Channel setup | Standup, weekly wins, retrospective, or 1–5 custom questions. Configure weekdays to match the desired cadence. |
| Fair rotations | `/pick rotate` or Home | Least-recently-selected participant, deterministic ties, per-pick exclusions, persistent history. This is separate from the original random `/pick`. |
| Recognition roundups | Channel setup | Optional Friday recap of new `/kudos` and `/coins` activity in that channel; no rankings. |
| App Home | Open Kick in Slack; `/sync home` refreshes it | Channel switcher, personal submission status, updates with paginated browsing, blockers, appreciation, preferences, settings, and rotations. |
| Team insights | Home | Rolling seven-day participation and blocker counts compared with the previous period. No individual productivity score. |

Use `/sync checkin` or the scheduled message button for template-aware submissions. Original `/sync` submissions also count toward an active **standup** template, but not wins/retro/custom templates. Existing historical updates are not backfilled. Submissions are immutable per person/session to make retries safe; legacy edits do not rewrite the new digest record.

## Slack activation

For app `A044BL326B1` in Slack app settings:

1. **App Home → Show Tabs → Home Tab:** enable it.
2. **Event Subscriptions → Subscribe to bot events:** add `app_home_opened`. The verified request URL remains `https://kick.bozmoz.com/api/slack/events`.
3. **OAuth & Permissions → Bot Token Scopes:** add `im:write` for opening one-to-one reminder conversations. Keep the existing scopes (`channels:history`, `channels:read`, `chat:write`, `chat:write.public`, `commands`, `users:read`). No user-token scopes are needed.
4. **Interactivity & Shortcuts:** enable interactivity and keep `https://kick.bozmoz.com/api/slack/events` as its request URL.
5. Existing `/sync`, `/pick`, `/kudos`, and `/coins` slash command URLs remain unchanged. No new slash command registration is required.
6. Keep the public installation flow on the currently approved scopes while the Marketplace update is pending. Its current URL does not request `im:write`, so repeating that flow will not grant the additional permission. Test draft permissions using Slack's supported development/test-app flow. After approval, enable the new scope in the production installation flow and reinstall through `https://kick.bozmoz.com/api/slack/install`. The OAuth redirect URL remains `https://kick.bozmoz.com/api/slack/oauth_redirect`.
7. Update the Slack review submission to explain scheduled check-ins, private reminders, App Home, and the new scope. Do not claim that these changes are approved until Slack approves them.
8. After permission approval and reinstall consent, set `KICK_RITUALS_DM_ENABLED=true` in Vercel Production and redeploy. Until then, DM jobs are suppressed, existing OAuth scopes remain unchanged, and setup explains that private reminders are unavailable.

Official references: [App Home event](https://docs.slack.dev/reference/events/app_home_opened/), [opening direct messages and required scopes](https://docs.slack.dev/reference/methods/conversations.open/).

The [Slack review guide](https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide/) warns that requesting unreviewed scopes in the public installation link can break installation. In the current runtime, `KICK_RITUALS_DM_ENABLED` also controls whether OAuth requests `im:write`; keep it false until the published configuration supports that scope.

## External scheduler and Vercel activation

- Set a randomly generated `CRON_SECRET` in the production environment. Keep the value secret; do not put it in a URL or commit it. Redeploy after setting it.
- `scheduler/wrangler.jsonc` defines a Cloudflare scheduled Worker every five minutes. The user approved a free external scheduler. Vercel stays on Hobby; `vercel.json` deliberately has no Vercel cron entries.
- **Activation hold:** do not deploy that five-minute schedule unchanged on the current Neon Free plan. Neon includes 100 CU-hours/project/month and suspends idle compute after five minutes. Five-minute database polling risks keeping compute awake continuously (about 180 CU-hours over 30 days at 0.25 CU). Choose a less frequent cadence or bounded operating hours before activation; ordinary app traffic and rehearsal compute also consume the allowance. See [Neon pricing](https://neon.com/pricing). No free-tier capacity guarantee is implied.
- Authenticate with `pnpm dlx wrangler login`, deploy with `pnpm dlx wrangler deploy --config scheduler/wrangler.jsonc`, and securely supply the same `CRON_SECRET` via `wrangler secret put`. The Worker has no public route and no Slack/database credentials. Never pass the secret as a command-line argument.
- Set `KICK_SCHEDULER_ENABLED=true` only after connecting the scheduler. Until then the cron endpoint returns 503 after authentication and setup refuses to activate a schedule. Existing commands and paused configuration remain available.
- Apply `drizzle/0001_postgres_rituals.sql` via the guarded migration runner before deploying this runtime. Nine typed tables replace the old document collections, with composite tenant foreign keys, indexed due jobs/expiry, and per-session response uniqueness. No Google SDK or credential is used.
- Verify missing/incorrect authorization returns 401 and non-GET requests return 405. An authenticated invocation performs real work: test it only after configuring a dedicated test channel.
- The API has a 60-second limit. New Slack modal/event work uses Vercel `waitUntil` so the acknowledgment is not delayed by database work. Background tasks are still subject to the function's lifetime; this is not an unlimited durable workflow runtime.

Official references: [secured and concurrent Cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Vercel background processing](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil).

## Data protection and operations

- Workflow owners and workspace admins can edit settings. Channel membership is checked before displaying records. Blocker edits require the reporter, helper, owner, or workspace admin. Private and archived channels are excluded in this release.
- New runs snapshot questions and participants. Leave dates exclude people from new runs. Participant departures are checked before new sessions and private message delivery. Quiet hours affect private messages, not channel-wide digests.
- New workflow records expire after 7, 30, or 90 days. Shortening retention reduces existing new-workflow record deadlines from their creation times. Expired data is hidden by reads and removed in bounded scheduler batches. Cleanup is not instantaneous and requires a running scheduler. This does **not** delete Slack messages or legacy records.
- Preference/configuration records remain until a separate account-data deletion request is handled; retention here applies to workflow history, not every stored setting. Drafts expire after 15 minutes. Existing support/privacy processes continue to apply.
- Jobs use stable IDs, transactional leases, exponential backoff, and a stable Slack client message ID. Eight failed attempts put a job into terminal `failed` status with a sanitized error. Inspect `ritual_jobs` for `status == failed`. Fix the permission/configuration issue before explicitly retrying a job.
- Exactly-once delivery across Postgres and Slack cannot be guaranteed: a process failure after Slack accepts a message but before the database marks it sent can still cause a duplicate. Do not describe the queue as exactly-once. Lease-owner checks prevent stale workers from completing a reclaimed job. Rotation state and its delivery job commit atomically.
- Each tick handles up to ten due configurations and 25 delivery jobs, with a time budget. Monitor backlog as workspace count grows. Scale workers before high-volume rollout. Due jobs/configurations and retention lookups use Postgres indexes; no Firestore indexes are involved.
- The scheduler catches up existing digests for up to two days. It does not replay missed historical standup prompts. A first tick after the day's digest cutoff does not create a retroactive session. Friday roundups use a rolling seven-day window; enable scheduling before the intended delivery window.
- Secrets are no longer printed by the installation store/fetch logging paths touched by this change.

## Verification before rollout

Run `pnpm test`, `pnpm lint`, and `pnpm build`. Run `pnpm test:ritual-db` for real Postgres transaction, concurrency, tenant isolation, scheduler, rotation, and retention checks against the guarded rehearsal branch. Slack calls in these tests are mocked: they do not prove live Slack permissions or actual message delivery. Core handler regression tests also run against Postgres.

In a dedicated public Slack test channel:

1. Configure two human participants and a near-future schedule; confirm the preview and enable.
2. Verify exactly one scheduled prompt under repeated/overlapping scheduler invocations.
3. Submit using the message button. Verify custom questions, Home status, and duplicate-submission behavior.
4. Leave the other participant unanswered; verify the one-hour reminder, snooze, quiet hours, disable, and leave exclusion.
5. Verify the digest at the configured time, including pending count and full-update browsing.
6. Add a blocker, assign it, verify a follow-up after 24 hours, resolve it, and verify follow-ups stop.
7. Repeat a rotation, including exclusions, and verify least-recent history.
8. Send kudos and verify Home recognition and the enabled Friday roundup.
9. Verify a non-owner cannot edit settings and a nonmember cannot view channel records.
10. Verify retention cleanup on seeded expired test records, the aggregate insights, and pause behavior.

Only after this test should you enable schedules in real team channels. No real team schedule is created automatically by deployment.

## September 17 completion status

- Postgres migration applied and tested on the isolated rehearsal branch, then applied additively to production. No core history was deleted or reimported.
- Production release `dpl_5zoSyrcuDeReNuUBvpSR2XkCEFsK` (`kick-kavasszs8-nobari.vercel.app`) promoted to `https://kick.bozmoz.com`. Scheduling and DM flags are explicitly false on this deployment. Home/commands are wired to Postgres; Slack Home activation still requires the settings above.
- Isolated release source: `/Users/spro/Developer/personal/kick-ritual-release-20260917-jEG6lX/`. Unrelated working-tree website changes were not included. No new commit was created.
- 46 local workflow/OAuth/scheduler tests, 10 real-Postgres ritual integration checks, five database/installation checks, one core-handler integration check, and seven website checks passed. Lint, TypeScript, production build, and staged database/OAuth/HTTP guards passed.
- Cloudflare CLI authentication verified after the user's login. The `kick-ritual-scheduler` Worker does not yet exist; deployment is paused for the free-tier compute constraint above. No paid plan has been activated.
- User reports Home/event configuration and reinstall completed, without review submission. Read-only verification of workspace `T8QUK5M5M` returned a valid live Slack token with only the original six scopes (no `im:write`); its stored installation timestamp remains January 31, 2023. Home/event delivery is not yet verified. Keep DM delivery disabled and do not change the public OAuth scope list before Marketplace approval.
- Canonical production checks passed after promotion: deep Postgres health, updated privacy policy, OAuth redirect, and unauthenticated cron rejection. Early error-level log scan returned no entries; this is not a live end-to-end Slack ritual test. External log forwarding/continuous monitoring was not added.
