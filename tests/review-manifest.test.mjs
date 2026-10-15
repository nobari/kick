import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewManifest } from '../scripts/slack-review-manifest.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
test('review manifest uses isolated prefixed commands and the implemented permissions', () => {
  const m = reviewManifest('https://review.example.test');
  assert.deepEqual(m.features.slash_commands.map(c => c.command), ['/tsync', '/tpick', '/tkudos', '/tcoins', '/ttodo', '/tpoll', '/treport', '/tplan', '/tdecision', '/thandoff', '/tapprove', '/tonboard', '/toneonone', '/tleave']);
  assert.ok(m.oauth_config.scopes.bot.includes('im:write'));
  assert.equal(m.oauth_config.scopes.bot.length, 7);
  assert.deepEqual(m.features.shortcuts.map(s => s.callback_id), ['kick_track_action', 'kick_report_blocker', 'kick_give_kudos']);
  assert.ok(m.features.shortcuts.every(s => s.type === 'message'));
  assert.deepEqual(m.settings.event_subscriptions.bot_events, ['app_home_opened']);
  assert.ok(m.features.slash_commands.every(c => c.url.startsWith('https://review.example.test/')));
});
test('review generator rejects production origins and unsafe URLs', () => {
  for (const origin of ['https://kick.bozmoz.com', 'http://review.example.test', 'https://user:pass@review.example.test', 'https://review.example.test/path', 'https://review.example.test?token=secret'])
    assert.throws(() => reviewManifest(origin));
});
test('production command fragment contains all fourteen commands without replacing other settings', () => {
  const fragment = JSON.parse(execFileSync(process.execPath, ['scripts/slack-command-config.mjs'], { encoding: 'utf8' }));
  assert.deepEqual(fragment, JSON.parse(readFileSync('docs/slack-command-config.json', 'utf8')));
  assert.deepEqual(Object.keys(fragment), ['slash_commands']);
  assert.equal(fragment.slash_commands.length, 14);
  assert.equal(new Set(fragment.slash_commands.map(c => c.command)).size, 14);
  assert.ok(fragment.slash_commands.some(c => c.command === '/todo'));
  assert.ok(fragment.slash_commands.every(c => c.url === 'https://kick.bozmoz.com/api/slack/events' && c.description.length <= 100 && c.should_escape === false));
});
