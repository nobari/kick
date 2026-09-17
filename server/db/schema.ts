import { sql } from 'drizzle-orm';
import { pgTable, pgEnum, text, uuid, boolean, integer, bigint, timestamp, primaryKey, foreignKey, unique, uniqueIndex, index, check } from 'drizzle-orm/pg-core';

const time = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const created = () => time('created_at').notNull().defaultNow();
export const recognitionKind = pgEnum('recognition_kind', ['kudos', 'coin']);
export const installationEnvironment = pgEnum('installation_environment', ['production', 'test']);
export const jobStatus = pgEnum('job_status', ['pending', 'processing', 'completed', 'failed']);

export const enterprises = pgTable('enterprises', {
  id: text('id').primaryKey(), name: text('name'), createdAt: created(),
});
export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(), enterpriseId: text('enterprise_id').references(() => enterprises.id),
  name: text('name'), domain: text('domain'), timezone: text('timezone').notNull().default('UTC'),
  createdAt: created(), updatedAt: time('updated_at').notNull().defaultNow(),
});
export const members = pgTable('members', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), username: text('username'), displayName: text('display_name'),
  isBot: boolean('is_bot').notNull().default(false), isDeleted: boolean('is_deleted').notNull().default(false),
  refreshedAt: time('refreshed_at'), createdAt: created(),
}, t => [primaryKey({ columns: [t.workspaceId, t.userId] })]);
export const channels = pgTable('channels', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  channelId: text('channel_id').notNull(), name: text('name'), isPrivate: boolean('is_private'),
  isArchived: boolean('is_archived').notNull().default(false), purpose: text('purpose'), topic: text('topic'),
  refreshedAt: time('refreshed_at'), membershipRefreshedAt: time('membership_refreshed_at'), createdAt: created(),
}, t => [primaryKey({ columns: [t.workspaceId, t.channelId] })]);
export const channelMembers = pgTable('channel_members', {
  workspaceId: text('workspace_id').notNull(), channelId: text('channel_id').notNull(), userId: text('user_id').notNull(),
  observedAt: time('observed_at').notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.workspaceId, t.channelId, t.userId] }),
  foreignKey({ columns: [t.workspaceId, t.channelId], foreignColumns: [channels.workspaceId, channels.channelId] }).onDelete('cascade'),
  foreignKey({ columns: [t.workspaceId, t.userId], foreignColumns: [members.workspaceId, members.userId] }).onDelete('cascade'),
  index('channel_members_user_idx').on(t.workspaceId, t.userId),
]);

export const installations = pgTable('slack_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  enterpriseId: text('enterprise_id').references(() => enterprises.id, { onDelete: 'cascade' }),
  isEnterprise: boolean('is_enterprise').notNull().default(false),
  environment: installationEnvironment('environment').notNull().default('production'),
  appId: text('app_id'), botId: text('bot_id'), botUserId: text('bot_user_id'), installerUserId: text('installer_user_id'),
  botScopes: text('bot_scopes').array().notNull().default(sql`'{}'::text[]`),
  userScopes: text('user_scopes').array().notNull().default(sql`'{}'::text[]`),
  // Full SDK authorization envelope encrypted with AES-GCM, never ordinary JSON.
  credentialsCiphertext: text('credentials_ciphertext').notNull(), keyVersion: integer('key_version').notNull().default(1),
  installedAt: created(), updatedAt: time('updated_at').notNull().defaultNow(), revokedAt: time('revoked_at'),
  legacySource: text('legacy_source').unique(),
}, t => [
  check('installation_scope_valid', sql`(${t.isEnterprise} AND ${t.enterpriseId} IS NOT NULL AND ${t.workspaceId} IS NULL) OR (NOT ${t.isEnterprise} AND ${t.workspaceId} IS NOT NULL)`),
  uniqueIndex('active_workspace_installation_idx').on(t.workspaceId, t.environment).where(sql`${t.revokedAt} IS NULL AND NOT ${t.isEnterprise}`),
  uniqueIndex('active_enterprise_installation_idx').on(t.enterpriseId, t.environment).where(sql`${t.revokedAt} IS NULL AND ${t.isEnterprise}`),
]);
export const workspaceSettings = pgTable('workspace_settings', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), name: text('name').notNull(), value: text('value').notNull(),
  updatedBy: text('updated_by'), updatedAt: time('updated_at').notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.workspaceId, t.category, t.name] })]);

