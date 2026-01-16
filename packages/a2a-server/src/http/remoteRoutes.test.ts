/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('Remote driving control plane', () => {
  let app: express.Express;

  beforeAll(async () => {
    process.env['PAPERT_REMOTE_ENABLED'] = '1';
    process.env['PAPERT_REMOTE_SERVER_TOKEN'] = 'server-secret';
    process.env['PAPERT_REMOTE_SESSION_TTL_MS'] = '60000';
  });

  beforeEach(async () => {
    app = await createApp();
  });

  it('GET /api/v1/health returns ok', async () => {
    const res = await requestApp(app, { method: 'GET', path: '/api/v1/health' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('POST /api/v1/sessions requires server token', async () => {
    const res = await requestApp(app, { method: 'POST', path: '/api/v1/sessions' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/sessions returns sessionId + token with correct server token', async () => {
    const res = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/sessions',
      headers: { authorization: 'Bearer server-secret' },
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      sessionId: expect.any(String),
      token: expect.any(String),
      workspaceRoot: expect.any(String),
      expiresAtMs: expect.any(Number),
    });
  });

  it('second session conflicts while lock is held; release frees it', async () => {
    const first = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/sessions',
      headers: { authorization: 'Bearer server-secret' },
    });
    expect(first.status).toBe(201);

    const second = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/sessions',
      headers: { authorization: 'Bearer server-secret' },
    });
    expect(second.status).toBe(409);

    const { sessionId, token } = first.body as { sessionId: string; token: string };

    const release = await requestApp(app, {
      method: 'POST',
      path: `/api/v1/sessions/${sessionId}/release`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(release.status).toBe(204);

    const third = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/sessions',
      headers: { authorization: 'Bearer server-secret' },
    });
    expect(third.status).toBe(201);
  });

  it('A2A endpoints require session headers when remote is enabled', async () => {
    const res = await requestApp(app, {
      method: 'POST',
      path: '/',
      body: {
        jsonrpc: '2.0',
        id: '1',
        method: 'message/stream',
        params: {
          message: {
            kind: 'message',
            role: 'user',
            parts: [{ kind: 'text', text: 'hello' }],
            messageId: 'm1',
          },
          metadata: {
            coderAgent: {
              kind: 'agent-settings',
              workspacePath: '/tmp',
            },
          },
        },
      },
    });

    expect(res.status).toBe(401);
  });
});
