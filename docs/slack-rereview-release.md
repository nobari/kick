# Kick team-rituals release: Slack re-review packet

## Activation update — September 23, 2026

The owner confirmed that the production Slack update, including `im:write` and `app_home_opened`, was approved and published. The submission instructions below are retained as the historical review packet, not outstanding approval requirements.

- Set production `KICK_OAUTH_DM_SCOPE_ENABLED=true` and rebuilt the existing live source, without deploying local working-tree changes. Deployment `dpl_CXHoyYgHcNhNven3t2fdQXAncFQr` (`kick-4tv6qbdwj-nobari.vercel.app`) is Ready at `https://kick.bozmoz.com`; Next.js 16.3.0, approximately two minutes to Ready, source bundle based on `42cacb9` plus the September 17 uncommitted release changes.
- Verified that the public install redirect requests the original six scopes plus `im:write`, and that deep production Postgres health returns 200 with no missing environment variables. Seven targeted OAuth/capability tests passed.
- `KICK_RITUALS_DM_ENABLED` remains disabled. Next, the owner must reinstall through `https://kick.bozmoz.com/api/slack/install`. Verify the saved installation and live token grant before enabling private delivery. App Home event delivery and interactive/DM end-to-end tests remain to be verified; publication alone is not proof of those flows.
- Website availability copy remains unchanged for now; update it when private delivery is activated and tested. No new schedules or test messages were created during this activation step.

## Submission gate

Do not submit this packet until the checkboxes below are satisfied. Code tests and an illustrative website preview are not a substitute for a reviewer-installable staging app or a real Slack demonstration. The published installation flow must keep its six approved scopes until Slack approves the update.

- [ ] A separate, distributable Kick Review app is installed through its own OAuth flow and can be installed in a reviewer's workspace.
- [ ] Its deployment uses the same release code with its own Slack credentials, a separate database, a separate encryption key, and its own authenticated scheduler. Do not give staging access to production installation records.
- [ ] App Home, event delivery, setup, prompts, submissions, digest, fair rotation, blocker resolution, and private reminders have been tested in real Slack.
- [ ] A real video demonstrates the new workflows, including why `im:write` is needed. Provide a working video URL, not the website URL.
- [ ] Production landing, privacy, support, terms, installation, and installation-success pages are public and correct. Public pages and the OAuth redirect are verified; complete a real review-app OAuth round trip to verify the authenticated success receipt.
- [ ] Test notes contain the actual review-app install URL and video URL. Remove placeholders before submission.

