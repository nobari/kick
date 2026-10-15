// Merge ONLY this property into the existing app's features. Never replace the
// whole manifest or change published scopes/redirects using a command fragment.
import catalog from '../server/rituals/command-catalog.js';
console.log(JSON.stringify({ slash_commands: catalog.commands.map(({ name, description, usage }) => ({
  command: `/${name}`, description, usage_hint: usage,
  url: 'https://kick.bozmoz.com/api/slack/events', should_escape: false,
})) }, null, 2));
