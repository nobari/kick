import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Run after pnpm build. Inspect prerendered HTML, not just component source.
const landing = readFileSync('.next/server/app/index.html', 'utf8').replace(/<!--.*?-->/g, '');
const privacy = readFileSync('.next/server/app/privacy.html', 'utf8');
const guide = readFileSync('.next/server/app/get-started.html', 'utf8');

test('all generated public pages and metadata omit personal-name attribution', () => {
  for (const file of readdirSync('.next/server/app', { recursive: true }).filter(file => file.endsWith('.html'))) {
    assert.doesNotMatch(readFileSync(`.next/server/app/${file}`, 'utf8'), /sadegh|nobari|\bAya\b/i, file);
  }
});

test('landing page explicitly identifies Kick and its Slack integration', () => {
  assert.match(landing, /<h1[^>]*>Good teamwork\.<br\/><span>Less chasing\./);
  assert.ok(landing.includes('together in Slack'));
  for (const command of ['/sync', '/kudos', '/coins', '/pick']) assert.ok(landing.includes(command));
  assert.ok(landing.includes('Neon'));
});
test('release tour offers six examples and documents the published commands', () => {
  assert.equal((landing.match(/aria-controls="product-example"/g) || []).length, 6);
  assert.ok(landing.includes('not a Slack screenshot'));
  assert.doesNotMatch(landing, /assets\/img\/features|assets\/slack-marketplace|Four commands for everyday/);
  for (const asset of ['teamwork.webp','planning.webp','people.webp','checkins.svg','tasks.svg','polls.svg','planning.svg','people.svg','reports.svg']) {
    assert.ok(readFileSync(`public/assets/site-v3/${asset}`).length > 100, asset);
  }
  assert.ok(landing.includes('All fourteen commands are published'));
  assert.ok(guide.includes('Published in Slack:'));
  for (const term of ['outgoing handoffs', 'key results', 'private approvals', 'one-on-ones']) assert.ok(guide.includes(term), term);
});
test('privacy policy is linked directly in navigation, hero, and footer', () => {
  assert.ok((landing.match(/href="\/privacy"/g) || []).length >= 5);
  assert.ok(!landing.includes('href="/#privacy"'));
  assert.match(landing, /href="\/api\/slack\/install"/);
});
test('policy renders its collection, use, storage, retention, and request sections', () => {
  for (const id of ['collect', 'use', 'storage', 'permissions', 'retention', 'rights', 'contact-privacy'])
    assert.ok(privacy.includes(`id="${id}"`), id);
  for (const term of ['Vercel', 'Neon', 'Cloudflare', 'OAuth', 'diagnostic logs', 'machine-readable', 'mailto:kick.bot.help@gmail.com'])
    assert.ok(privacy.includes(term), term);
});
test('policy is English, product-specific, and has its own canonical URL', () => {
  assert.match(privacy, /<html lang="en"/);
  assert.ok(privacy.includes('Kick Bot privacy policy'));
  assert.ok(privacy.includes('href="https://kick.bozmoz.com/privacy"'));
});
test('website explains the full release without claiming pending permissions are active', () => {
  for (const term of ['/sync setup', '/pick rotate', '15 minutes', 'installation consent and activation', 'No individual productivity scores', 'planning poker', 'Schedules are opt-in']) assert.ok(landing.includes(term), term);
  assert.ok(!landing.includes('role="tab"'));
});

test('collaboration data, visibility and retention are explained in policy and guide', () => {
  for (const term of ['retrospective topics', 'calendar exceptions', 'Planning-poker estimates', 'source message timestamp', 'audit entries']) assert.ok(privacy.includes(term), term);
  for (const term of ['Channel to-dos', 'Planning poker', 'Retrospectives', 'Calendar', 'Search', 'Operations', 'not anonymous', 'Edit / correct']) assert.ok(guide.includes(term), term);
});