Slack guidance: [reviewing updates to published apps](https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide/), [Marketplace requirements](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/), [manifest reference](https://docs.slack.dev/reference/app-manifest/).

## Create and connect the review app

An owner-only, Git-ignored worksheet is available at `.env.slack-review.local`. Fill it locally with the separate review app's identifiers and secrets; do not paste secrets into chat. A Slack channel link is not a staging app ID.

1. Create a separate Vercel project from this release and choose its stable HTTPS origin. Do not point the review app at the production receiver: different apps have different signing secrets.
2. Generate the importable manifest: `pnpm slack:review-manifest https://YOUR-REVIEW-ORIGIN`. Create an app **From a manifest** in Slack's app settings, paste the generated JSON, and choose your test workspace. The app uses `/tsync`, `/tpick`, `/tkudos`, and `/tcoins` to avoid collisions with the published commands.
3. Set `TEST=1`, the review app's `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, and a new `SLACK_STATE_SECRET` in the review project's production environment. Set `NEXT_PUBLIC_SITE_URL` to the review origin. Use a separate, empty Postgres database/branch with the checked-in schema, a new `KICK_DATA_KEY`, and `KICK_STORAGE_BACKEND=postgres`. The current rehearsal clone contains historical records and must not be used as a reviewer-facing environment.
4. On this separate review app only, set `KICK_OAUTH_DM_SCOPE_ENABLED=true` and `KICK_RITUALS_DM_ENABLED=true`. Connect its own scheduler and secret before setting `KICK_SCHEDULER_ENABLED=true`. The checked-in production Worker calls the production domain only; do not reuse its secret or claim it drives staging.
5. Deploy, verify Slack's event URL challenge, enable Home, confirm `app_home_opened`, and verify interactivity. No Socket Mode, workflow platform enrollment, message subscriptions, or user scopes are required.
6. Enable app distribution in Slack and install using `https://YOUR-REVIEW-ORIGIN/api/slack/install`, not merely the Slack settings reinstall button. Verify that the OAuth callback saved the review installation and that its token includes `im:write`.
7. Run the acceptance tests below. Make the review project's production URL publicly reachable; retain protection on preview deployments. Never send tokens or client secrets in the Slack review notes or this chat.

## Published-app settings to submit

| Field | Value |
| --- | --- |
| Name | Kick |
| Short description | Team check-ins, blockers, appreciation, and fair rotations in Slack. |
| Landing page | `https://kick.bozmoz.com/` — not the installation endpoint |
| Privacy policy | `https://kick.bozmoz.com/privacy` |
| Support | `https://kick.bozmoz.com/support` |
| Terms | `https://kick.bozmoz.com/terms` |
| Direct install | `https://kick.bozmoz.com/api/slack/install` |
| OAuth redirect | `https://kick.bozmoz.com/api/slack/oauth_redirect` |
| Slash commands and interactivity | `https://kick.bozmoz.com/api/slack/events` |
| Event request URL | Same events URL; subscribe only to `app_home_opened` |
| App Home | Enable Home tab; leave unused message-event subscriptions off |
| Video demo | Actual video recording URL, supplied after recording |

Keep `/sync`, `/pick`, `/kudos`, and `/coins` registered; setup, preferences, home, checkin, and rotate are subcommands, not new slash-command registrations. Preserve the official, unmodified Add to Slack artwork.

### Scope justification: new `im:write`

Kick uses `conversations.open` to open a one-to-one conversation for a missing check-in reminder or a follow-up to an assigned blocker helper. Messages are sent only for explicitly enabled channel workflows, subject to personal opt-out, quiet hours, snooze, leave, and channel membership. Existing `chat:write` sends the message. Kick does not request private-message history or subscribe to private-message events.

Existing scopes remain `channels:history`, `channels:read`, `chat:write`, `chat:write.public`, `commands`, and `users:read`. Do not add broad or unused permissions.

## Listing long description

Kick helps teams turn updates into follow-through without leaving Slack. Share an async standup, thank a teammate, give virtual recognition, or make a quick random pick with a slash command.

The team-rituals release adds opt-in channel schedules, daily digests, blocker tracking with assigned helpers, and least-recent team rotations. Choose a standup, weekly-wins, or retrospective template—or write your own questions. Preview your settings before confirming; every new channel starts paused.

Kick's personal Home tab brings an overview, updates, blockers, and team-level trends together. Channel membership controls access, and insights are aggregate—not individual productivity scores. Private reminders respect quiet hours, leave, snooze, and opt-out settings when the required Slack permission is granted.

Scheduled delivery is checked every 15 minutes. Channel owners choose 7-, 30-, or 90-day retention for new workflow records. Core command history and Slack messages have separate retention rules described in our privacy policy. No separate account or paid subscription is required. Kick is an independent third-party integration, not affiliated with or endorsed by Slack.

## Test Account Details — paste after staging verification

Kick does not require a separate account, paid subscription, or trial. Install the distributable Kick Review app into your own Slack test workspace using [REPLACE WITH VERIFIED REVIEW INSTALL URL]. Its commands are /tsync, /tpick, /tkudos, and /tcoins; the published app uses the same commands without the leading “t”. All features use Slack identity and workspace permissions. Please create a public test channel with at least two active human members and invite the review bot. No access to our workspace is required. Contact kick.bot.help@gmail.com if installation or testing is blocked.

## How to test your changes — paste after staging verification

This update bundles a redesigned App Home, guided setup with preview/edit/confirm, custom check-in templates, opt-in schedules, private reminders and preferences, daily digests, blocker/helper tracking, fair rotations, Friday appreciation roundups, and aggregate team insights. Storage is Postgres on Neon; the app runs on Vercel with an authenticated external scheduler. Existing core workflows remain available. The only additional bot scope requested is im:write, used to open reminder/helper conversations. The new event is app_home_opened. Demo: [REPLACE WITH REAL VIDEO URL].

1. Install from the review-app URL above and confirm that the success page displays clear next steps. Open Kick Review's Home tab.
2. In the public test channel, run /tsync setup. Select two human members, today's weekday, the correct IANA time zone, a check-in time at or before now, and a digest at least 90 minutes later. Choose a template and retention period. Preview, try Edit settings, then enable and confirm. Scheduler checks run every 15 minutes; this is not second-precise scheduling.
3. Wait for the channel prompt, then have one participant submit using Share update or /tsync checkin. Include a test blocker and the second participant as helper. Verify the confirmation and Home views. The second participant can remain unanswered for reminder testing.
4. After one hour from session creation, plus up to one scheduler interval, verify the unanswered participant receives one private reminder. Test Snooze and /tsync preferences, including reminder opt-out and quiet hours. Already submitted participants must not be reminded.
5. At digest time plus one interval, verify the summary, pending count, and blocker count. Browse full updates in Home. Repeated scheduler invocations must not create repeated successful prompt/digest jobs.
6. Use Blockers in Home to reassign or resolve the test blocker. An unresolved blocker can generate a weekday helper follow-up after 24 hours, subject to preferences and membership. Resolve it and verify future follow-ups stop. The video should show this delayed behavior if your review cannot span a day.
7. Run /tpick rotate twice, excluding a participant on one pick. Confirm least-recent selection and queued channel delivery. Compare with /tpick, which makes an immediate random selection.
8. Send /tkudos and /tcoins. Confirm they appear in Home for the enabled channel. Enable the Friday roundup and verify it after Friday's digest time. Do not present coins as money.
9. Verify a channel member who is not the owner/admin cannot edit settings, and a nonmember cannot view that channel's ritual records. Check that Team trends contain aggregate counts only.
10. Pause the channel through setup and confirm automatic prompts stop. Verify preferences and saved history remain available. Use the privacy page's email path to request access/export/deletion; no separate account is needed.

## Video shot list

Record actual Slack, using only test data: install → success page → Home empty state → setup and preview/edit → scheduled prompt → completed check-in → blocker assignment/resolution → digest → fair rotation → kudos/coins → personal preferences → real reminder and snooze → Home team trends → pause. Explain time gaps in captions rather than disguising accelerated fixtures as real-time production behavior. Show why the new scope is needed. Do not record tokens, app secrets, real team updates, or personal profile details.

## Publish after approval

Coordinate the Slack configuration publication with `KICK_OAUTH_DM_SCOPE_ENABLED=true` in production and a redeploy. Existing workspaces must reinstall through the production OAuth flow to grant the additional permission. Only then enable `KICK_RITUALS_DM_ENABLED=true`; delivery also checks each installation's recorded scopes. Verify the token grant, then update website availability wording. Scheduling remains explicitly opt-in per channel.

## Verified release status — September 17, 2026

- Production is `dpl_D6XtrQ9pa59KJYdJHZWxrm2Pz18V`, Ready on `https://kick.bozmoz.com`, Next.js 16.3.0 (46-second remote build). Source is the working-tree bundle based on `42cacb9`; this release's changes have not yet been committed or pushed.
- Cloudflare Free Worker `kick-ritual-scheduler`, version `6ecd5195-b668-42e0-ac35-82898862983d`, deployed with `*/15 * * * *`. No custom CPU override, public route, or paid upgrade. The Worker tick was manually verified against production; a naturally triggered cron invocation has not yet been observed.
- Production Postgres health passed, all required environment variables are present, unauthenticated cron returns 401, and authenticated cron returned zero configurations, zero sent, zero failed. No team was enrolled automatically. Public OAuth still requests only the original six approved scopes; both DM flags are false.
- 55 unit tests, lint, TypeScript, production builds, seven website checks, ten real-Postgres ritual checks, and four database/installation/core-handler checks passed. Desktop/mobile browser checks passed without reported browser errors. The early production error-log scan returned no entries; this is not continuous monitoring.
- With explicit permission, four labeled messages were delivered in channel `C8PBFSSC9`: prompt, digest, appreciation roundup, and rotation. [Authorized test thread](https://saamoj.slack.com/archives/C8PBFSSC9/p1789645824151399). This was a bot-only renderer/transport check using rolled-back rehearsal fixtures, not a human interaction, DM, or scheduler end-to-end test. Interactive controls were intentionally omitted from those fixture messages.
- Remaining submission gates: separate review app/deployment, real OAuth and interactive workflows, consented private reminders, actual scheduled delivery, and a real demonstration video. No Slack re-review has been submitted.
