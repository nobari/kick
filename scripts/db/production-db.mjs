// Explicit production cutover target; rehearsal tooling retains its own guard.
export function productionConnection(env = process.env) {
  const url = new URL(env.DATABASE_URL_UNPOOLED || 'file:///missing');
  if (env.KICK_DB_BRANCH !== 'br-plain-union-awztoj84' ||
      url.hostname !== 'ep-muddy-pine-awoaob9z.c-12.us-east-1.aws.neon.tech' ||
      url.protocol !== 'postgresql:' || url.pathname !== '/neondb' ||
      url.searchParams.get('sslmode') !== 'verify-full') {
    throw new Error('Refusing operation: production target or verified TLS mismatch');
  }
  return url.href;
}
