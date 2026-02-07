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

describe('Web UI', () => {
  let app: express.Express;

  const OLD_ENV = process.env;

  beforeEach(async () => {
    process.env = { ...OLD_ENV };
    process.env['NODE_ENV'] = 'test';
    process.env['PAPERT_WEB_UI_ENABLED'] = '1';
    process.env['PAPERT_REMOTE_ENABLED'] = '1';
    process.env['PAPERT_REMOTE_SERVER_TOKEN'] = 'server-secret';
    process.env['PAPERT_REMOTE_SESSION_TTL_MS'] = '60000';

    app = await createApp();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('GET / serves the web UI html', async () => {
    const res = await requestApp(app, { method: 'GET', path: '/' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Papert Code Web</title>');
    expect(res.text).toContain('/rewind');
    expect(res.text).toContain('/mcp diagnose');
    expect(res.text).toContain('/github status');
    expect(res.text).toContain('/listCommands');
    expect(res.text).toContain('view-rewind');
  });

  it('GET /api/v1/webui/catalog includes rewind points payload', async () => {
    const sessionRes = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/sessions',
      headers: { authorization: 'Bearer server-secret' },
    });
    expect(sessionRes.status).toBe(201);

    const body = sessionRes.body as { sessionId: string; token: string };
    const catalogRes = await requestApp(app, {
      method: 'GET',
      path: '/api/v1/webui/catalog',
      headers: {
        authorization: `Bearer ${body.token}`,
        'x-papert-session-id': body.sessionId,
      },
    });

    expect(catalogRes.status).toBe(200);
    expect(catalogRes.body).toEqual(
      expect.objectContaining({
        rewindPoints: expect.any(Array),
      }),
    );
  });
});
