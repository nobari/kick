// Deterministic listing artwork from Kick's real Block Kit rendering functions.
// No credentials, database connection, Slack messages or production mutations.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ui, registerRituals } = require('../server/rituals/slack');
const { registerProductivity } = require('../server/rituals/productivity-slack');
const { registerCollaboration } = require('../server/rituals/collaboration-slack');
const { createProductivity } = require('../server/rituals/productivity');
const target = resolve('output/slack-listing/october-2026');
await mkdir(target, { recursive: true });
const logo = `data:image/png;base64,${(await readFile('public/assets/img/logo.png')).toString('base64')}`;
const c = { id: 'demo-workflow', team: 'DEMO', name: 'Daily standup', channel: 'DEMOCHANNEL', owner: 'PRODUCT', retentionDays: 30, zone: 'UTC', time: '09:00', digestTime: '11:00', members: ['PRODUCT', 'DESIGN', 'ENGINEERING'], questions: ['What did you finish?', 'What is next?'], enabled: true };
const ctx = { team: 'DEMO', user: 'PRODUCT', config: c.id };
const members = { PRODUCT: 'Product lead', DESIGN: 'Design lead', ENGINEERING: 'Engineering lead' };
const noop = () => {};
const app = { action: noop, view: noop }, engine = {};
const { render: work } = registerProductivity({ app, store: {}, engine, service: () => ({}), ui });
const { render: collaboration } = registerCollaboration({ app, bolt: { shortcut: noop }, store: {}, engine, ui });
const actions = [
  { id: 'a', detail: 'Prepare the release demo', due: '2026-10-02', owner: 'PRODUCT', status: 'open' },
  { id: 'b', detail: 'Review the onboarding screens', due: '2026-10-02', owner: 'DESIGN', status: 'open' },
  { id: 'c', detail: 'Confirm the launch checklist', due: '2026-10-01', owner: 'ENGINEERING', status: 'done' },
];
const personal = [
  { id: 't1', detail: 'Read the onboarding guide', due: '2026-10-02', status: 'open' },
  { id: 't2', detail: 'Prepare questions for the demo', due: '2026-10-02', status: 'open' },
  { id: 't3', detail: 'Review this week’s priorities', due: '2026-10-01', status: 'done' },
];
const stats = { runs: { total: 5, expected: 25 }, responses: { total: 23, people: 5 }, blockers: { total: 4, open: 1 }, actions: { total: 8, done: 6, overdue: 1 }, sprints: { total: 1, closed: 0 }, recognition: { total: 9, people: 5 }, retros: { total: 1, closed: 1 }, topics: { total: 6 }, poker: { total: 3, closed: 2 }, polls: { total: 2, closed: 1 }, ballots: { total: 10 } };
const reportAPI = createProductivity({ report: async () => stats }, {}, { access: async () => c, clock: () => Date.parse('2026-10-01T11:00:00Z') });
const api = { channel: async () => c, access: async () => c, list: async () => actions, todos: async () => personal,
  pollDetail: async () => ({ title: 'Which day works best for the team demo?', options: ['Tuesday', 'Wednesday', 'Thursday'], counts: [2, 1, 5], myChoice: 2, status: 'open', canClose: false }),
  report: (ctx, filters) => reportAPI.report(ctx, filters) };

// Capture the actual scheduled check-in view through its registered handler.
const handlers = [];
registerRituals({ action: (pattern, handler) => handlers.push({ pattern, handler }), event: noop, view: noop, use: noop, shortcut: noop },
  { get: async () => null }, { config: async () => c, currentRun: async () => ({ members: c.members, questions: c.questions }) });
