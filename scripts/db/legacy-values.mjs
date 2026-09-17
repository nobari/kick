import { createHash } from 'node:crypto';

export function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}
export function decodeValue(value) {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) {
    const integer = BigInt(value.integerValue);
    return integer <= BigInt(Number.MAX_SAFE_INTEGER) && integer >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(integer) : integer;
  }
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields);
  // Unsupported types cannot silently become strings or disappear.
  throw new Error('Unsupported legacy value type');
}
export function stableId(...parts) {
  const bytes = createHash('sha256').update(JSON.stringify(['kick-migration-v1', ...parts])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 0x50;
  bytes[8] = (bytes[8] & 63) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function requiredText(value) {
  if (typeof value !== 'string' || !value.length || value.includes('\0')) throw new Error('Invalid required legacy text');
  return value;
}
export function optionalText(value) {
  return value === false || value == null || value === '' ? null : requiredText(value);
}
export function instant(value, fallback) {
  const date = new Date(value == null ? fallback : value);
  if (!Number.isFinite(date.valueOf())) throw new Error('Invalid legacy timestamp');
  return date.toISOString();
}
