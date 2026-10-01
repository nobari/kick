import { sql } from 'drizzle-orm';
import { pgTable, text, bigint, integer, boolean, jsonb, index, unique, foreignKey, check, AnyPgColumn } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';
const ms = (name: string) => bigint(name, { mode: 'number' });
const identity = () => ({ id: text('id').primaryKey(), team: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }) });
const lifetime = () => ({ at: ms('created_at').notNull(), expiresAt: ms('expires_at').notNull() });
const settings = () => ({
  name: text('name').notNull().default('Daily standup'), workflowKey: text('workflow_key').notNull().default('default'),
  channel: text('channel_id').notNull(), owner: text('owner_id').notNull(), enabled: boolean('enabled').notNull().default(false),
  zone: text('timezone').notNull(), time: text('checkin_time').notNull(), digestTime: text('digest_time').notNull(),
  days: integer('weekdays').array().notNull(), members: text('participants').array().notNull(),
  template: text('template').notNull(), questions: text('questions').array().notNull(),
  roundup: boolean('roundup').notNull().default(false), retentionDays: integer('retention_days').notNull(),
});
export const ritualConfigs = pgTable('ritual_configs', {
  ...identity(), ...settings(), nextAt: ms('next_at').notNull(), updatedAt: ms('updated_at').notNull(),
  leaseOwner: text('lease_owner'), leaseUntil: ms('lease_until').notNull().default(0), lastError: text('last_error'),
}, t => [unique('ritual_config_workflow').on(t.team, t.channel, t.workflowKey), unique('ritual_config_tenant').on(t.team, t.id),
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
  closesAt: ms('closes_at'),
}, t => [...links(t, 'ritual_run'), unique('ritual_run_date').on(t.config, t.date), unique('ritual_run_tenant').on(t.team, t.config, t.id)]);
export const ritualResponses = pgTable('ritual_responses', {
  ...linked(), run: text('run_id').notNull(), user: text('user_id').notNull(), answers: text('answers').array().notNull(),
  version: integer('version').notNull().default(1), editedAt: ms('edited_at'), correction: text('correction'),
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
  check('ritual_job_kind', sql`${t.kind} IN ('prompt','reminder','digest','roundup','followup','rotation','notice')`),
  check('ritual_job_attempts', sql`${t.attempts} >= 0`)]);

export const ritualSprints = pgTable('ritual_sprints', {
  ...linked(), user: text('creator_id').notNull(), title: text('title').notNull(), goal: text('goal').notNull(),
  start: text('start_date').notNull(), end: text('end_date').notNull(), status: text('status').notNull().default('active'), recap: text('recap'),
}, t => [...links(t, 'ritual_sprint'), unique('ritual_sprint_tenant').on(t.team, t.config, t.id), check('ritual_sprint_status', sql`${t.status} IN ('active','closed')`)]);
export const ritualActions = pgTable('ritual_actions', {
  ...linked(), user: text('creator_id').notNull(), owner: text('assignee_id').notNull(), detail: text('detail').notNull(),
  due: text('due_date').notNull(), status: text('status').notNull().default('open'), completedAt: ms('completed_at'),
  source: text('source_kind'), sourceId: text('source_id'), sprint: text('sprint_id'),
}, t => [...links(t, 'ritual_action'), index('ritual_action_owner_due').on(t.team, t.owner, t.status, t.due),
  foreignKey({ columns: [t.team, t.config, t.sprint], foreignColumns: [ritualSprints.team, ritualSprints.config, ritualSprints.id] }).onDelete('cascade'),
  check('ritual_action_status', sql`${t.status} IN ('open','done')`)]);
export const ritualRetros = pgTable('ritual_retros', {
  ...linked(), user: text('creator_id').notNull(), title: text('title').notNull(), status: text('status').notNull().default('collecting'),
}, t => [...links(t, 'ritual_retro'), unique('ritual_retro_tenant').on(t.team, t.config, t.id), check('ritual_retro_status', sql`${t.status} IN ('collecting','voting','closed')`)]);
export const ritualTopics = pgTable('ritual_topics', {
  ...linked(), retro: text('retro_id').notNull(), user: text('author_id').notNull(), detail: text('detail').notNull(), category: text('category').notNull(), group: text('group_name'),
}, t => [...links(t, 'ritual_topic'), index('ritual_topic_retro').on(t.retro, t.at, t.id), unique('ritual_topic_tenant').on(t.team, t.config, t.id),
  foreignKey({ columns: [t.team, t.config, t.retro], foreignColumns: [ritualRetros.team, ritualRetros.config, ritualRetros.id] }).onDelete('cascade')]);
export const ritualVotes = pgTable('ritual_votes', {
  ...linked(), topic: text('topic_id').notNull(), user: text('user_id').notNull(),
}, t => [...links(t, 'ritual_vote'), unique('ritual_vote_once').on(t.topic, t.user),
  foreignKey({ columns: [t.team, t.config, t.topic], foreignColumns: [ritualTopics.team, ritualTopics.config, ritualTopics.id] }).onDelete('cascade')]);
export const ritualPoker = pgTable('ritual_poker', {
  ...linked(), user: text('creator_id').notNull(), title: text('title').notNull(), status: text('status').notNull().default('voting'),
  round: integer('round').notNull().default(1), members: text('participants').array().notNull(), decision: text('decision'),
}, t => [...links(t, 'ritual_poker'), unique('ritual_poker_tenant').on(t.team, t.config, t.id), check('ritual_poker_status', sql`${t.status} IN ('voting','revealed','closed')`)]);
export const ritualEstimates = pgTable('ritual_estimates', {
  ...linked(), poker: text('poker_id').notNull(), user: text('user_id').notNull(), round: integer('round').notNull(), value: text('value').notNull(),
}, t => [...links(t, 'ritual_estimate'), unique('ritual_estimate_once').on(t.poker, t.round, t.user), index('ritual_estimate_session').on(t.poker, t.at, t.id),
  foreignKey({ columns: [t.team, t.config, t.poker], foreignColumns: [ritualPoker.team, ritualPoker.config, ritualPoker.id] }).onDelete('cascade'),
  check('ritual_estimate_value', sql`${t.value} IN ('0','1','2','3','5','8','13','21','?','abstain')`)]);
export const ritualCalendar = pgTable('ritual_calendar', {
  ...linked(), user: text('editor_id').notNull(), date: text('local_date').notNull(), skip: boolean('skip').notNull(), time: text('checkin_time'), digestTime: text('digest_time'),
}, t => [...links(t, 'ritual_calendar'), unique('ritual_calendar_date').on(t.config, t.date)]);
export const ritualAudit = pgTable('ritual_audit', {
  ...linked(), user: text('actor_id').notNull(), event: text('event').notNull(), target: text('target_id').notNull(), detail: text('detail').notNull(),
}, t => links(t, 'ritual_audit'));
