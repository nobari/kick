KICK — SLACK MARKETPLACE LISTING IMAGES
October 2026

Upload these PNGs in this order:
01-check-ins.png        Async check-ins and blocker helpers
02-channel-todos.png    Assigned channel work with due dates
03-personal-todos.png   Private personal lists
04-polls.png            One changeable vote per person
05-reports.png          Date-filtered workflow reports

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
Run node scripts/marketplace-screenshots.mjs from the repository root.
Open each generated HTML in a browser at exactly 1600 x 1000 with device scale 1.
Capture the viewport as PNG. Verify that .blocks has no overflow, then inspect
every image. No database connection or Slack credentials are needed.

DESIGN
Benefit-led headlines; one feature per image; readable app views; Kick orange,
midnight navy and cool gray; the existing Kick mark and rounded display type.
No altered Slack logo, invented app controls, AI illustrations or testimonials.
Created with deterministic HTML/CSS and browser capture, not image generation.

Slack image requirements checked October 1, 2026:
https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/#images-and-screenshots
