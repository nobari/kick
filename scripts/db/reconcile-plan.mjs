import encryption from '../../server/db/encryption.cjs';

const keys = {
  enterprises: ['id'], workspaces: ['id'], members: ['workspace_id', 'user_id'], channels: ['workspace_id', 'channel_id'],
  channel_members: ['workspace_id', 'channel_id', 'user_id'], slack_installations: ['id'],
  workspace_settings: ['workspace_id', 'category', 'name'], standup_threads: ['id'], standup_updates: ['id'],
  recognition_events: ['id'], recognition_recipients: ['id'], pick_events: ['id'],
  pick_participants: ['workspace_id', 'event_id', 'user_id'], legacy_metric_baselines: ['workspace_id', 'user_id', 'metric', 'dimension'],
};
const canonical = value => JSON.stringify(value instanceof Date ? value.toISOString() : value);

export async function reconcilePlan(client, plan, dataKey) {
  for (const [table, expected] of Object.entries(plan.tables)) {
    const columns = keys[table];
    if (!columns) throw new Error('Unknown reconciliation table');
    const identity = row => JSON.stringify(columns.map(column => row[column]));
    const result = await client.query(`SELECT * FROM "${table}"`);
    if (result.rows.length !== expected.size) throw new Error(`Reconciliation count mismatch: ${table}`);
    const actual = new Map(result.rows.map(row => [identity(row), row]));
    for (const row of expected.values()) {
      const stored = actual.get(identity(row));
      if (!stored) throw new Error(`Reconciliation identity mismatch: ${table}`);
      for (const [column, value] of Object.entries(row)) {
        if (column === 'credentials_ciphertext') {
          const context = `installation:${row.id}`;
          if (canonical(encryption.unseal(stored[column], context, dataKey)) !== canonical(encryption.unseal(value, context, dataKey))) {
            throw new Error('Reconciliation credential mismatch');
          }
        } else if (canonical(stored[column]) !== canonical(value)) throw new Error(`Reconciliation value mismatch: ${table}.${column}`);
      }
    }
  }
}
