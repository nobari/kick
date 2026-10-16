import test from 'node:test';
import assert from 'node:assert/strict';
import { readChoice, pageParameters, CONSENT_AGE, MEASUREMENT_ID, trackPage, stopAnalytics, trackInstallClick } from '../app/ui/analytics.ts';

test('consent fails closed for absent, malformed, stale and future records', () => {
  const now = 1_000_000_000_000;
  for (const raw of [null, '', 'invalid', '{}', JSON.stringify({ version: 1, choice: 'accepted', at: now + 1 }), JSON.stringify({ version: 1, choice: 'accepted', at: now - CONSENT_AGE })]) assert.equal(readChoice(raw, now), 'unknown');
  for (const choice of ['accepted', 'rejected']) assert.equal(readChoice(JSON.stringify({ version: 1, choice, at: now }), now), choice);
});

test('only exact production public routes can be tracked', () => {
  for (const origin of ['http://localhost:3000', 'https://kick-preview.vercel.app', 'https://kick.bozmoz.com.evil.test']) assert.equal(pageParameters(origin, '/'), null);
  for (const path of ['/installed', '/install-error', '/api/slack/install', '/api/slack/oauth_redirect', '/api/integrations/jira/callback', '/unknown', '/?code=secret', '/#secret', '/toString']) assert.equal(pageParameters('https://kick.bozmoz.com', path), null);
  assert.deepEqual(pageParameters('https://kick.bozmoz.com', '/privacy'), { page_location: 'https://kick.bozmoz.com/privacy', page_title: 'Kick — Privacy policy', page_referrer: '' });
});

test('tag initializes once, sends sanitized pageviews, and disables tracking on withdrawal/private routes', () => {
  const scripts = [];
  const writes = [];
  globalThis.window = { location: { origin: 'https://kick.bozmoz.com', pathname: '/', search: '?code=secret', hash: '#token' } };
  globalThis.document = {
    createElement: () => ({}), head: { appendChild: value => scripts.push(value) },
    get cookie() { return '_ga=abc; _ga_6EC7YHKCG9=def; slack_state=keep'; },
    set cookie(value) { writes.push(value); },
  };
  assert.equal(scripts.length, 0);
  trackPage('/');
  trackPage('/');
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`);
  assert.equal(scripts[0].referrerPolicy, 'no-referrer');
  let commands = window.dataLayer.map(value => Array.from(value));
  assert.deepEqual(commands[0].slice(0, 2), ['consent', 'default']);
  assert.equal(commands[0][2].analytics_storage, 'denied');
  assert.equal(commands.find(value => value[0] === 'config')[2].send_page_view, false);
  assert.equal(commands.filter(value => value[1] === 'page_view').length, 1);
  assert.equal(JSON.stringify(commands).includes('secret'), false);
  trackInstallClick();
  trackPage('/privacy');
  assert.equal(scripts.length, 1);
  stopAnalytics();
  const length = window.dataLayer.length;
  trackInstallClick();
  assert.equal(window.dataLayer.length, length);
  assert.equal(window[`ga-disable-${MEASUREMENT_ID}`], true);
  assert.ok(writes.length >= 2);
  assert.equal(writes.some(value => value.includes('slack_state')), false);
  trackPage('/installed');
  assert.equal(window[`ga-disable-${MEASUREMENT_ID}`], true);
  commands = window.dataLayer.map(value => Array.from(value));
  assert.equal(commands.filter(value => value[1] === 'slack_install_click').length, 1);
  assert.equal(commands.filter(value => value[1] === 'page_view').length, 2);
  delete globalThis.window;
  delete globalThis.document;
});
