import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import repository from '../server/db/installations.cjs';
import { rehearsalConnection } from '../scripts/db/rehearsal-db.mjs';

test('installation repository roundtrips credentials, handles enterprise membership and revocation', { skip: !process.env.KICK_DB_BRANCH }, async () => {
  const client = new pg.Client({ connectionString: rehearsalConnection() });
  await client.connect();
  try {
    await client.query('BEGIN');
    const database = { query: (...args) => client.query(...args), transaction: async fn => fn(client) };
    const key = randomBytes(32).toString('base64');
    const repo = repository.createInstallationRepository(database, { key });
    const suffix = randomUUID();
    const installation = { team: { id: `T-${suffix}`, name: 'Test' }, enterprise: { id: `E-${suffix}` },
      isEnterpriseInstall: false, bot: { token: 'fixture-token', scopes: ['commands'] } };
    const query = { teamId: installation.team.id, enterpriseId: installation.enterprise.id, isEnterpriseInstall: false };
    await repo.storeInstallation(installation);
    assert.deepEqual(await repo.fetchInstallation(query), installation);
    installation.bot.token = 'rotated-fixture';
    await repo.storeInstallation(installation);
    assert.equal((await repo.fetchInstallation(query)).bot.token, 'rotated-fixture');
    const testRepo = repository.createInstallationRepository(database, { key, environment: 'test' });
    await assert.rejects(testRepo.fetchInstallation(query), /not found/);
    await repo.deleteInstallation(query);
    await assert.rejects(repo.fetchInstallation(query), /not found/);
    await repo.storeInstallation(installation);
    assert.deepEqual(await repo.fetchInstallation(query), installation);
    await assert.rejects(repo.fetchInstallation({}), /scope missing/);
    const enterprise = { ...installation, team: undefined, isEnterpriseInstall: true };
    await repo.storeInstallation(enterprise);
    const restored = await repo.fetchInstallation({ isEnterpriseInstall: true, enterpriseId: enterprise.enterprise.id });
    assert.equal(restored.isEnterpriseInstall, true);
  } finally { await client.query('ROLLBACK'); await client.end(); }
});