export const standupThreads = pgTable('standup_threads', {
  id: uuid('id').primaryKey().defaultRandom(), workspaceId: text('workspace_id').notNull(), channelId: text('channel_id').notNull(),
  messageTs: text('message_ts').notNull(), startedAt: time('started_at').notNull(), closedAt: time('closed_at'),
}, t => [
  uniqueIndex('standup_thread_message_idx').on(t.workspaceId, t.channelId, t.messageTs),
  unique('standup_thread_tenant_idx').on(t.workspaceId, t.channelId, t.id),
  index('standup_threads_recent_idx').on(t.workspaceId, t.channelId, t.startedAt),
  foreignKey({ columns: [t.workspaceId, t.channelId], foreignColumns: [channels.workspaceId, channels.channelId] }).onDelete('cascade'),
]);
export const standupUpdates = pgTable('standup_updates', {
  id: uuid('id').primaryKey().defaultRandom(), workspaceId: text('workspace_id').notNull(), channelId: text('channel_id').notNull(),
  threadId: uuid('thread_id'), userId: text('user_id').notNull(), mood: text('mood'),
  previousWork: text('previous_work'), plannedWork: text('planned_work'), blockers: text('blockers'),
  submittedAt: time('submitted_at').notNull(), updatedAt: time('updated_at').notNull().defaultNow(),
  messageTs: text('message_ts').notNull(), permalink: text('permalink'), legacySource: text('legacy_source').unique(),
}, t => [
  uniqueIndex('standup_update_message_idx').on(t.workspaceId, t.channelId, t.messageTs),
  unique('standup_update_tenant_idx').on(t.workspaceId, t.id),
  // Do not impose one response/day: historical threads can contain legitimate repeats.
  index('standup_channel_report_idx').on(t.workspaceId, t.channelId, t.submittedAt, t.id),
  index('standup_member_recent_idx').on(t.workspaceId, t.userId, t.submittedAt, t.id),
  foreignKey({ columns: [t.workspaceId, t.channelId], foreignColumns: [channels.workspaceId, channels.channelId] }).onDelete('cascade'),
  foreignKey({ columns: [t.workspaceId, t.userId], foreignColumns: [members.workspaceId, members.userId] }).onDelete('cascade'),
  foreignKey({ columns: [t.workspaceId, t.channelId, t.threadId], foreignColumns: [standupThreads.workspaceId, standupThreads.channelId, standupThreads.id] }),
]);
export const recognitionEvents = pgTable('recognition_events', {
  id: uuid('id').primaryKey().defaultRandom(), workspaceId: text('workspace_id').notNull(), channelId: text('channel_id').notNull(),
  senderId: text('sender_id').notNull(), kind: recognitionKind('kind').notNull(), reason: text('reason'),
  standupId: uuid('standup_id'), messageTs: text('message_ts'), threadTs: text('thread_ts'), permalink: text('permalink'),
  occurredAt: time('occurred_at').notNull(),
}, t => [
  unique('recognition_tenant_idx').on(t.workspaceId, t.id),
  uniqueIndex('recognition_message_idx').on(t.workspaceId, t.channelId, t.messageTs, t.kind, t.senderId),
  index('recognition_report_idx').on(t.workspaceId, t.kind, t.occurredAt, t.id),
  foreignKey({ columns: [t.workspaceId, t.channelId], foreignColumns: [channels.workspaceId, channels.channelId] }).onDelete('cascade'),
  foreignKey({ columns: [t.workspaceId, t.senderId], foreignColumns: [members.workspaceId, members.userId] }).onDelete('cascade'),
  foreignKey({ columns: [t.workspaceId, t.standupId], foreignColumns: [standupUpdates.workspaceId, standupUpdates.id] }),
]);
export const recognitionRecipients = pgTable('recognition_recipients', {
  id: uuid('id').primaryKey().defaultRandom(), workspaceId: text('workspace_id').notNull(), eventId: uuid('event_id').notNull(),
  recipientId: text('recipient_id').notNull(), units: integer('units').notNull().default(1),
  legacySource: text('legacy_source').unique(),
}, t => [
  check('recognition_positive_units', sql`${t.units} > 0`),
  index('recognition_recipient_idx').on(t.workspaceId, t.recipientId, t.eventId),
  // Separate grant IDs preserve any real duplicate legacy grants; runtime dedup is at request level.
  foreignKey({ columns: [t.workspaceId, t.eventId], foreignColumns: [recognitionEvents.workspaceId, recognitionEvents.id] }).onDelete('cascade'),
  foreignKey({ columns: [t.workspaceId, t.recipientId], foreignColumns: [members.workspaceId, members.userId] }).onDelete('cascade'),
]);
export const pickEvents = pgTable('pick_events', {
  id: uuid('id').primaryKey().defaultRandom(), workspaceId: text('workspace_id').notNull(), channelId: text('channel_id').notNull(),
  requestedBy: text('requested_by').notNull(), purpose: text('purpose'), question: text('question'),
  requestedCount: integer('requested_count').notNull(), occurredAt: time('occurred_at').notNull(), messageTs: text('message_ts'),
  legacySource: text('legacy_source').unique(),
}, t => [
  unique('pick_tenant_idx').on(t.workspaceId, t.id),
  uniqueIndex('pick_message_idx').on(t.workspaceId, t.channelId, t.messageTs),
  check('pick_count_positive', sql`${t.requestedCount} > 0`),
  index('pick_report_idx').on(t.workspaceId, t.channelId, t.occurredAt, t.id),
  foreignKey({ columns: [t.workspaceId, t.channelId], foreignColumns: [channels.workspaceId, channels.channelId] }).onDelete('cascade'),
  foreignKey({ columns: [t.workspaceId, t.requestedBy], foreignColumns: [members.workspaceId, members.userId] }).onDelete('cascade'),
]);
export const pickParticipants = pgTable('pick_participants', {
  workspaceId: text('workspace_id').notNull(), eventId: uuid('event_id').notNull(), userId: text('user_id').notNull(),
  selectedPosition: integer('selected_position'),
}, t => [
  primaryKey({ columns: [t.workspaceId, t.eventId, t.userId] }),
  uniqueIndex('pick_selected_position_idx').on(t.workspaceId, t.eventId, t.selectedPosition),
  check('pick_position_nonnegative', sql`${t.selectedPosition} IS NULL OR ${t.selectedPosition} >= 0`),
  index('pick_participant_history_idx').on(t.workspaceId, t.userId, t.eventId),
  foreignKey({ columns: [t.workspaceId, t.eventId], foreignColumns: [pickEvents.workspaceId, pickEvents.id] }).onDelete('cascade'),
  foreignKey({ columns: [t.workspaceId, t.userId], foreignColumns: [members.workspaceId, members.userId] }).onDelete('cascade'),
]);

