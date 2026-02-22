import { afterEach, describe, expect, it } from 'vitest';
import { readAdminServerEnv } from './env.js';

const ORIGINAL_ENV = process.env;

describe('readAdminServerEnv', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('parses allowlist and cors origins from comma separated env vars', () => {
    process.env = {
      ...ORIGINAL_ENV,
      PAPERT_ADMIN_ALLOWLIST: 'admin@company.com,ops@company.com',
      PAPERT_ADMIN_CORS_ORIGINS: 'http://localhost:4173,https://admin.company.com',
    };

    const env = readAdminServerEnv();

    expect(env.allowlist.has('admin@company.com')).toBe(true);
    expect(env.allowlist.has('ops@company.com')).toBe(true);
    expect(env.corsOrigins.has('http://localhost:4173')).toBe(true);
    expect(env.corsOrigins.has('https://admin.company.com')).toBe(true);
  });

  it('defaults to empty cors and allowlist sets when vars are missing', () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env['PAPERT_ADMIN_ALLOWLIST'];
    delete process.env['PAPERT_ADMIN_USER_IDS'];
    delete process.env['PAPERT_ADMIN_CORS_ORIGINS'];

    const env = readAdminServerEnv();

    expect(env.allowlist.size).toBe(0);
    expect(env.corsOrigins.size).toBe(0);
    expect(env.sessionStorePath.endsWith('/data/sessions')).toBe(true);
  });

  it('uses explicit transcript directory when configured', () => {
    process.env = {
      ...ORIGINAL_ENV,
      PAPERT_ADMIN_SESSIONS_DIR: '/tmp/papert-admin-sessions',
    };

    const env = readAdminServerEnv();

    expect(env.sessionStorePath).toBe('/tmp/papert-admin-sessions');
  });
});
