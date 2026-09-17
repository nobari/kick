import { sql } from 'drizzle-orm';
import { pgTable, text, bigint, integer, boolean, jsonb, index, unique, foreignKey, check, AnyPgColumn } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
const ms = (name: string) => bigint(name, { mode: 'number' });
const identity = () => ({ id: text('id').primaryKey(), team: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }) });
const lifetime = () => ({ at: ms('created_at').notNull(), expiresAt: ms('expires_at').notNull() });
const settings = () => ({
  channel: text('channel_id').notNull(), owner: text('owner_id').notNull(), enabled: boolean('enabled').notNull().default(false),
  zone: text('timezone').notNull(), time: text('checkin_time').notNull(), digestTime: text('digest_time').notNull(),
  days: integer('weekdays').array().notNull(), members: text('participants').array().notNull(),
  template: text('template').notNull(), questions: text('questions').array().notNull(),
  roundup: boolean('roundup').notNull().default(false), retentionDays: integer('retention_days').notNull(),
});
export const ritualConfigs = pgTable('ritual_configs', {
  ...identity(), ...settings(), nextAt: ms('next_at').notNull(), updatedAt: ms('updated_at').notNull(),
  leaseOwner: text('lease_owner'), leaseUntil: ms('lease_until').notNull().default(0), lastError: text('last_error'),
}, t => [unique('ritual_config_channel').on(t.team, t.channel), unique('ritual_config_tenant').on(t.team, t.id),
  index('ritual_config_due').on(t.nextAt, t.id).where(sql`${t.enabled}`),
  check('ritual_retention_valid', sql`${t.retentionDays} IN (7,30,90)`),
  check('ritual_participants_valid', sql`cardinality(${t.members}) BETWEEN 1 AND 50`),
  check('ritual_questions_valid', sql`cardinality(${t.questions}) BETWEEN 1 AND 5`)]);
const linked = () => ({ ...identity(), config: text('config_id').notNull(), ...lifetime() });
const links = (t: {team: AnyPgColumn; config: AnyPgColumn; at: AnyPgColumn; id: AnyPgColumn; expiresAt: AnyPgColumn}, name: string) => [
  foreignKey({ columns: [t.team, t.config], foreignColumns: [ritualConfigs.team, ritualConfigs.id] }).onDelete('cascade'),
  index(`${name}_config`).on(t.config, t.at, t.id), index(`${name}_expiry`).on(t.expiresAt),
];
export const ritualRuns = pgTable('ritual_runs', {
  ...linked(), channel: text('channel_id').notNull(), date: text('local_date').notNull(),
  members: text('participants').array().notNull(), questions: text('questions').array().notNull(),
}, t => [...links(t, 'ritual_run'), unique('ritual_run_date').on(t.config, t.date), unique('ritual_run_tenant').on(t.team, t.config, t.id)]);
export const ritualResponses = pgTable('ritual_responses', {
  ...linked(), run: text('run_id').notNull(), user: text('user_id').notNull(), answers: text('answers').array().notNull(),
}, t => [...links(t, 'ritual_response'), unique('ritual_response_user').on(t.run, t.user),
  foreignKey({ columns: [t.team, t.config, t.run], foreignColumns: [ritualRuns.team, ritualRuns.config, ritualRuns.id] }).onDelete('cascade')]);
export const ritualBlockers = pgTable('ritual_blockers', {
  ...linked(), user: text('reporter_id').notNull(), helper: text('helper_id').notNull(), detail: text('detail').notNull(), resolvedAt: ms('resolved_at'), updatedBy: text('updated_by'),
}, t => links(t, 'ritual_blocker'));
export const ritualRecognition = pgTable('ritual_recognition', {
  ...linked(), from: text('sender_id').notNull(), to: text('recipient_id').notNull(), reason: text('reason').notNull(),
}, t => links(t, 'ritual_recognition'));
export const ritualPrefs = pgTable('ritual_prefs', {
  ...identity(), user: text('user_id').notNull(), zone: text('timezone'), quietStart: text('quiet_start'), quietEnd: text('quiet_end'),
  disabled: boolean('disabled').notNull().default(false), leaveUntil: text('leave_until'), snoozeUntil: ms('snooze_until'),
}, t => [unique('ritual_pref_user').on(t.team, t.user)]);
export const ritualDrafts = pgTable('ritual_drafts', {
  ...identity(), ...settings(), editor: text('editor_id').notNull(), expiresAt: ms('expires_at').notNull(),
}, t => [index('ritual_draft_expiry').on(t.expiresAt)]);
export const ritualRotations = pgTable('ritual_rotations', {
  ...linked(), selected: text('selected_user').notNull(), history: text('history').array().notNull(),
  // Bounded idempotency receipts, not an unstructured document store.
  operations: jsonb('operations').$type<Record<string, string>>().notNull(),
}, t => links(t, 'ritual_rotation'));
export const ritualJobs = pgTable('ritual_jobs', {
  ...linked(), channel: text('channel_id').notNull(), kind: text('kind').notNull(),
  owner: text('lease_owner'), leaseUntil: ms('lease_until').notNull().default(0),
  run: text('run_id'), user: text('user_id'), blocker: text('blocker_id'), since: ms('since_at'),
  selected: text('selected_user'), reason: text('reason'), clientId: text('client_message_id').notNull(),
  dueAt: ms('due_at').notNull(), attempts: integer('attempts').notNull().default(0), done: boolean('done').notNull().default(false),
  status: text('status').notNull().default('pending'), lastError: text('last_error'),
}, t => [...links(t, 'ritual_job'), index('ritual_job_due').on(t.dueAt, t.id).where(sql`NOT ${t.done}`),
  check('ritual_job_kind', sql`${t.kind} IN ('prompt','reminder','digest','roundup','followup','rotation')`),
  check('ritual_job_attempts', sql`${t.attempts} >= 0`)]);
