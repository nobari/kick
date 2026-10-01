# Kick collaboration release — October 2026

This is the current publishing packet. The September packet describes an earlier release: `im:write` and `app_home_opened` are already published. This release adds **no OAuth scopes or event subscriptions**.

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

## Review/demo gate — still requires human Slack interaction

- [ ] Exercise the actual interactive flows in Slack with two consenting test participants, including callbacks and permission-denied cases.
- [ ] Demonstrate private personal lists versus shared channel to-dos, changed poll votes and closing, and report preview/sharing without personal-task disclosure. Include these in the real demo.
- [ ] Test installation/onboarding/uninstallation in a non-development workspace.
- [ ] Show actual shortcut invocation on a separate review app, or include a complete real demo of the unpublished functionality, following Slack's update-review process.
- [ ] Provide a real video URL. Show actual Slack—not the website's illustrative tour or synthetic test fixtures. Explain scheduler time gaps honestly. Use dummy content, and do not show credentials or private team data.
- [ ] Replace/remove all bracketed placeholders in the text above before submission.
- [ ] Confirm the seven scopes are unchanged and no `/t...` test commands are being submitted on the production app.
- [ ] Submit the unpublished changes for review; **after approval**, publish the changes in Slack. A Vercel deployment does not publish Slack shortcut configuration.

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
