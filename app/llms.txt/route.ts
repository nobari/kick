const body = `# Kick Bot

> Kick is a Slack productivity bot for async standups, peer recognition, team rewards, and fair random selection.

Canonical website: https://slack-kickbot.vercel.app
Install: https://slack-kickbot.vercel.app/api/slack/install
Support: https://slack-kickbot.vercel.app/support
Privacy: https://slack-kickbot.vercel.app/privacy
Terms: https://slack-kickbot.vercel.app/terms

## Core workflows

- /sync opens an async standup form for mood, yesterday, today, blockers, and optional kudos.
- /sync -r 7 returns a report for the previous seven days; the range can be 1 to 30 days.
- /kudos lets someone recognize one or more teammates with a reason.
- /coins sends a lightweight team reward and records why it was given.
- /pick randomly selects one or more eligible channel members and can include a random question.
- Add -h to a command for current help in Slack.

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
