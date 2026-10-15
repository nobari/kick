KICK — SLACK MARKETPLACE LISTING IMAGES
October 2026

Upload these PNGs in this order:
01-check-ins.png        Async check-ins and blocker helpers
02-channel-todos.png    Assigned channel work with due dates
03-personal-todos.png   Private personal lists
04-polls.png            One changeable vote per person
05-reports.png          Date-filtered workflow reports
06-workload.png         Self-declared capacity alongside open channel tasks

Each image is 1600 x 1000 pixels (8:5) and under 2 MB.
Use the PNGs, not the HTML source files, in Slack's listing image fields.
Keep the existing app icon; these are listing images, not app icons.

IMPORTANT PROVENANCE
These are illustrative Slack-context marketing layouts, NOT live screenshots
captured from the Slack client. Kick's form labels, content and controls are
rendered from its production Block Kit functions using synthetic sample data.
The surrounding client chrome is illustrative. Every image says
"Illustrative UI · sample data". No customer data or real member names are used.
Do not present these as evidence of a completed live acceptance test.
A real Slack demo/acceptance pass remains a separate review requirement.

REPRODUCTION
Install Chrome, then run pnpm slack:screenshots from the repository root.
The script captures at 1600 x 1000, checks content overflow and file size, and
refreshes the PNGs and ZIP in public/assets/slack-marketplace/2026-10.
Inspect every image visually. No database connection or Slack credentials
are needed. The browser uses a fresh profile, not your signed-in session.

DESIGN
Benefit-led headlines; one feature per image; readable app views; Kick orange,
midnight navy and cool gray; the existing Kick mark and rounded display type.
No altered Slack logo, invented app controls, AI illustrations or testimonials.
Created with deterministic HTML/CSS and browser capture, not image generation.

Updated for the combined release October 15, 2026. Entry paths use Kick Home
because new slash command registration/review remains separate. These images
do not assert provider OAuth roundtrips or live multi-user acceptance passed.

Slack image requirements checked October 15, 2026:
https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/#images-and-screenshots
