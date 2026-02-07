import { afterEach, describe, expect, it } from 'vitest';
import { getJwtSecret } from './auth.js';
import { decryptSecret, encryptSecret } from './crypto.js';

const ORIGINAL_ENV = process.env;

describe('security config fallbacks', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('uses configured jwt secret when provided', () => {
    process.env = {
      ...ORIGINAL_ENV,
      PAPERT_ADMIN_JWT_SECRET: 'configured-secret',
    };
    expect(getJwtSecret()).toBe('configured-secret');
  });

  it('uses a non-empty dev fallback jwt secret when unset', () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env['PAPERT_ADMIN_JWT_SECRET'];
    const secret = getJwtSecret();
    expect(secret.length).toBeGreaterThanOrEqual(32);
  });

  it('encrypts and decrypts secrets with configured key', () => {
    process.env = {
      ...ORIGINAL_ENV,
      PAPERT_ADMIN_ENC_KEY: '12345678901234567890123456789012',
    };
    const encrypted = encryptSecret('hello');
    expect(decryptSecret(encrypted)).toBe('hello');
  });
});
