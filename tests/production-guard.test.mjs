import test from 'node:test';
import assert from 'node:assert/strict';
import { productionConnection } from '../scripts/db/production-db.mjs';
test('production cutover guard accepts only the exact main branch and verified direct endpoint', () => {
  const env = { KICK_DB_BRANCH: 'br-plain-union-awztoj84', DATABASE_URL_UNPOOLED: 'postgresql://fixture:fixture@ep-muddy-pine-awoaob9z.c-12.us-east-1.aws.neon.tech/neondb?sslmode=verify-full' };
  assert.equal(productionConnection(env), env.DATABASE_URL_UNPOOLED);
  assert.throws(() => productionConnection({}));
  assert.throws(() => productionConnection({ ...env, KICK_DB_BRANCH: 'br-old-voice-aw1siabw' }));
  assert.throws(() => productionConnection({ ...env, DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED.replace('verify-full', 'require') }));
  assert.throws(() => productionConnection({ ...env, DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED.replace('awoaob9z.', 'awoaob9z-pooler.') }));
});
