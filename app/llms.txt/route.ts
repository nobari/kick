const body = `# Kick Bot

> Kick is a Slack productivity bot for async standups, peer recognition, team rewards, and fair random selection.

Canonical website: https://kick.bozmoz.com
Install: https://kick.bozmoz.com/api/slack/install
Support: https://kick.bozmoz.com/support
Privacy: https://kick.bozmoz.com/privacy
Terms: https://kick.bozmoz.com/terms

## Core workflows

- /sync opens an async standup form for mood, yesterday, today, blockers, and optional kudos.
- /sync -r 7 returns a report for the previous seven days; the range can be 1 to 30 days.
- /kudos lets someone recognize one or more teammates with a reason.
- /coins sends a lightweight team reward and records why it was given.
- /pick randomly selects one or more eligible channel members and can include a random question.
- Add -h to a command for current help in Slack.

## Team-rituals release

- /sync setup configures a public-channel workflow with participants, weekdays, IANA time zone, template or custom questions, digest time, and 7/30/90-day workflow retention. It starts paused and requires preview and confirmation.
- /sync checkin submits an update during the configured check-in window; blockers can have an assigned helper and be resolved.
- /sync home refreshes the membership-aware App Home, which has overview, updates, blockers, and aggregate trends. The Slack Home tab and app_home_opened event must be configured.
- /sync preferences saves quiet hours, leave dates, snooze-related preferences, and reminder opt-out.
- /pick rotate queues a least-recent selection in an enabled channel ritual; it is not the same as random /pick.
- Optional digests and Friday recognition roundups are delivered by an external scheduler with 15-minute checks when activated. Delays can occur during outages or backlogs.
- Private reminders and helper follow-ups are pending Slack permission approval and reinstall consent. They are not yet available through the published installation flow.
- Getting started and feature availability: https://kick.bozmoz.com/get-started

## Account and pricing

Kick does not require a separate user account. Installation and identity are handled by Slack. Core workflows are free.

## Data

Kick stores the Slack workspace and authorization information needed to operate, plus submitted workflow records. It does not store team member email addresses. See the privacy policy for retention, export, and deletion details.
`;

export function GET() {
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
