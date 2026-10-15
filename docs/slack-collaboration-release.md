# Kick collaboration release — October 2026

## Combined submission — October 15: commands, Slack UI and all ten team-management features

This is ONE combined update, including the October 10 planning, coordination and organization-sync increment below. The earlier publication confirmation covers the prior release, not this expansion. Deployment does not register or publish slash commands in Slack.

### What is included

Compatibility correction to the original plan: use `/timeoff`, NOT `/leave`. Slack's built-in `/leave` exits a channel. Do not register it as a Kick command or use it when testing leave requests. See [Slack's built-in command reference](https://slack.com/intl/en-gb/help/articles/360057554553-Use-shortcuts-to-take-actions-in-Slack).

- Ten new commands: `/todo`, `/poll`, `/report`, `/plan`, `/decision`, `/handoff`, `/approve`, `/onboard`, `/oneonone`, `/timeoff`.
- Consistent help (`help`, `-h`, `--help`) for all fourteen commands, a Home command guide, private loading/error responses, channel workflow selection, explicit sharing and readable empty states. Existing four commands and their historical flags remain compatible. Legacy quick-post flags still post without a form.
- The prior ten features: workload/capacity, objectives/key results, decision log, cross-team handoffs, private approvals, onboarding/buddies, private one-on-ones, leave/coverage, opt-in escalations and organization-specific GitHub/Jira/Linear manual status sync.
- Form/UI improvements: plain-language labels and action buttons; native dates, time-zone-aware time pickers, weekday checkboxes, short radio choices, single-input focus, length hints, preserved drafts including cleared optional values, newer modal alerts and sortable/paginated Home task tables with actionable rows. New blocks fall back to ordinary sections/buttons if Slack rejects them. No AI, additional data export, file uploads or new scopes introduced.

### Slack settings to update (app A044BL326B1)

Listing image pack (refreshed October 15): [download six PNGs](https://kick.bozmoz.com/assets/slack-marketplace/2026-10/kick-slack-listing-images.zip). Upload in numbered order: check-ins, shared channel to-dos, private personal to-dos, polls, comprehensive reports, workload/capacity. Each is 1600 × 1000 and under 2 MB. These are **illustrative Slack-context layouts generated from current production Block Kit renderers with synthetic data**, not live Slack client captures. The images are labeled accordingly. They do not complete the real-demo/provider acceptance checklist below. Reproduce with `pnpm slack:screenshots` (Chrome required); source/provenance is in `output/slack-listing/october-2026/README.txt`.

1. Open the app’s **unpublished edit mode**. Keep all existing scopes, events, shortcuts, interactivity and OAuth URLs. Do not replace the whole manifest with a command fragment.
2. Open [the ready-to-copy command fragment](slack-command-config.json), or regenerate it with `pnpm slack:command-config`. Merge its `slash_commands` array into the existing manifest’s `features.slash_commands`, preserving unrelated configuration. Alternatively create the ten new commands below manually and update the descriptions/hints of the original four. All fourteen use `https://kick.bozmoz.com/api/slack/events`, with escaping disabled to preserve existing parsing. No `/t...` commands belong in production.
3. Check for command-name conflicts in your test workspace. Slack names are not namespaced; another app can own the same visible command. Kick Home provides alternative access. Do not silently rename the approved list—resolve collisions before review.
4. Save the draft and use Slack’s offered installation/update flow for the test workspace. Existing installations already have the `commands` scope, so this is not a new-scope consent request, but new command configuration must actually be installed/published to appear. A Vercel deploy alone is insufficient.
5. Set Landing Page to `https://kick.bozmoz.com/`, Privacy to `/privacy`, Support to `/support` and Terms to `/terms` on that domain. Direct install remains `/api/slack/install`; Slack redirect remains `/api/slack/oauth_redirect`. Provider callbacks belong in their provider consoles, not Slack OAuth settings.
6. Replace listing text with the copy below, add verified screenshots and a real demo-video URL, finish the acceptance checklist, run automated checks and submit this entire bundle once. Do not submit this document’s historical archived copy or placeholders.

| Command | Supported entry points | Default |
| --- | --- | --- |
| `/todo` | `mine`, `new`, `channel`, `help` | Private personal list |
| `/poll` | `create`, `results`, `help` | Channel polls |
| `/report` | `week`, `month`, `custom`, `help` | Editable trailing 7-day report form |
| `/plan` | `workload`, `capacity`, `goals`, `sync`, `help` | Planning hub |
| `/decision` | `new`, `list`, `help` | Decision log |
| `/handoff` | `new`, `incoming`, `list`, `help` | Accessible source/receiving handoffs |
| `/approve` | `request`, `pending`, `list`, `help` | Participant-only requests |
| `/onboard` | `new`, `active`, `list`, `help` | Onboarding records |
| `/oneonone` | `new`, `upcoming`, `list`, `help` | Your two-person conversations |
| `/timeoff` | `request`, `mine`, `coverage`, `help` | Requests you created |

`incoming` means the selected receiving workflow, still respecting acceptance visibility. `pending` means you are the designated approver and no decision has been made; expired decision deadlines can still appear but cannot be approved. `upcoming` means active and dated today or later in UTC. `month` means the last 30 days inclusive, not a calendar month. Filters apply before database pagination. `/timeoff` All records also shows requests where you are the approver.

### Listing short description

Standups, tasks, polls, reports and team coordination—right in Slack.

### Listing long description

Kick helps teams coordinate everyday work without leaving Slack. Share standups, track blockers, assign channel tasks, keep private personal to-dos, run polls, and preview comprehensive team reports before sharing.

Use native Slack forms and Home to plan workload, set objectives and key results, record decisions, agree on cross-team handoffs, request approvals, onboard teammates, prepare private one-on-ones, and arrange leave coverage. Scheduled check-ins, digests and escalation summaries are opt-in. Delivery checks run every 15 minutes; delivery may be delayed.

Ten new slash commands bring these tools closer: /todo, /poll, /report, /plan, /decision, /handoff, /approve, /onboard, /oneonone and /timeoff. Each offers help and focused forms. Existing /sync, /pick, /kudos and /coins remain available. Where a channel has multiple workflows, choose one before proceeding.

Workspace admins can optionally connect their organization’s GitHub, Jira or Linear account, choose a repository/project/team, import selected issues and confirm status updates in either direction. Only the admin who supplied the connection can operate that provider account. Sync is manual, not background; private records, comments and attachments do not sync.

Shared tools respect public-channel membership. Personal to-dos and one-on-ones have participant-only access; approval and leave details are limited to requester and approver. Approved coverage shares names, dates and proposed cover only. Polls and retrospectives are not anonymous. Retention and data requests are explained at https://kick.bozmoz.com/privacy. Kick is an independent integration, not affiliated with or endorsed by Slack.

### Test Account Details — combined release

Kick needs no separate account, paid subscription or trial. Install it in your own Slack test workspace, choose a public test channel with at least three consenting testers and invite Kick. Most tools work with a paused workflow. Optional GitHub, Jira and Linear sync requires your own provider account and a Slack administrator; no credentials to our workspace are needed or supplied. Contact kick.bot.help@gmail.com if installation is blocked. Use the supplied actual demo and acceptance instructions for the complete combined release.

### Developer Notes / How to test changes — combined release

This update bundles ten new slash commands, a consistent command guide and refreshed native Slack forms with the earlier ten-feature team-management expansion. It includes capacity, objectives/key results, decisions, handoffs, approvals, onboarding, private one-on-ones, leave/coverage, opt-in escalations and organization-specific manual issue status sync. Existing polls, personal/channel tasks, comprehensive reports and original commands remain supported. No new OAuth scopes or event subscriptions are requested. Website examples and privacy disclosures cover the entire bundle. Provider sync requires the reviewer’s own explicit consent; no provider secrets are included.

1. Install the updated command configuration in a test workspace. Run `/sync setup` and save a public-channel workflow as Paused; add a second paused workflow in the same channel to test selection.
2. Run each new command with no arguments, with `help`, and with an invalid argument. Help/errors must remain private, preserve no records and show usable next steps. Test all supported entry points in the command table. Check the original four commands and their help/report flags for regressions.
3. In a DM, `/todo mine` and `/todo new` must work without a workflow. Create, edit, complete and delete a personal task; another tester cannot access it. `/todo channel` requires a public channel and opens shared tasks. Confirm the assignee can mark a shared task done.
4. Use `/poll create`, cancel once, then confirm creation. Vote/change vote from two testers and close via the existing confirmation form. Creation/closing explicitly queues channel notices. `/poll results` opens the poll selector, not an unscoped cross-workspace report.
5. `/report week` and `/report month` prefill inclusive UTC ranges of 7 and 30 days; `/report custom` lets you edit dates. Build and compare a preview, then cancel without sending. Share once in the dedicated test channel. No private tasks, approvals, leave details or one-on-ones may appear.
6. Use `/plan workload`, `/plan capacity`, `/plan goals` and `/decision new`. Complete the detailed planning acceptance checks below. `/plan sync` opens the existing admin-only organization integration area.
7. Use `/approve request` with tester B, then `/approve pending` as B and C. Only B should see it in that inbox. `/handoff incoming` must show only eligible receiving-workflow records, including the existing acceptance privacy rules. Exercise onboarding, upcoming meetings, leave requests and coverage using the detailed checks below.
8. Verify the form controls, weekday checkboxes and radio choices on desktop and mobile. Submit invalid dates, correct them and confirm previously entered values—including cleared optional dates—are retained. Check modal errors, success states, keyboard focus and Home task-table navigation. Unsupported newer blocks have a section/button fallback; verify with the automated fallback tests and actual clients where available.
9. Finish the October 10 multi-user privacy and provider round-trip checklist below, including revocation, disconnect and stale changes. Test opt-in escalation delivery only in a dedicated test workflow; never enable the existing team workflow solely for review.
10. Attach actual screenshots and a real video of the registered commands, forms and provider flow. Use synthetic team data and hide credentials. If the production edit-mode commands cannot be installed for reviewers, provide a separate review app on an isolated deployment/database using `pnpm slack:review-manifest https://YOUR-REVIEW-ORIGIN`; it generates all fourteen prefixed commands. A channel link or homepage is not a review-app installation or demo-video URL.

### Release gates — do not mark unperformed checks complete

- [ ] New command configuration saved and installed in a test Slack workspace.
- [ ] Human desktop/mobile walkthrough, multiple testers, command collisions and denial cases checked.
- [ ] Live GitHub/Jira/Linear consent, import, push/pull, conflict and disconnect recorded; Jira distribution verified for external reviewer accounts.
- [ ] Actual screenshots/demo supplied, no placeholders or secrets in submission.
- [ ] Submit the combined app update through Slack’s review flow, then confirm publication and remove the website’s new-command rollout notice.

Engineering test results do not certify the human acceptance gates above. No new schedules are enabled by deployment. No schema migration is required for this command increment.

Engineering verification on October 15: 76 unit/UI/manifest tests, 13 generated-site checks, 8 isolated-Postgres coordination checks and 4 core database/legacy-handler checks passed. Lint and production build passed. Provider adapters use fixtures; this is not a recorded live provider round trip. The native alert/table fallback is covered automatically; actual modal/mobile acceptance remains on the checklist.

References: [Slash commands](https://docs.slack.dev/interactivity/implementing-slash-commands/), [Marketplace review](https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide/), [native alert blocks](https://docs.slack.dev/reference/block-kit/blocks/alert-block/), [data tables](https://docs.slack.dev/reference/block-kit/blocks/data-table-block/).

## Included October 10 increment: team-management expansion

The ten-feature expansion is implemented. Do not submit the combined release until the human Slack walkthrough and real provider-consent/status round trips below are recorded. Automated tests use isolated Postgres and provider fixtures; they are not evidence of production provider consent.

### Coordination and organization sync increment (October 10)

- Cross-team handoffs: explicit, safe-to-share summary; receiving workflow and teammate; acceptance before receiving-channel disclosure; completion/decline/cancel. Both sender and recipient must belong to both public channels. This is a handoff tracker, not an automatic dependency graph.
- Approvals: one designated approver per immutable request; private details and decision note; deadline, decline/cancel and self-approval protection. Cancel and recreate to change details. No multi-stage approval chains or automatic reminders.
- Onboarding: newcomer, buddy, assigned/dated checklist steps; completion requires no open steps. Channel-visible.
- One-on-ones: two participants, encrypted-at-rest title and shared agenda/follow-ups, assigned items and completion. Not end-to-end encrypted or a private personal draft; both participants see each item. No admin override through the app.
- Leave: requester/approver-only details; proposed cover teammate; approved names/dates/cover only in Team coverage. Coverage is not an accepted assignment. Set reminder leave preferences separately.
- Escalations: explicitly enabled by workflow owner/admin, 1–30-day threshold, weekday channel counts after digest time, delivery-time rechecks, daily idempotency and disable control. No DM or automatic reassignment. Requires an enabled workflow.
- Organization-specific GitHub/Jira/Linear sync: Slack admin consent, own provider accounts, resource/container selection, explicit issue import, manual confirmed two-way **status** updates, stale-preview checks, conflict notice, audit and disconnect. Initial import copies title/status; comments, attachments, private records and later title changes do not sync. No background sync, issue creation or remote deletion. Each provider supports one connection per Slack workspace and one mapping per workflow; multiple workflows may use different containers. Connections expire after 90 days.

### Remaining acceptance checks before resubmission

Provider account access is restricted to the Slack admin who supplied that connection’s consent. Other workspace admins can disconnect it but cannot operate the connecting person’s provider account. Test this distinction with a second Slack admin as well as a regular member.

1. In a workspace you control, create a paused public-channel workflow with at least three testers and 30-day retention. Walk through all three planning features described below.
2. Request an approval from tester B. Check that tester C and a nonparticipant admin cannot read it. Have B approve, then cancel as requester. Try self-approval and a stale submission.
3. Create onboarding for B with C as buddy, add a step, mark it done, and finish. Verify an open step prevents completion.
4. Create a one-on-one between B and C, add an agenda item and follow-up, and verify A cannot view either, including as workflow owner. Complete items and finish the meeting.
5. Request future leave from B, proposing C as cover. Verify Team coverage is empty before approval, then shows only names/dates/proposed cover. Cancel and verify coverage disappears. Avoid medical details.
6. Configure a second public-channel workflow. Create a handoff with B as recipient; verify only B can read it from the receiving side until B accepts from that workflow. Complete the handoff.
7. In a dedicated test workflow only, enable scheduling and escalation summaries with a one-day threshold. Add an older task/blocker, observe a single eligible channel summary after digest time, then resolve the work and disable the rule/workflow. Verify no further summary is sent. Do not enable the existing team workflow just for review.
8. For each provider, a Slack admin uses Team planning → Issue sync → Connect. Complete the real consent flow, map a test repository/project/team and import a disposable issue after previewing its title. Mark its Kick action done; Compare → Use Kick status → choose a matching external state → Confirm. Change the provider status, then Compare → Use provider status. Test a stale preview and a both-sides conflict. Disconnect and verify mappings/links disappear while the imported task and remote issue remain. Revoke provider-side consent when finished.
9. GitHub requires Kick Team Sync installed for the chosen repositories. Jira distribution must allow the reviewer's account before external reviewers can connect; do not claim cross-organization availability until it has been enabled and tested. Linear needs its public OAuth configuration. No provider client secrets belong in the review packet.
10. Record a real video showing these paths, permission denials, the public landing page and privacy link. A homepage URL is not a demo-video URL. Update screenshots only with verified interface behavior and synthetic data.

### Slack submission settings and draft notes

No new Slack scopes, slash commands, event subscriptions or interactivity URLs are required for this increment. Keep `app_home_opened`, the Home tab and current approved permissions. No reinstall is needed merely for these Home tools. Reopen Home or run `/sync home`.

- Landing page: `https://kick.bozmoz.com/` — not the install endpoint.
- Privacy: `https://kick.bozmoz.com/privacy`; support: `https://kick.bozmoz.com/support`; terms: `https://kick.bozmoz.com/terms`.
- Direct install: `https://kick.bozmoz.com/api/slack/install`; Slack OAuth redirect: `https://kick.bozmoz.com/api/slack/oauth_redirect`.
- Provider callbacks are separate: `/api/integrations/github/callback`, `/api/integrations/jira/callback`, `/api/integrations/linear/callback` on the same canonical domain. Do not put them in Slack's OAuth Redirect URLs.

Test account details draft (use after acceptance checks):

> Kick needs no separate Kick account, paid subscription or trial. Install it in your own Slack test workspace and use a public test channel with three members. Most tools work with a paused workflow. Optional issue sync requires your own GitHub, Jira or Linear account and its permissions, plus a Slack workspace administrator. We do not provide credentials to our workspace. Follow the attached test instructions and demo for each optional provider connection.

Developer notes draft:

> This update adds workload/capacity, objectives and key results, decision records, explicit cross-team handoffs, private single-approver requests, onboarding checklists and buddies, participant-only one-on-one agendas, leave requests and limited team coverage, opt-in channel escalations, and organization-specific issue-tracker connections. Issue imports copy title/status after confirmation; subsequent status sync is manual and confirmed in either direction. No remote deletion, background issue sync or private-record export occurs. New Slack Home forms reuse existing approved permissions. The website, getting-started guide and privacy policy describe visibility, consent, retention and limits. See the attached verified walkthrough and actual demo-video URL.

### Planning increment (October 10)

- Workload and capacity: current open channel to-dos due by a selected week's end, including unfinished earlier work; self-declared weekly task limits, with unknown distinct from zero. No productivity scores, hour estimates, personal-task disclosure, or automatic assignment restrictions.
- Objectives and measurable key results: owners, target dates, baseline/current/target/unit, decreasing targets, bounded display progress, edit concurrency checks, and close/reopen controls.
- Decision log: proposal/decision, rationale, responsible owner, review date, and Proposed/Accepted/Superseded status. Dates are informational; no automatic reminder is sent.
- A dedicated Team planning area with native Slack controls, paginated lists, sharing/retention notices and clear empty states. Reports add aggregate decisions/objectives/key-result counts without publishing individual capacity or metric values.
- Website examples, getting-started guide and privacy disclosures match these capabilities.

These tools do not add scopes, slash commands, subscriptions or callbacks in Slack settings. They reuse the published interactivity endpoint and App Home. No reinstall is required for this increment; reopen Home or run `/sync home`, select a workflow, then **Open team workspace → Team planning**.

### Reviewer test instructions for the planning increment

Use a workspace you control. Kick needs no separate account or paid subscription. Create a paused public-channel workflow with two members and 30-day retention using `/sync setup`; saving planning records does not enable scheduling or send messages.

1. Create two channel to-dos assigned to yourself, one overdue and one due this week. Open Team planning → View workload. Choose this week and Set my capacity to 1. Verify two open tasks, one overdue, and one over the chosen limit. A second member without a limit should show capacity not set, not zero. Only the individual can set their limit.
2. Create an objective with dates inside the next 30 days. Add a key result with baseline 10, current 6, target 2, unit days. Verify 50% progress. Update the current value, close the objective and verify result edits are refused until the objective is reopened.
3. Create a decision with title, rationale, owner, and a review date within retention. Move it from Proposed to Accepted. Verify a channel member who is neither creator nor responsible owner can read, but not edit, the record.
4. Build a comprehensive report for today. Verify aggregate decision/objective/result counts appear; capacity limits, metric values and personal to-dos do not. Close without sharing to send nothing.
5. Try editing the same record from two open forms. Save one, then submit the stale one with a different operation. Verify Kick asks you to reopen rather than overwriting the first edit.

Database and Block Kit tests are automated. A human Slack modal walkthrough is still required before the combined release's final review packet is declared complete. Keep an actual video demo URL distinct from the landing-page URL.

### Review readiness

All ten have implementation paths, but provider consent and human end-to-end acceptance remain distinct gates. Do not mark unperformed acceptance checks as passed or reuse the old publication confirmation for this new expansion.

## Publication status

The app owner confirmed Slack approval and publication on October 9, 2026. The submission material below is retained as a historical record, not an outstanding resubmission checklist. Publication does not certify that every engineering or human acceptance test below was performed.

This release adds **no OAuth scopes or event subscriptions**. `im:write` and `app_home_opened` were published in an earlier release. Existing installations with the seven approved scopes do not need to reinstall for this release.

Post-publication: reopen Kick Home or run `/sync home`; select or create a workflow for shared tools. Personal to-dos need no workflow. Team schedules remain explicitly opt-in. Do not enable previously disabled private reminders or create team schedules merely because the release was published.

## Archived publishing packet

## Included in this release

1. Assigned actions with due dates and Open/Done status, including conversion from updates, blockers and retrospective topics.
2. Scheduled check-in edits before the digest closes; labeled, separately delivered late corrections preserving the original.
3. Three message shortcuts with a review/confirmation form: Track action, Report blocker, Give kudos.
4. Up to ten independently named workflows in a public channel. Existing slash subcommands keep targeting the default workflow.
5. Sprint goals and dates, linked actions, updates from the period, and a factual closing recap.
6. Attributed retrospectives with topics, grouping, one vote per person per topic, and conversion to actions.
7. Planning poker with hidden estimates, abstention, facilitator reveal, new rounds, and a final decision.
8. Search of the selected workflow's retained Kick updates, actions, blockers and recognition, with text/person/date/status filters. No Slack archive search.
9. Calendar skips and one-date time overrides, including non-working days, before a session opens.
10. Owner/admin operations view with installation connectivity, delivery states, safe retry eligibility, and a configuration/operations audit.
11. Channel polls: 2–10 choices, one changeable vote per member, live counts, creator/workflow-owner closing, and queued invitations and final results. Votes store Slack IDs and are not anonymous.
12. Personal and channel to-dos: private personal lists directly in Home (no workflow setup required), with due dates, edit, complete/reopen and delete. Shared channel to-dos build on assigned actions in item 1; lists belong to workflows, are visible to channel members and editable by creator, assignee or workflow owner.
13. Comprehensive, date-filtered reports combining retained check-ins, blockers, shared to-dos, sprints, recognition, retrospectives, planning sessions and polls. Preview before explicitly sharing. Personal tasks and hidden estimates are never included.

Open Kick → Home → choose a workflow → **Open team workspace**. Workflow owners/admins manage settings, calendars, sprints and delivery retries. Retrospective/poker facilitators manage their sessions. Every data entry point rechecks workspace and channel membership. New workflows start paused; existing schedules are not automatically changed.

## Slack settings to change

Open the existing app **A044BL326B1** in [Slack app settings](https://api.slack.com/apps/A044BL326B1). Work in its unpublished changes/edit mode.

Under **Interactivity & Shortcuts**, keep interactivity enabled at `https://kick.bozmoz.com/api/slack/events`. Add these three **On messages** shortcuts (not global shortcuts):

| Name | Callback ID | Description |
| --- | --- | --- |
| Track action | `kick_track_action` | Review a message and save an assigned action with a due date |
| Report blocker | `kick_report_blocker` | Review a message and record a blocker with a helper |
| Give kudos | `kick_give_kudos` | Review a message and thank a teammate in the channel |

Keep the existing four slash commands `/sync`, `/pick`, `/kudos`, `/coins`. `workflows`, `home`, `setup`, `checkin` and `preferences` are `/sync` subcommands, not new registrations. Home buttons provide the other tools.

Keep Home enabled and the existing `app_home_opened` bot event. No message subscriptions, user scopes, Socket Mode, next-generation platform enrollment, `search:read`, or extra history permissions are needed.

Existing bot scopes remain: `channels:history`, `channels:read`, `chat:write`, `chat:write.public`, `commands`, `users:read`, `im:write`. Message shortcuts use the existing `commands` scope. Do not request new scopes for this release.

## Listing fields

| Field | Value |
| --- | --- |
| App name | Kick |
| Short description | Standups, polls, personal and channel to-dos, reports, and team planning in Slack. |
| Landing page | `https://kick.bozmoz.com/` **not** `/api/slack/install` |
| Privacy | `https://kick.bozmoz.com/privacy` |
| Support | `https://kick.bozmoz.com/support` |
| Terms | `https://kick.bozmoz.com/terms` |
| Direct install | `https://kick.bozmoz.com/api/slack/install` |
| OAuth redirect | `https://kick.bozmoz.com/api/slack/oauth_redirect` |
| Commands/interactivity/events | `https://kick.bozmoz.com/api/slack/events` |
| Video demo | A real, accessible video URL showing these changes; never the landing-page URL |

### Long description — copy-ready

Kick helps teams check in, follow through, and plan together inside Slack. Share async standups, track blockers, recognize teammates, and choose people fairly without a separate account or dashboard.

Create named workflows with their own participants, questions, schedules, and retention. Review settings before enabling; new workflows start paused. Check-ins become channel digests, and authors can edit before closing or share a labeled late correction afterward. Calendar exceptions let teams skip a holiday or change one date's times.

Turn updates and blockers into assigned actions with due dates. Set sprint goals, link actions, and close a sprint with a factual recap. Run attributed retrospectives: collect topics, group related ideas, vote, and turn the discussion into actions. Planning poker keeps estimates hidden until reveal and supports abstention, another round, and an agreed decision.

Search retained Kick history by workflow, words, person, date, and status. Workflow owners and workspace admins can inspect delivery failures, request eligible retries, and review an operations audit. Message shortcuts offer a confirmation step before saving an action or blocker or sending thanks.

Ask the channel a question with a poll: offer 2–10 choices, let each member vote or change their choice, and close voting to share results. Keep personal to-dos private in Kick, separate from shared channel to-dos with assignees and due dates. Build a comprehensive report for up to 90 UTC days, preview the combined totals, then optionally share them. Reports count retained records created in range with their current status—not historical snapshots—and exclude personal tasks, legacy command history, coin balances and hidden estimates. Poll votes store Slack IDs and are not anonymous. Personal tasks expire 30 days after creation and can also be deleted by their owner; editing does not extend retention. Personal privacy is enforced in the app, not end-to-end encryption.

Kick respects channel membership. Retrospectives are not anonymous, and team insights are not individual productivity ratings. Workflow records use 7-, 30-, or 90-day retention; core command history and Slack messages have separate rules explained in the privacy policy. Scheduled deliveries and queued notices are checked every 15 minutes and may be delayed. Private reminders require installation permission and service activation. Core workflows are free. Kick is an independent third-party integration, not affiliated with or endorsed by Slack.

## Test Account Details — copy-ready after checking the install path

Kick does not require a separate account, paid subscription, external service login, or trial. Install it into your own Slack test workspace using https://kick.bozmoz.com/api/slack/install. All features use Slack identity and workspace permissions. Create a public test channel with at least two active human members and invite Kick. Open Kick's Home tab to configure workflows and use the team workspace tools. No access to our Slack workspace is needed. If unpublished shortcuts cannot be installed from the production app during review, please use the separate review-app installation URL supplied with the submission, or the complete demo linked below. Contact kick.bot.help@gmail.com if installation or testing is blocked.

**Before pasting:** provide a real separate review-app URL or complete demo for the unpublished shortcuts. Do not leave reviewers with an inaccessible unpublished feature. A link to a channel in our workspace is not a review-app install link.

## How to test your changes — copy-ready after completing the checklist

This release adds assigned channel to-dos, private personal to-dos, polls and results, comprehensive reports, editable scheduled check-ins and late corrections, three confirmation-based message shortcuts, multiple workflows per channel, sprint goals and recaps, attributed retrospectives and votes, planning poker, retained-history search, calendar exceptions, and owner/admin operations with delivery retry and audit. No additional OAuth scopes or event subscriptions are requested. The existing four slash commands remain available. The landing page includes concrete examples for every feature; the guide and privacy policy explain usage, data and retention. Demo: [INSERT REAL VIDEO URL]. Review installation (if used): [INSERT VERIFIED REVIEW INSTALL URL].

1. Install into your own test workspace and confirm that the success page provides next steps. Invite Kick to a public channel with two human members. Run `/sync setup`; choose a distinct workflow name, both members, today's weekday, your IANA time zone, an opening time at/before now and a digest at least 60 minutes later. Preview, enable and confirm.
2. Open Kick Home and use Add workflow to create a second, paused workflow in the same channel. Switch between the two and verify that questions, participants and records stay separate. All tools below are under Open team workspace.
3. Submit a scheduled check-in. Read it in Home and choose Edit / correct before closing; verify the edited answer. After digest closing, submit a correction; the original answer is preserved, the correction is labeled, and a correction notice is queued. Delivery checks run every 15 minutes, not at an exact second.
4. Create an action with an assignee and due date, including one from an update or blocker. Confirm it appears in the assignee's Home. Have the assignee mark it Done. A different, unrelated member cannot edit it.
5. Create a sprint with a goal and dates, link an action, inspect updates from its period, and finish it. Verify the queued recap reports actual retained update and completion counts rather than inferred productivity.
6. Create a retrospective. Have both members add attributed topics. Group two topics under a shared label, open voting, vote once per topic, and close it. Convert a topic into an action; repeating that conversion must not create another action. This is not anonymous feedback.
7. Create a planning-poker session with both members. Submit a number and an abstention. Confirm other people's values are hidden until the facilitator reveals them. Start another round, vote again, reveal, and record a final decision. Use Refresh to see another participant's changes.
8. Search for a saved action or update, then filter by person, date and status. Change workflows and verify records do not cross over. Search is limited to retained Kick records, not Slack message history.
9. As owner/admin, skip a future check-in date or override its times in Calendar. Confirm a session that already opened cannot be changed. Dates must be inside the retention window. Other channel members cannot change calendar settings.
10. Open Operations as owner/admin. Verify installation connectivity, scheduler configuration, job states and audit entries. A Retry button appears only for failed deliveries and rechecks eligibility on submission; already-sent, leased, expired or paused-workflow jobs cannot be retried. If no deliveries have failed, an empty failure list is expected—do not manufacture an outage in production.
11. With the submitted message shortcuts installed/configured, choose Track action, Report blocker or Give kudos from a public-channel message's More actions menu. Cancel once and verify no record is created; then review and confirm. Actions/blockers are stored in Kick; kudos also queues a channel thank-you. No surrounding messages or attachments are copied.
12. Confirm a nonmember cannot open the channel's saved records. Review privacy/support links. Test the original `/sync`, `/kudos`, `/coins`, `/pick`, and reporting commands for regressions.

13. Before uninstalling, open My personal to-dos in Home. Create a task with a due date, edit it, mark it Done, reopen it and delete it. Confirm another member has a separate list and cannot read/edit the first member's tasks, even if they own the shared workflow. Personal tasks need no workflow setup and expire after 30 days. In Team workspace → Channel to-dos, create an assigned task and confirm channel members can see it and the assignee can complete it.
14. Under Polls, create “Which day for the demo?” with Tuesday and Thursday. Wait for the explicitly queued invitation (15-minute delivery checks). Have two members vote, refresh, then change one vote and confirm the total does not increase. Only the creator/workflow owner can close it; closing queues results and prevents further votes. Explain that counts are shared but votes are stored with Slack IDs, not anonymously.
15. Build a Comprehensive report covering the test dates. Compare its counts with records created in this workflow: check-ins, blockers, shared tasks, sprints, recognition, retrospectives, planning sessions and polls. Change dates or workflow and verify totals change. Personal task text/counts and hidden estimates must never appear. Closing the preview sends nothing; Share report queues a current aggregate summary. Counts are of retained records created in the UTC range with current status, not past-state snapshots. Legacy command history and coin balances are excluded.

16. Uninstall from the test workspace; explain that uninstall revokes access but data deletion is requested separately through support.

Do not register `/poll`, `/todo` or `/report`: these are not implemented slash commands. Use the Home/team-workspace buttons.

For a separate Kick Review app, substitute `/tsync`, `/tpick`, `/tkudos`, `/tcoins` for the production command names.

## Historical review/demo checklist — not an outstanding publication gate

- [ ] Exercise the actual interactive flows in Slack with two consenting test participants, including callbacks and permission-denied cases.
- [ ] Demonstrate private personal lists versus shared channel to-dos, changed poll votes and closing, and report preview/sharing without personal-task disclosure. Include these in the real demo.
- [ ] Test installation/onboarding/uninstallation in a non-development workspace.
- [ ] Show actual shortcut invocation on a separate review app, or include a complete real demo of the unpublished functionality, following Slack's update-review process.
- [ ] Provide a real video URL. Show actual Slack—not the website's illustrative tour or synthetic test fixtures. Explain scheduler time gaps honestly. Use dummy content, and do not show credentials or private team data.
- [ ] Replace/remove all bracketed placeholders in the text above before submission.
- [ ] Confirm the seven scopes are unchanged and no `/t...` test commands are being submitted on the production app.
- [x] Slack approval and publication confirmed by the app owner on October 9, 2026. A Vercel deployment does not publish Slack shortcut configuration.

There is no new-scope reinstall requirement from these thirteen features. Existing installations missing an earlier approved scope may still need reauthorization; keep private reminders gated until their grant is verified. This release does not enable previously disabled reminders or create team schedules automatically.

## Separate review app, if needed

Generate the importable manifest with `pnpm slack:review-manifest https://YOUR-DEDICATED-REVIEW-ORIGIN`. It includes the three message shortcuts and prefixed test commands. Deploy the same source using separate Slack app credentials, `TEST=1`, its own state/encryption secrets, a **separate empty database**, and an independently authenticated scheduler if reviewing scheduled behavior. The private migration-test branch is a production clone and must never be connected to a distributable staging app. The September packet has the detailed secure setup instructions; its old scope-approval gate is historical, not a new request.

## Engineering verification and operations

- Versioned additive migrations preserve existing default workflow IDs and core command history; the prior channel uniqueness becomes `(workspace, channel, workflow_key)`.
- Tests cover real Postgres transactions, concurrent duplicate submissions, workspace isolation, live-membership checks at the service boundary, edit versions, late corrections, retro vote uniqueness, hidden poker values, calendar/DST behavior, search filters, safe retries and retention cascades.
- Slack UI tests validate rendered modal structures and limits. These tests **do not replace a real human Slack acceptance pass**.
- Polls, ballots and private to-dos use three additional normalized Postgres tables. Reports use SQL aggregation, not capped list counts. Personal tasks have no channel/workflow foreign key and cannot enter shared search/report sources. Tests exercise concurrent voting, unique ballots, close permissions, personal-task ownership, dates, report sharing, and independent retention. Database suites run serially because their simulated future cleanup intentionally acts on all expired rows in the isolated branch.
- Roll back application code by restoring the prior Vercel deployment if needed. Do not drop new tables to roll back; that would delete newly created records. Leave additive schema in place while investigating.
- The private Neon rehearsal branch expires October 8, 2026; its credentials are in ignored `.env.collaboration.local`, never in Git or review notes.

Sources: [Slack's review guide](https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide/), [implementing message shortcuts](https://docs.slack.dev/interactivity/implementing-shortcuts/).