test('polls, private tasks and reports have concrete examples and accurate privacy limits', () => {
  for (const term of ['Personal &amp; channel to-dos', 'Comprehensive reports', '/todo mine', '/report week']) assert.ok(landing.includes(term), term);
  const examples = readFileSync('app/ui/ProductExplorer.tsx', 'utf8');
  for (const term of ['Which day for the demo?', 'legacy command history', 'not anonymous', 'Prepare the release demo']) assert.ok(examples.includes(term), term);
  for (const term of ['30 days after creation', 'not end-to-end encryption', 'ballots', 'personal to-dos', 'closing a report preview sends nothing']) assert.ok(privacy.includes(term), term);
  for (const term of ['Save vote', 'Share report', 'current status']) assert.ok(guide.includes(term), term);
});
test('team planning has concrete examples, scope and retention disclosures', () => {
  for (const term of ['Workload &amp; objectives', 'measurable key results', 'decision log']) assert.ok(landing.includes(term), term);
  for (const term of ['Set my capacity', 'Proposed, Accepted or Superseded', 'no automatic reminders', 'Concurrent edits']) assert.ok(guide.includes(term), term);
  for (const term of ['self-declared weekly task limits', 'key-result baselines', 'not capacity limits or individual metric values']) assert.ok(privacy.includes(term), term);
});
test('coordination and issue sync have examples and disclose privacy, consent and manual operation', () => {
  for (const term of ['Handoffs &amp; approvals', 'Onboarding &amp; one-on-ones', 'Leave &amp; coverage', 'Jira, Linear &amp; GitHub', 'There is no background sync']) assert.ok(landing.includes(term), term);
  for (const term of ['No source record is copied', 'not end-to-end encrypted', 'Linked issues', 'nothing synchronizes automatically', 'Disconnect workspace']) assert.ok(guide.includes(term), term);
  for (const term of ['encrypted agenda', 'designated approver', 'There is no background sync', 'expire after 90 days', 'single-use links']) assert.ok(privacy.includes(term), term);
});
test('combined command release is documented as published without stale review notices', () => {
  for (const name of ['sync', 'pick', 'kudos', 'coins', 'todo', 'poll', 'report', 'plan', 'decision', 'handoff', 'approve', 'onboard', 'oneonone', 'timeoff']) {
    assert.ok(landing.includes(`/${name}`), name);
    assert.ok(guide.includes(`/${name}`), name);
  }
  for (const content of [landing, guide, readFileSync('app/llms.txt/route.ts', 'utf8')]) {
    assert.doesNotMatch(content, /unpublished|not yet published|await.*publication|pending Slack registration|New command rollout|approval and publication are pending/i);
  }
  assert.ok(guide.includes('command-reference'));
});

test('new motion graphic supports pause and a static reduced-motion view', () => {
  assert.ok(landing.includes('Illustrative sequence:'));
  const css = readFileSync('app/ui/home.module.css', 'utf8');
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(css.includes('animation:handoff 8s ease-in-out infinite'));
  assert.ok(css.includes('animation-play-state:paused'));
  assert.ok(css.includes('.motion * { animation:none !important; }'));
  assert.ok(landing.includes('Pause animation'));
  assert.ok(landing.includes('aria-controls="work-sequence"'));
  assert.ok(!css.includes('letter-spacing: -.045em'));
});
test('landing page links to a public getting-started guide with actionable instructions', () => {
  assert.ok(landing.includes('href="/get-started"'));
  for (const term of ['Open your workspace', 'Share your first update', '/sync -r 7', 'href="/privacy"', 'href="/support"']) assert.ok(guide.includes(term), term);
});

test('public marketing pages omit decorative numbering and the retired hero tagline', () => {
  for (const html of [landing, guide]) {
    assert.doesNotMatch(html, /Kick Bot · Independent app for Slack|eyebrow-dot|feature-number|hero-glow|cta-orbit/);
    assert.doesNotMatch(html, /<span>0[1-9]<\/span>|0[1-3] · (Your Home|The check-in|The digest)/);
  }
});
