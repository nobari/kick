// No Slack credentials or team data live here. Only the scheduler bearer secret.
export async function tick(env, request = fetch) {
  if (!env.CRON_SECRET || env.CRON_SECRET.length < 32) throw new Error('Scheduler secret missing');
  const response = await request('https://kick.bozmoz.com/api/cron/rituals', {
    method: 'GET', headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    redirect: 'error', signal: AbortSignal.timeout(55000),
  });
  // Never log response bodies or authorization headers.
  if (!response.ok) throw new Error(`Kick scheduler HTTP ${response.status}`);
  const result = await response.json();
  if (result.failed) throw new Error('Kick scheduler reported failed operations');
  return { configurations: result.configurations, sent: result.sent };
}
const worker = {
  async scheduled(_event, env) { await tick(env); },
  fetch() { return new Response('Not found', { status: 404 }); },
};
export default worker;
