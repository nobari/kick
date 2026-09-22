// Print a secret-free manifest for a SEPARATE staging app, never the published app.
import { pathToFileURL } from 'node:url';
export function reviewManifest(origin) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || ['kick.bozmoz.com', 'slack-kickbot.vercel.app'].includes(url.hostname))
    throw new Error('Provide a dedicated HTTPS staging origin, not the production domain.');
  const base = url.origin;
  return {
    display_information: { name: 'Kick Review', description: 'Team check-ins, blockers, appreciation, and fair rotations', background_color: '#11152a' },
    features: {
      bot_user: { display_name: 'Kick Review', always_online: false },
      app_home: { home_tab_enabled: true, messages_tab_enabled: true, messages_tab_read_only_enabled: true },
      slash_commands: [
        ['tsync', 'Check in, view reports, or configure team rituals'],
        ['tpick', 'Random pick or fair team rotation'],
        ['tkudos', 'Thank a teammate'], ['tcoins', 'Give virtual recognition'],
      ].map(([name, description]) => ({ command: `/${name}`, description, url: `${base}/api/slack/events`, usage_hint: '-h for help', should_escape: false })),
    },
    oauth_config: {
      redirect_urls: [`${base}/api/slack/oauth_redirect`],
      scopes: { bot: ['channels:history', 'channels:read', 'chat:write', 'chat:write.public', 'commands', 'users:read', 'im:write'] },
    },
    settings: {
      interactivity: { is_enabled: true, request_url: `${base}/api/slack/events` },
      event_subscriptions: { request_url: `${base}/api/slack/events`, bot_events: ['app_home_opened'] },
      org_deploy_enabled: false, socket_mode_enabled: false, token_rotation_enabled: false,
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(reviewManifest(process.argv[2]), null, 2)); }
  catch { console.error('Usage: pnpm slack:review-manifest https://YOUR-DEDICATED-REVIEW-HOST'); process.exitCode = 1; }
}
