// CommonJS is required by the existing Bolt server and the migration CLI.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');

function keyBytes(value) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value || '')) throw new Error('Database encryption key must be 32 bytes in base64');
  return Buffer.from(value, 'base64');
}
function seal(value, context, key = process.env.KICK_DATA_KEY) {
  if (!context) throw new Error('Encryption context required');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(key), iv);
  cipher.setAAD(Buffer.from(`kick:v1:${context}`));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}
function unseal(value, context, key = process.env.KICK_DATA_KEY) {
  try {
    const [version, iv, tag, data, extra] = value.split('.');
    if (version !== 'v1' || extra !== undefined || !context) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', keyBytes(key), Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(`kick:v1:${context}`));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8'));
  } catch { throw new Error('Database credential authentication failed'); }
}
module.exports = { seal, unseal };
