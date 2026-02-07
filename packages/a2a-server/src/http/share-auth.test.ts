/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type express from 'express';
import { createApp } from './app.js';
import { requestApp } from './test-utils.js';

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../config/config.js', async () => {
  const actual = await vi.importActual('../config/config.js');
  const { createMockConfig } = await vi.importActual(
    '../utils/testing_utils.js',
  );
  return {
    ...actual,
    loadConfig: vi.fn().mockImplementation(async () => createMockConfig({})),
  };
});

describe('Share auth fallback', () => {
  let app: express.Express;
  const OLD_ENV = process.env;

  beforeEach(async () => {
    process.env = { ...OLD_ENV };
    process.env['NODE_ENV'] = 'test';
    process.env['PAPERT_REMOTE_ENABLED'] = '1';
    process.env['PAPERT_REMOTE_SERVER_TOKEN'] = 'server-secret';
    delete process.env['PAPERT_SHARE_TOKEN'];
    app = await createApp();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('requires auth for creating shares when only remote server token is configured', async () => {
    const unauthRes = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/share',
      body: { payload: { message: 'hello' } },
    });
    expect(unauthRes.status).toBe(401);

    const authRes = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/share',
      headers: { authorization: 'Bearer server-secret' },
      body: { payload: { message: 'hello' } },
    });
    expect(authRes.status).toBe(201);
    expect(authRes.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        url: expect.any(String),
        secret: expect.any(String),
      }),
    );
  });
});
