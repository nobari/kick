import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Run after pnpm build. Inspect prerendered HTML, not just component source.
const landing = readFileSync('.next/server/app/index.html', 'utf8');
const privacy = readFileSync('.next/server/app/privacy.html', 'utf8');
const guide = readFileSync('.next/server/app/get-started.html', 'utf8');

test('all generated public pages and metadata omit personal-name attribution', () => {
  for (const file of readdirSync('.next/server/app', { recursive: true }).filter(file => file.endsWith('.html'))) {
    assert.doesNotMatch(readFileSync(`.next/server/app/${file}`, 'utf8'), /sadegh|nobari|\bAya\b/i, file);
  }
});

test('landing page explicitly identifies Kick and its Slack integration', () => {
  assert.match(landing, /<h1[^>]*>Team standups/);
  assert.ok(landing.includes('What happens inside your Slack workspace?'));
  for (const command of ['/sync', '/kudos', '/coins', '/pick']) assert.ok(landing.includes(command));
  assert.ok(landing.includes('Neon'));
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
  for (const term of ['/sync setup', '/pick rotate', '15 minutes', 'pending Slack permission approval', 'Illustrative preview', 'No individual productivity scores']) assert.ok(landing.includes(term), term);
  assert.ok(!landing.includes('role="tab"'));
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
