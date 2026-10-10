import { sql } from 'drizzle-orm';
import { pgTable, text, bigint, integer, doublePrecision, boolean, jsonb, index, unique, foreignKey, check, AnyPgColumn } from 'drizzle-orm/pg-core';
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
  check('ritual_job_kind', sql`${t.kind} IN ('prompt','reminder','digest','roundup','followup','rotation','notice','escalation')`),
  check('ritual_job_attempts', sql`${t.attempts} >= 0`)]);

export const ritualSprints = pgTable('ritual_sprints', {
  ...linked(), user: text('creator_id').notNull(), title: text('title').notNull(), goal: text('goal').notNull(),
  start: text('start_date').notNull(), end: text('end_date').notNull(), status: text('status').notNull().default('active'), recap: text('recap'),
}, t => [...links(t, 'ritual_sprint'), unique('ritual_sprint_tenant').on(t.team, t.config, t.id), check('ritual_sprint_status', sql`${t.status} IN ('active','closed')`)]);
export const ritualActions = pgTable('ritual_actions', {
  ...linked(), user: text('creator_id').notNull(), owner: text('assignee_id').notNull(), detail: text('detail').notNull(),
  due: text('due_date').notNull(), status: text('status').notNull().default('open'), completedAt: ms('completed_at'),
  source: text('source_kind'), sourceId: text('source_id'), sprint: text('sprint_id'),
}, t => [...links(t, 'ritual_action'), unique('ritual_action_tenant').on(t.team, t.config, t.id), index('ritual_action_owner_due').on(t.team, t.owner, t.status, t.due),
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

// Personal tasks deliberately have no workflow/channel relationship.
export const ritualTodos = pgTable('ritual_todos', {
  ...identity(), ...lifetime(), user: text('user_id').notNull(), detail: text('detail').notNull(),
  due: text('due_date').notNull(), status: text('status').notNull().default('open'),
  version: integer('version').notNull().default(1), completedAt: ms('completed_at'),
}, t => [index('ritual_todo_owner').on(t.team, t.user, t.at, t.id), index('ritual_todo_expiry').on(t.expiresAt),
  check('ritual_todo_status', sql`${t.status} IN ('open','done')`)]);
export const ritualPolls = pgTable('ritual_polls', {
  ...linked(), user: text('creator_id').notNull(), title: text('title').notNull(),
  options: text('options').array().notNull(), status: text('status').notNull().default('open'), closedAt: ms('closed_at'),
}, t => [...links(t, 'ritual_poll'), unique('ritual_poll_tenant').on(t.team, t.config, t.id),
  check('ritual_poll_status', sql`${t.status} IN ('open','closed')`), check('ritual_poll_options', sql`cardinality(${t.options}) BETWEEN 2 AND 10`)]);
export const ritualBallots = pgTable('ritual_ballots', {
  ...linked(), poll: text('poll_id').notNull(), user: text('user_id').notNull(), choice: integer('choice').notNull(),
}, t => [...links(t, 'ritual_ballot'), unique('ritual_ballot_once').on(t.poll, t.user), index('ritual_ballot_poll').on(t.poll),
  foreignKey({ columns: [t.team, t.config, t.poll], foreignColumns: [ritualPolls.team, ritualPolls.config, ritualPolls.id] }).onDelete('cascade'),
  check('ritual_ballot_choice', sql`${t.choice} BETWEEN 0 AND 9`)]);

// Planning records remain workflow-scoped; no private records or external data.
export const ritualCapacity = pgTable('ritual_capacity', {
  ...linked(), user: text('user_id').notNull(), week: text('week_start').notNull(),
  limit: integer('task_limit').notNull(), version: integer('version').notNull().default(1),
}, t => [...links(t, 'ritual_capacity'), unique('ritual_capacity_week').on(t.team, t.config, t.user, t.week),
  check('ritual_capacity_limit', sql`${t.limit} BETWEEN 0 AND 1000`)]);
export const ritualDecisions = pgTable('ritual_decisions', {
  ...linked(), user: text('creator_id').notNull(), owner: text('owner_id').notNull(),
  title: text('title').notNull(), detail: text('detail').notNull(), rationale: text('rationale').notNull(),
  review: text('review_date').notNull(), status: text('status').notNull().default('proposed'),
  version: integer('version').notNull().default(1),
}, t => [...links(t, 'ritual_decision'),
  check('ritual_decision_status', sql`${t.status} IN ('proposed','accepted','superseded')`)]);
export const ritualObjectives = pgTable('ritual_objectives', {
  ...linked(), user: text('creator_id').notNull(), owner: text('owner_id').notNull(), title: text('title').notNull(),
  start: text('start_date').notNull(), end: text('end_date').notNull(), status: text('status').notNull().default('active'),
  version: integer('version').notNull().default(1),
}, t => [...links(t, 'ritual_objective'), unique('ritual_objective_tenant').on(t.team, t.config, t.id),
  check('ritual_objective_dates', sql`${t.end} >= ${t.start}`),
  check('ritual_objective_status', sql`${t.status} IN ('active','closed')`)]);
export const ritualResults = pgTable('ritual_results', {
  ...linked(), objective: text('objective_id').notNull(), user: text('creator_id').notNull(), owner: text('owner_id').notNull(),
  title: text('title').notNull(), unit: text('unit').notNull(),
  baseline: doublePrecision('baseline').notNull(), current: doublePrecision('current_value').notNull(), target: doublePrecision('target').notNull(),
  version: integer('version').notNull().default(1),
}, t => [...links(t, 'ritual_result'), index('ritual_result_objective').on(t.objective, t.at, t.id),
  foreignKey({ columns: [t.team, t.config, t.objective], foreignColumns: [ritualObjectives.team, ritualObjectives.config, ritualObjectives.id] }).onDelete('cascade'),
  check('ritual_result_range', sql`abs(${t.baseline}) <= 1000000000 AND abs(${t.current}) <= 1000000000 AND abs(${t.target}) <= 1000000000 AND ${t.baseline} <> ${t.target}`)]);

// Coordination entities have separate tables and explicit visibility rules.
const requestFields = () => ({ user: text('creator_id').notNull(), owner: text('owner_id').notNull(),
  title: text('title').notNull(), detail: text('detail').notNull(), due: text('due_date').notNull(),
  status: text('status').notNull().default('pending'), version: integer('version').notNull().default(1) });
export const ritualApprovals = pgTable('ritual_approvals', {
  ...linked(), ...requestFields(), decision: text('decision_note'), decidedAt: ms('decided_at'),
}, t => [...links(t, 'ritual_approval'), index('ritual_approval_inbox').on(t.team, t.owner, t.status, t.at),
  check('ritual_approval_status', sql`${t.status} IN ('pending','approved','declined','cancelled')`),
  check('ritual_approval_separation', sql`${t.user} <> ${t.owner}`)]);
export const ritualLeaves = pgTable('ritual_leaves', {
  ...linked(), ...requestFields(), start: text('start_date').notNull(), end: text('end_date').notNull(),
  cover: text('cover_id').notNull(), decision: text('decision_note'), decidedAt: ms('decided_at'),
}, t => [...links(t, 'ritual_leave'), index('ritual_leave_coverage').on(t.team, t.config, t.status, t.start, t.end),
  check('ritual_leave_dates', sql`${t.start} <= ${t.end}`),
  check('ritual_leave_status', sql`${t.status} IN ('pending','approved','declined','cancelled')`),
  check('ritual_leave_separation', sql`${t.user} <> ${t.owner} AND ${t.user} <> ${t.cover}`)]);
export const ritualOnboarding = pgTable('ritual_onboarding', {
  ...linked(), user: text('creator_id').notNull(), owner: text('newcomer_id').notNull(), buddy: text('buddy_id').notNull(),
  title: text('title').notNull(), due: text('due_date').notNull(), status: text('status').notNull().default('active'),
  version: integer('version').notNull().default(1),
}, t => [...links(t, 'ritual_onboarding'), unique('ritual_onboarding_tenant').on(t.team, t.config, t.id),
  check('ritual_onboarding_status', sql`${t.status} IN ('active','completed','cancelled')`)]);
export const ritualSteps = pgTable('ritual_steps', {
  ...linked(), onboarding: text('onboarding_id').notNull(), user: text('creator_id').notNull(), owner: text('assignee_id').notNull(),
  detail: text('detail').notNull(), due: text('due_date').notNull(), status: text('status').notNull().default('open'),
  version: integer('version').notNull().default(1),
}, t => [...links(t, 'ritual_step'), index('ritual_step_parent').on(t.onboarding, t.at, t.id),
  foreignKey({ columns: [t.team, t.config, t.onboarding], foreignColumns: [ritualOnboarding.team, ritualOnboarding.config, ritualOnboarding.id] }).onDelete('cascade'),
  check('ritual_step_status', sql`${t.status} IN ('open','done')`)]);
export const ritualMeetings = pgTable('ritual_meetings', {
  ...linked(), user: text('creator_id').notNull(), owner: text('partner_id').notNull(), title: text('encrypted_title').notNull(),
  due: text('meeting_date').notNull(), status: text('status').notNull().default('active'), version: integer('version').notNull().default(1),
}, t => [...links(t, 'ritual_meeting'), unique('ritual_meeting_tenant').on(t.team, t.config, t.id),
  index('ritual_meeting_participants').on(t.team, t.user, t.owner, t.at),
  check('ritual_meeting_pair', sql`${t.user} <> ${t.owner}`), check('ritual_meeting_status', sql`${t.status} IN ('active','completed','cancelled')`)]);
export const ritualNotes = pgTable('ritual_notes', {
  ...linked(), meeting: text('meeting_id').notNull(), user: text('creator_id').notNull(), owner: text('assignee_id').notNull(),
  detail: text('encrypted_detail').notNull(), due: text('due_date').notNull(), status: text('status').notNull().default('open'),
  version: integer('version').notNull().default(1),
}, t => [...links(t, 'ritual_note'), index('ritual_note_parent').on(t.meeting, t.at, t.id),
  foreignKey({ columns: [t.team, t.config, t.meeting], foreignColumns: [ritualMeetings.team, ritualMeetings.config, ritualMeetings.id] }).onDelete('cascade'),
  check('ritual_note_status', sql`${t.status} IN ('open','done')`)]);
export const ritualHandoffs = pgTable('ritual_handoffs', {
  ...linked(), ...requestFields(), target: text('target_config_id').notNull(),
}, t => [...links(t, 'ritual_handoff'), index('ritual_handoff_target').on(t.team, t.target, t.at, t.id),
  foreignKey({ columns: [t.team, t.target], foreignColumns: [ritualConfigs.team, ritualConfigs.id] }).onDelete('cascade'),
  check('ritual_handoff_target_differs', sql`${t.config} <> ${t.target}`),
  check('ritual_handoff_status', sql`${t.status} IN ('pending','accepted','completed','declined','cancelled')`)]);
export const ritualEscalations = pgTable('ritual_escalations', {
  ...linked(), user: text('editor_id').notNull(), enabled: boolean('enabled').notNull().default(false),
  days: integer('age_days').notNull().default(2), version: integer('version').notNull().default(1),
}, t => [...links(t, 'ritual_escalation'), unique('ritual_escalation_once').on(t.team, t.config),
  check('ritual_escalation_age', sql`${t.days} BETWEEN 1 AND 30`)]);

export const ritualOauth = pgTable('ritual_oauth', {
  ...linked(), user: text('user_id').notNull(), provider: text('provider').notNull(),
  phase: text('phase').notNull(), browser: text('browser_hash'), verifier: text('encrypted_verifier'), used: boolean('used').notNull().default(false),
}, t => [...links(t, 'ritual_oauth'), check('ritual_oauth_provider', sql`${t.provider} IN ('github','jira','linear')`)]);
export const ritualConnections = pgTable('ritual_connections', {
  ...identity(), ...lifetime(), user: text('connected_by').notNull(), provider: text('provider').notNull(),
  credentials: text('encrypted_credentials').notNull(), version: integer('version').notNull().default(1),
}, t => [unique('ritual_connection_provider').on(t.team, t.provider), unique('ritual_connection_tenant').on(t.team, t.id),
  index('ritual_connection_expiry').on(t.expiresAt), check('ritual_connection_provider_valid', sql`${t.provider} IN ('github','jira','linear')`)]);
export const ritualMappings = pgTable('ritual_mappings', {
  ...linked(), connection: text('connection_id').notNull(), user: text('configured_by').notNull(),
  root: text('resource_id').notNull(), container: text('container_id').notNull(), label: text('label').notNull(),
}, t => [...links(t, 'ritual_mapping'), unique('ritual_mapping_once').on(t.team, t.config, t.connection), unique('ritual_mapping_tenant').on(t.team, t.config, t.id),
  foreignKey({ columns: [t.team, t.connection], foreignColumns: [ritualConnections.team, ritualConnections.id] }).onDelete('cascade')]);
export const ritualIssuelinks = pgTable('ritual_issuelinks', {
  ...linked(), mapping: text('mapping_id').notNull(), action: text('action_id').notNull(), remote: text('remote_id').notNull(),
  user: text('linked_by').notNull(), localStatus: text('last_local_status').notNull(), remoteStatus: text('last_remote_status').notNull(),
  version: integer('version').notNull().default(1), syncedAt: ms('synced_at').notNull(),
}, t => [...links(t, 'ritual_issuelink'), unique('ritual_issuelink_remote').on(t.mapping, t.remote), unique('ritual_issuelink_action').on(t.action),
  foreignKey({ columns: [t.team, t.config, t.mapping], foreignColumns: [ritualMappings.team, ritualMappings.config, ritualMappings.id] }).onDelete('cascade'),
  foreignKey({ columns: [t.team, t.config, t.action], foreignColumns: [ritualActions.team, ritualActions.config, ritualActions.id] }).onDelete('cascade')]);