let checkin;
const completed = new Promise(resolve => {
  const client = { conversations: { info: async () => ({ channel: { is_private: false, is_archived: false } }), members: async () => ({ members: c.members }) }, views: { open: async () => ({ view: { id: 'preview' } }), update: async ({ view }) => { checkin = view; resolve(); } } };
  const handler = handlers.find(h => h.pattern instanceof RegExp && h.pattern.test('ritual_checkin'));
  handler.handler({ ack: async () => {}, action: { action_id: 'ritual_checkin', value: c.id }, body: { team: { id: c.team }, user: { id: 'PRODUCT' }, trigger_id: 'demo' }, client });
});
await completed;
if (checkin.callback_id !== 'ritual_checkin_save') throw new Error('Failed to capture the actual check-in form');
const answers = { q0: 'Finished the onboarding flow and reviewed the release checklist.', q1: 'Prepare the team demo and test the final screens.', blocker: 'Need access to the staging workspace.' };
for (const b of checkin.blocks) if (b.type === 'input') {
  if (answers[b.block_id]) b.element.initial_value = answers[b.block_id];
  if (b.block_id === 'helper') b.element.initial_user = 'ENGINEERING';
}

const htmlEscape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function markdown(s) {
  return htmlEscape(s).replace(/&lt;@([^&]+)&gt;/g, (_, id) => `<span class="mention">@${members[id] || 'Teammate'}</span>`)
    .replace(/&lt;#([^&]+)&gt;/g, '<span class="mention"># team-updates</span>')
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>').replaceAll('\n', '<br>');
}
function control(e) {
  if (e.type === 'button') return `<button>${htmlEscape(e.text.text)}</button>`;
  if (e.type === 'static_select') return `<div class="select">${htmlEscape(e.initial_option?.text.text || e.options[0].text.text)}<span>⌄</span></div>`;
  if (e.type === 'datepicker') return `<div class="select">${htmlEscape(e.initial_date || 'Select a date')}<span>▦</span></div>`;
  if (e.type === 'users_select') return `<div class="select"><span>${htmlEscape(members[e.initial_user] || 'Select a person')}</span><span>⌄</span></div>`;
  if (e.type === 'plain_text_input') return `<div class="field ${e.multiline ? 'multiline' : ''}">${htmlEscape(e.initial_value || '')}</div>`;
  throw new Error(`Unrendered control: ${e.type}`);
}
function block(b) {
  if (b.type === 'section') return `<div class="section ${b.accessory ? 'accessory' : ''}"><div>${markdown(b.text.text)}</div>${b.accessory ? control(b.accessory) : ''}</div>`;
  if (b.type === 'context') return `<div class="context">${b.elements.map(e => htmlEscape(e.text)).join(' ')}</div>`;
  if (b.type === 'actions') return `<div class="actions">${b.elements.map(control).join('')}</div>`;
  if (b.type === 'input') return `<div class="input"><label>${htmlEscape(b.label.text)}</label>${control(b.element)}</div>`;
  throw new Error(`Unrendered block: ${b.type}`);
}
const slides = [
  { file: '01-check-ins', tag: 'ASYNC CHECK-INS', title: 'Less chasing.<br>More doing.', sub: 'Share progress, flag a blocker,<br>and name someone who can help.', benefit: 'A clear update. A clear next step.', path: 'Kick Home → Share update', view: checkin, theme: 'orange' },
  { file: '02-channel-todos', tag: 'SHARED CHANNEL TO-DOS', title: 'Give every<br>next step<br>an owner.', sub: 'Turn team updates into assigned<br>work with a due date and a status.', benefit: 'Shared with your channel. Easy to follow.', path: 'Team workspace → Channel to-dos', view: await collaboration(api, ctx, 'actions', { c: c.id }), theme: 'light' },
  { file: '03-personal-todos', tag: 'PRIVATE PERSONAL TO-DOS', title: 'Your list.<br>Your space.', sub: 'Keep personal tasks separate<br>from shared team work.', benefit: 'Only you can view this list in Kick.', path: 'Kick Home → My personal to-dos', view: await work(api, ctx, 'todos', {}), theme: 'navy' },
  { file: '04-polls', tag: 'CHANNEL POLLS', title: 'Ask once.<br>Hear the<br>whole team.', sub: 'Offer a few choices.<br>Let each person have a say.', benefit: 'One vote each. Change it while open.', path: 'Team workspace → Polls → Vote / results', view: await work(api, ctx, 'poll', { c: c.id, id: 'demo-poll' }), theme: 'orange' },
  { file: '05-reports', tag: 'COMPREHENSIVE REPORTS', title: 'See the week.<br>Choose what<br>comes next.', sub: 'Check-ins, blockers, tasks and<br>decisions in one workflow report.', benefit: 'Preview first. Share when you’re ready.', path: 'Team workspace → Comprehensive report', view: await work(api, ctx, 'report_result', { c: c.id, from: '2026-09-25', to: '2026-10-01' }), theme: 'light', report: true },
];
const css = `
*{box-sizing:border-box}html,body{margin:0;width:1600px;height:1000px;overflow:hidden}body{font-family:Arial,Helvetica,sans-serif;color:#191925;background:#f0f2f6;-webkit-font-smoothing:antialiased}.slide{width:1600px;height:1000px;position:relative;background:#f0f2f6}.copy{position:absolute;inset:0 auto 0 0;width:572px;padding:65px 58px 60px 68px;background:#f0f2f6}.orange .copy{background:#ff8b3e}.navy .copy{background:#17172b;color:#fff}.brand{display:flex;align-items:center;gap:15px;font-size:43px;font-family:'Arial Rounded MT Bold',Arial,sans-serif;font-weight:800;letter-spacing:-2px}.brand img{width:58px;height:58px;object-fit:contain}.tag{font-size:17px;letter-spacing:2px;font-weight:800;margin-top:87px}.copy h1{font-family:'Arial Rounded MT Bold',Arial,sans-serif;font-size:69px;line-height:1.06;letter-spacing:-3.2px;margin:26px 0 29px;font-weight:800}.copy .sub{font-size:24px;line-height:1.52;letter-spacing:-.3px;margin:0}.benefit{position:absolute;bottom:161px;left:68px;right:48px;font-size:21px;line-height:1.4;font-weight:700;padding-top:23px;border-top:1px solid #19192540}.navy .benefit{border-color:#ffffff50}.foot{position:absolute;bottom:60px;left:68px;font-size:18px;line-height:1.7}.foot small{font-size:14px;opacity:.75}.frame{position:absolute;left:614px;top:70px;width:934px;height:826px;background:#fff;border-radius:13px;overflow:hidden;box-shadow:0 20px 48px #1615281c;border:1px solid #d4d6db}.top{height:43px;background:#36203c;display:flex;align-items:center;padding:0 18px;color:#eee;font-size:14px;gap:20px}.search{background:#ffffff21;width:430px;text-align:center;border-radius:5px;padding:5px;margin:auto}.workspace{position:absolute;top:43px;bottom:0;width:162px;background:#f0e9f1;padding:23px 16px;font-size:16px;color:#4b354f}.workspace strong{display:block;color:#241327;font-size:18px;margin-bottom:33px}.workspace p{margin:17px 0}.workspace .active{background:#d7c9db;border-radius:4px;padding:9px;margin:0 -6px;color:#241327;font-weight:700}.workspace .group{font-size:13px;font-weight:700;margin-top:32px;color:#79667d}.surface{position:absolute;top:43px;left:162px;right:0;bottom:0;background:#f4f4f5}.app-head{height:87px;background:white;padding:17px 22px;border-bottom:1px solid #ddd;font-size:19px;font-weight:700}.app-head img{width:25px;height:25px;vertical-align:middle;margin-right:8px}.tabs{font-size:14px;font-weight:400;margin-top:12px;color:#626166;word-spacing:19px}.dim{position:absolute;inset:87px 0 0;background:#e5e4e7}.modal{position:absolute;top:23px;left:32px;right:32px;bottom:23px;background:white;border-radius:9px;border:1px solid #d7d5d9;box-shadow:0 8px 30px #00000018;display:flex;flex-direction:column}.modal-head{padding:21px 24px 18px;font-size:25px;font-weight:750;display:flex;justify-content:space-between;border-bottom:1px solid #ecebed}.modal-head span{font-size:24px;color:#646167;font-weight:400}.blocks{padding:8px 24px 14px;overflow:hidden;flex:1;font-size:17px;line-height:1.45}.section{padding:12px 0}.accessory{display:flex;align-items:center;justify-content:space-between;gap:14px;border-top:1px solid #eee;padding:20px 0}.accessory button{flex-shrink:0}.context{font-size:13px;line-height:1.45;color:#67636b;padding:9px 0}.actions{display:flex;gap:8px;flex-wrap:wrap;padding:9px 0}button{font-family:Arial,sans-serif;border:1px solid #a8a5ab;background:white;border-radius:5px;padding:8px 13px;font-size:15px;font-weight:700;line-height:20px;color:#27252a}.input{margin-top:17px}.input label{display:block;font-size:16px;font-weight:700;margin-bottom:7px}.field,.select{border:1px solid #86818b;border-radius:5px;padding:10px 12px;min-height:43px;font-size:16px;line-height:1.35}.multiline{min-height:65px}.select{display:flex;justify-content:space-between;align-items:center}.mention{color:#1264a3;background:#eaf2f8;padding:1px 3px;border-radius:3px}.modal-foot{padding:14px 24px;border-top:1px solid #e6e5e7;display:flex;justify-content:flex-end;gap:10px}.modal-foot .submit{color:white;background:#007a5a;border-color:#007a5a;min-width:93px}.path{position:absolute;left:616px;top:921px;font-size:17px;color:#565261}.report .blocks{font-size:15px;line-height:1.38}.report .section{padding:8px 0}.report .context{font-size:12px}.report .modal{top:10px;bottom:10px}.report .modal-head{font-size:23px}.report .blocks>.section:nth-last-of-type(3){font-size:12px}.proof{position:absolute;right:53px;bottom:23px;color:#6a6671;font-size:13px}
`;
const fitCSS = `.input{margin-top:13px}.multiline{min-height:60px}.report .blocks{font-size:15.5px;line-height:1.35}.report .section{padding:7px 0}.report .context{font-size:11px}.report .blocks>.section:nth-last-of-type(3){font-size:11px}`;
for (const s of slides) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Kick — ${htmlEscape(s.tag)}</title><style>${css}</style></head><body><main class="slide ${s.theme} ${s.report ? 'report' : ''}"><section class="copy"><div class="brand"><img src="${logo}" alt="Kick">Kick</div><div class="tag">${s.tag}</div><h1>${s.title}</h1><p class="sub">${s.sub}</p><div class="benefit">${s.benefit}</div><div class="foot">Made for teamwork in Slack.<br><small>kick.bozmoz.com</small></div></section><section class="frame"><div class="top"><span>← &nbsp; →</span><div class="search">Search Example workspace</div><span>?</span></div><aside class="workspace"><strong>Example<br>workspace ⌄</strong><p>Threads</p><p>Activity</p><p>Later</p><div class="group">Channels</div><p># team-updates</p><p># product</p><div class="group">Apps</div><p class="active">Kick</p></aside><div class="surface"><div class="app-head"><img src="${logo}" alt="">Kick<div class="tabs">Home Messages About</div></div><div class="dim"><div class="modal"><div class="modal-head">${htmlEscape(s.view.title.text)}<span>×</span></div><div class="blocks">${s.view.blocks.map(block).join('')}</div><div class="modal-foot"><button>${htmlEscape(s.view.close.text)}</button>${s.view.submit ? `<button class="submit">${htmlEscape(s.view.submit.text)}</button>` : ''}</div></div></div></div></section><div class="path">${htmlEscape(s.path)}</div><div class="proof">Illustrative UI · sample data</div></main></body></html>`;
  await writeFile(resolve(target, `${s.file}.html`), html.replace('</style>', `${fitCSS}</style>`));
}
await writeFile(resolve(target, 'manifest.json'), JSON.stringify({ width: 1600, height: 1000, format: 'PNG', maxBytes: 2000000, provenance: 'Illustrative Slack-context layouts rendered from production Kick Block Kit functions with synthetic data. Not live Slack captures.', slides: slides.map(({ file, tag, path }) => ({ file: `${file}.png`, title: tag, path })) }, null, 2) + '\n');
console.log(`Generated ${slides.length} deterministic layouts in ${target}`);
