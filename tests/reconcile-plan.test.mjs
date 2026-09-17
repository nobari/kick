import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { reconcilePlan } from '../scripts/db/reconcile-plan.mjs';
import encryption from '../server/db/encryption.cjs';

test('reconciliation checks values, not just row counts', async () => {
  const plan = { tables: { workspaces: new Map([['T1', { id: 'T1', name: 'Expected' }]]) } };
  await reconcilePlan({ query: async () => ({ rows: [{ id: 'T1', name: 'Expected', timezone: 'UTC' }] }) }, plan);
  await assert.rejects(reconcilePlan({ query: async () => ({ rows: [{ id: 'T1', name: 'Changed' }] }) }, plan), /value mismatch/);
  await assert.rejects(reconcilePlan({ query: async () => ({ rows: [{ id: 'T2', name: 'Expected' }] }) }, plan), /identity mismatch/);
});
test('independently encrypted credentials reconcile by authenticated content', async () => {
  const key = randomBytes(32).toString('base64'), envelope = { bot: { token: 'fixture' } };
  const expected = { id: 'fixture-id', credentials_ciphertext: encryption.seal(envelope, 'installation:fixture-id', key) };
  const actual = { ...expected, credentials_ciphertext: encryption.seal(envelope, 'installation:fixture-id', key) };
  const plan = { tables: { slack_installations: new Map([['fixture-id', expected]]) } };
  await reconcilePlan({ query: async () => ({ rows: [actual] }) }, plan, key);
  await assert.rejects(reconcilePlan({ query: async () => ({ rows: [actual] }) }, plan, randomBytes(32).toString('base64')), /authentication failed/);
});
