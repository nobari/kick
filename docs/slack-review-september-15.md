# Slack review fixes — September 15, 2026

## Changes

- Dedicated Kick product identity in the landing-page heading and introduction.
- Detailed explanation of slash commands, Slack forms, channel-visible results, installation, pricing/account requirements, and hosting/storage providers.
- Direct privacy-policy links in desktop/mobile navigation, the installation area, the integration explanation, the privacy summary, and the footer.
- Expanded English privacy policy covering collection, technical/log data, purposes, storage and sharing, retention, uninstall behavior, and individual access/export/deletion requests.
- Retention disclosure now reflects the legacy code's lack of an automatic expiry schedule, rather than promising an unimplemented three-year limit. The operator should review this disclosure and existing provider settings; this deployment does not introduce a new deletion job.

The Next.js/React skills informed server-rendered, accessible pages without new client-side dependencies. The Vercel deployment skills guided an isolated website-only release: the uncommitted bot/cron feature work was not deployed.

## Deploy Result

- URL: https://kick.bozmoz.com
- Deployment: https://kick-oebbkj78x-nobari.vercel.app
- Target: production
- Status: READY, promoted successfully
- Commit: base `11ee048` plus the four website-file changes; no new Git commit was created
- Framework: Next.js 16.3.0
- Build duration: 41 seconds reported by Vercel

## Post-deploy verification

- Landing, privacy, support, and Slack health: HTTP 200.
- Desktop/mobile browser checks passed; no browser errors reported; 390px mobile viewport had no horizontal overflow.
- Direct navigation privacy link tested locally; live hero link resolves to the custom-domain policy.
- Five prerendered-page tests passed: `pnpm build` then `node --test tests/marketplace.test.mjs`.
- `pnpm lint` and `git diff --check` passed.
- Error scan: zero error entries returned for this deployment over the requested one-hour window.
- Drains: not audited or changed. Monitoring check is a point-in-time check, not a guarantee of continued health.

## Resubmit in Slack

Confirm the marketplace listing uses:

- Landing page: https://kick.bozmoz.com/
- Privacy policy: https://kick.bozmoz.com/privacy
- Support: https://kick.bozmoz.com/support

Do not use the old personal domain, GitHub repository, or a generic parent-domain homepage as the landing page.

Suggested reviewer reply:

> We have updated our dedicated Kick landing page at https://kick.bozmoz.com/. It explains the app’s standups, kudos, virtual coins, and teammate picks, with Slack screenshots, installation instructions, and details of the in-Slack workflow. The page links directly to our public English privacy policy at https://kick.bozmoz.com/privacy from its navigation, installation area, and footer. The policy explains data collection, use, storage, retention, and how individuals can request access, export, or deletion. Both pages are accessible without signing in.

No Slack dashboard fields were changed and no review submission was sent by this deployment. Slack decides whether the resubmission meets its requirements.

References: [Slack landing-page requirements](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/#your-landing-page), [Slack privacy-policy requirements](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/#your-privacy-policy-page).