// Foundations for transactional request deduplication and an outbox. Runtime
// integration is still required; this schema alone does not deduplicate sends.
export const processedRequests = pgTable('processed_requests', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  requestKey: text('request_key').notNull(), status: jobStatus('status').notNull().default('processing'),
  createdAt: created(), expiresAt: time('expires_at').notNull(), resultId: uuid('result_id'),
}, t => [primaryKey({ columns: [t.workspaceId, t.requestKey] }), index('request_expiry_idx').on(t.expiresAt)]);
export const outboxJobs = pgTable('outbox_jobs', {
  id: uuid('id').primaryKey().defaultRandom(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  deduplicationKey: text('deduplication_key').notNull(), operation: text('operation').notNull(),
  payloadCiphertext: text('payload_ciphertext').notNull(), status: jobStatus('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0), availableAt: time('available_at').notNull().defaultNow(),
  leaseUntil: time('lease_until'), leaseOwner: uuid('lease_owner'), createdAt: created(), completedAt: time('completed_at'),
}, t => [
  uniqueIndex('outbox_dedup_idx').on(t.workspaceId, t.deduplicationKey),
  index('outbox_pending_idx').on(t.availableAt, t.id).where(sql`${t.status} = 'pending'`),
  index('outbox_lease_idx').on(t.leaseUntil).where(sql`${t.status} = 'processing'`),
  check('outbox_attempts_nonnegative', sql`${t.attempts} >= 0`),
]);

// Import bookkeeping is separate from the product schema. Raw legacy documents
// remain only in the encrypted snapshot, not a generic runtime document table.
export const migrationRuns = pgTable('migration_runs', {
  id: uuid('id').primaryKey().defaultRandom(), sourceProject: text('source_project').notNull(), snapshotDigest: text('snapshot_digest').notNull().unique(),
  snapshotAt: time('snapshot_at').notNull(), startedAt: created(), completedAt: time('completed_at'),
  sourceCount: integer('source_count').notNull(), importedCount: integer('imported_count').notNull().default(0),
});
export const migrationRecords = pgTable('migration_records', {
  runId: uuid('run_id').notNull().references(() => migrationRuns.id, { onDelete: 'cascade' }),
  sourcePath: text('source_path').notNull(), sourceHash: text('source_hash').notNull(),
  disposition: text('disposition').notNull(), targetTable: text('target_table'), targetId: text('target_id'),
}, t => [
  primaryKey({ columns: [t.runId, t.sourcePath] }),
  check('migration_disposition_valid', sql`${t.disposition} IN ('imported', 'derived', 'archived', 'quarantined')`),
]);
export const legacyMetricBaselines = pgTable('legacy_metric_baselines', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), metric: text('metric').notNull(), dimension: text('dimension').notNull(),
  value: bigint('value', { mode: 'bigint' }).notNull(), asOf: time('as_of'),
}, t => [primaryKey({ columns: [t.workspaceId, t.userId, t.metric, t.dimension] })]);
