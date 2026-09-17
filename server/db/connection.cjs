// CommonJS matches the existing Bolt server.
/* eslint-disable @typescript-eslint/no-require-imports */
const { Pool } = require('pg');
const { attachDatabasePool } = require('@vercel/functions');

let database;
function getDatabase() {
  if (database) return database;
  const url = new URL(process.env.DATABASE_URL || 'file:///missing');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.neon.tech') || !url.hostname.includes('-pooler.')) {
    throw new Error('A pooled Neon application connection is required');
  }
  // TLS identity verification is mandatory even if provider defaults change.
  url.searchParams.set('sslmode', 'verify-full');
  const pool = new Pool({ connectionString: url.href, max: 4, idleTimeoutMillis: 5000, connectionTimeoutMillis: 10000 });
  attachDatabasePool(pool);
  pool.on('error', () => console.error('Idle database connection failed'));
  database = databaseForPool(pool);
  return database;
}
function databaseForPool(pool) {
  return {
    query: (sql, params) => pool.query(sql, params),
    async transaction(fn) {
      const client = await pool.connect();
      let discard = false;
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL statement_timeout='15s'");
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { discard = true; }
        throw error;
      } finally { client.release(discard); }
    },
  };
}
module.exports = { getDatabase, databaseForPool };
