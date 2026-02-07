import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const DEV_FALLBACK_KEY = randomBytes(32);

function getKey(): Buffer {
  const raw = process.env['PAPERT_ADMIN_ENC_KEY'];
  if (!raw) {
    return DEV_FALLBACK_KEY;
  }
  if (raw.length < 32) {
    return Buffer.from(raw.padEnd(32, '0'));
  }
  return Buffer.from(raw.slice(0, 32));
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const key = getKey();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
