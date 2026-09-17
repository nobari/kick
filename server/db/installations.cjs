// eslint-disable-next-line @typescript-eslint/no-require-imports
const { randomUUID } = require('node:crypto');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { seal, unseal } = require('./encryption.cjs');

function scope(query) {
  // A workspace inside an enterprise is not an enterprise-wide installation.
  const enterprise = query.isEnterpriseInstall === true;
  const id = enterprise ? query.enterpriseId : query.teamId;
  if (typeof id !== 'string' || !id) throw new Error('Installation scope missing');
  return { id, enterprise, column: enterprise ? 'enterprise_id' : 'workspace_id' };
}
function createInstallationRepository(database, { environment = 'production', key } = {}) {
  if (!['production', 'test'].includes(environment)) throw new Error('Invalid installation environment');
  return {
    async fetchInstallation(query) {
      const s = scope(query);
      const result = await database.query(`SELECT id,credentials_ciphertext,key_version FROM slack_installations WHERE ${s.column}=$1 AND is_enterprise=$2 AND environment=$3 AND revoked_at IS NULL`, [s.id, s.enterprise, environment]);
      const row = result.rows[0];
      if (!row) throw new Error('Slack installation not found');
      if (row.key_version !== 1) throw new Error('Unsupported installation encryption key version');
      return unseal(row.credentials_ciphertext, `installation:${row.id}`, key);
    },
    async storeInstallation(installation) {
      const s = scope({ isEnterpriseInstall: installation.isEnterpriseInstall, teamId: installation.team?.id, enterpriseId: installation.enterprise?.id });
      if (!installation.bot?.token) throw new Error('Slack bot credential missing');
      await database.transaction(async client => {
        // Serialize reinstalls and revocations for the same tenant/environment.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify(['installation', s.enterprise, s.id, environment])]);
        const eid = installation.enterprise?.id || null;
        if (eid) await client.query('INSERT INTO enterprises(id,name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=COALESCE(EXCLUDED.name,enterprises.name)', [eid, installation.enterprise.name || null]);
        if (!s.enterprise) await client.query('INSERT INTO workspaces(id,name,enterprise_id) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=COALESCE(EXCLUDED.name,workspaces.name),enterprise_id=EXCLUDED.enterprise_id,updated_at=now()', [s.id, installation.team.name || null, eid]);
        const existing = await client.query(`SELECT id FROM slack_installations WHERE ${s.column}=$1 AND is_enterprise=$2 AND environment=$3 AND revoked_at IS NULL FOR UPDATE`, [s.id, s.enterprise, environment]);
        const id = existing.rows[0]?.id || randomUUID();
        const ciphertext = seal(installation, `installation:${id}`, key);
        await client.query(`INSERT INTO slack_installations(id,workspace_id,enterprise_id,is_enterprise,environment,app_id,bot_id,bot_user_id,installer_user_id,bot_scopes,user_scopes,credentials_ciphertext,key_version)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1)
          ON CONFLICT(id) DO UPDATE SET enterprise_id=EXCLUDED.enterprise_id,app_id=EXCLUDED.app_id,bot_id=EXCLUDED.bot_id,bot_user_id=EXCLUDED.bot_user_id,installer_user_id=EXCLUDED.installer_user_id,bot_scopes=EXCLUDED.bot_scopes,user_scopes=EXCLUDED.user_scopes,credentials_ciphertext=EXCLUDED.credentials_ciphertext,key_version=1,updated_at=now()`,
        [id, s.enterprise ? null : s.id, eid, s.enterprise, environment, installation.appId || null, installation.bot.id || null,
          installation.bot.userId || null, installation.user?.id || null, installation.bot.scopes || [], installation.user?.scopes || [], ciphertext]);
      });
    },
    async deleteInstallation(query) {
      const s = scope(query);
      await database.transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify(['installation', s.enterprise, s.id, environment])]);
        await client.query(`UPDATE slack_installations SET revoked_at=now(),updated_at=now() WHERE ${s.column}=$1 AND is_enterprise=$2 AND environment=$3 AND revoked_at IS NULL`, [s.id, s.enterprise, environment]);
      });
    },
  };
}
module.exports = { createInstallationRepository };
