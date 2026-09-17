# Marketplace website and onboarding release — September 16, 2026

Production: https://kick.bozmoz.com

- Deployment: `dpl_7wbEgyorUDrhZLpN9BWfBxJ3XvBc`, READY, production; promoted after staged checks.
- Deployment URL: https://kick-ja22bebvw-nobari.vercel.app
- Base: git `11ee048` plus isolated website/onboarding changes; no new commit created.
- Framework: Next.js 16.3.0; pnpm; remote build 51 seconds.
- Release directory: `/tmp/kick-onboarding-5PynCe`.

## Changes

Removed personal attribution from visible pages, author/creator metadata, and JSON-LD. Replaced the example member name with “Team member.” Checked the four workflow images used by the landing page.

Added public `/get-started`, signed-cookie `/installed` confirmation, and `/install-error` retry guidance. OAuth success redirects only after the Slack SDK saves the installation. Confirmation contains no Slack identity or credentials and expires after ten minutes. Missing or forged receipts do not claim success. Disclosed installation cookies in the policy.

Preserved existing dedicated landing content, direct privacy links, and expanded policy. Removed installation-token logging from the deployed OAuth store. Did not ship pending ritual features, cron routes, additional scopes, or dependency changes.

## Verification

- `pnpm lint` and `pnpm build` passed.
- Twelve unit/rendered-page tests passed.
- Local HTTP tests passed for valid, missing, and forged receipts, including no-store headers. These use a synthetic test secret, not a real Slack authorization.
- Mobile guide/result and desktop landing visually inspected; no browser errors reported.
- Staged deployment public pages and metadata passed personal-name scans.
- Actual end-to-end Slack authorization and command execution still require a workspace-owner test. Log drains and exact provider/support retention settings were not audited in this release.

## Slack resubmission

1. Landing page: https://kick.bozmoz.com/
2. Privacy policy: https://kick.bozmoz.com/privacy
3. Support: https://kick.bozmoz.com/support
4. Keep OAuth redirect URL https://kick.bozmoz.com/api/slack/oauth_redirect — do not replace it with `/installed`.
5. Install using the landing page button; approve in Slack and confirm arrival at `/installed` with “Kick is installed.” Test `/sync` in a public test channel and `/sync -r 7`.
6. Resubmit with the above URLs and explain the public guide, post-install confirmation, and direct privacy links. Slack dashboard fields and submission were not changed by this release.

The changes address the cited landing-page requirements, not a guarantee of Marketplace approval or a legal compliance certification.
