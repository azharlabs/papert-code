/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type express from 'express';
import * as fs from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Storage } from '@papert-code/papert-code-core';
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
  let workspaceDir: string;

  const OLD_ENV = process.env;

  beforeEach(async () => {
    process.env = { ...OLD_ENV };
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'papert-a2a-webui-'));
    process.env['CODER_AGENT_WORKSPACE_PATH'] = workspaceDir;
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
    expect(res.text).toContain('Policy denied tool execution');
    expect(res.text).toContain('releaseChannelSelect');
    expect(res.text).toContain('/api/v1/webui/release-channel');
    expect(res.text).toContain('function sanitizeHtml(html)');
    expect(res.text).toContain('sessionStorage.getItem(serverTokenStorageKey)');
    expect(res.text).not.toContain('localStorage.getItem(serverTokenStorageKey)');
  });

  it('GET /api/v1/webui/catalog includes rewind points payload', async () => {
    const storage = new Storage(workspaceDir);
    const checkpointsDir = storage.getProjectTempCheckpointsDir();
    await fs.mkdir(checkpointsDir, { recursive: true });
    await fs.writeFile(
      path.join(checkpointsDir, 'rewind-point-1.json'),
      JSON.stringify(
        {
          toolCall: { name: 'write_file', args: { file_path: 'x.ts' } },
          commitHash: 'abc123',
        },
        null,
        2,
      ),
      'utf8',
    );

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
        releaseChannel: expect.any(String),
      }),
    );
    const catalogBody = catalogRes.body as {
      rewindPoints: Array<{ id: string; toolName: string; restoreType: string }>;
    };
    expect(catalogBody.rewindPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'rewind-point-1',
          toolName: 'write_file',
          restoreType: 'file+chat',
        }),
      ]),
    );
  });

  it('PUT /api/v1/webui/release-channel updates channel', async () => {
    const sessionRes = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/sessions',
      headers: { authorization: 'Bearer server-secret' },
    });
    expect(sessionRes.status).toBe(201);
    const body = sessionRes.body as { sessionId: string; token: string };

    const updateRes = await requestApp(app, {
      method: 'PUT',
      path: '/api/v1/webui/release-channel',
      headers: {
        authorization: `Bearer ${body.token}`,
        'x-papert-session-id': body.sessionId,
      },
      body: { releaseChannel: 'nightly' },
    });
    expect(updateRes.status).toBe(204);

    const catalogRes = await requestApp(app, {
      method: 'GET',
      path: '/api/v1/webui/catalog',
      headers: {
        authorization: `Bearer ${body.token}`,
        'x-papert-session-id': body.sessionId,
      },
    });
    expect(catalogRes.status).toBe(200);
    expect((catalogRes.body as { releaseChannel: string }).releaseChannel).toBe(
      'nightly',
    );
  });

  it('PUT /api/v1/webui/release-channel blocks nightly -> stable promotion', async () => {
    const sessionRes = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/sessions',
      headers: { authorization: 'Bearer server-secret' },
    });
    expect(sessionRes.status).toBe(201);
    const body = sessionRes.body as { sessionId: string; token: string };

    const toNightly = await requestApp(app, {
      method: 'PUT',
      path: '/api/v1/webui/release-channel',
      headers: {
        authorization: `Bearer ${body.token}`,
        'x-papert-session-id': body.sessionId,
      },
      body: { releaseChannel: 'nightly' },
    });
    expect(toNightly.status).toBe(204);

    const toStable = await requestApp(app, {
      method: 'PUT',
      path: '/api/v1/webui/release-channel',
      headers: {
        authorization: `Bearer ${body.token}`,
        'x-papert-session-id': body.sessionId,
      },
      body: { releaseChannel: 'stable' },
    });
    expect(toStable.status).toBe(400);
    expect((toStable.body as { code: string }).code).toBe('promotion_order');
  });

  it('PUT /api/v1/webui/release-channel enforces nightly soak before preview', async () => {
    const sessionRes = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/sessions',
      headers: { authorization: 'Bearer server-secret' },
    });
    expect(sessionRes.status).toBe(201);
    const body = sessionRes.body as { sessionId: string; token: string };

    const toNightly = await requestApp(app, {
      method: 'PUT',
      path: '/api/v1/webui/release-channel',
      headers: {
        authorization: `Bearer ${body.token}`,
        'x-papert-session-id': body.sessionId,
      },
      body: { releaseChannel: 'nightly' },
    });
    expect(toNightly.status).toBe(204);

    const toPreview = await requestApp(app, {
      method: 'PUT',
      path: '/api/v1/webui/release-channel',
      headers: {
        authorization: `Bearer ${body.token}`,
        'x-papert-session-id': body.sessionId,
      },
      body: { releaseChannel: 'preview' },
    });
    expect(toPreview.status).toBe(400);
    expect((toPreview.body as { code: string }).code).toBe('soak_not_met');
  });

  it('POST /api/v1/webui/agents rejects missing name', async () => {
    const sessionRes = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/sessions',
      headers: { authorization: 'Bearer server-secret' },
    });
    expect(sessionRes.status).toBe(201);
    const body = sessionRes.body as { sessionId: string; token: string };

    const res = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/webui/agents',
      headers: {
        authorization: `Bearer ${body.token}`,
        'x-papert-session-id': body.sessionId,
      },
      body: { content: '# test' },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'name is required.' });
  });

  it('POST /api/v1/webui/mcps rejects non-object config', async () => {
    const sessionRes = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/sessions',
      headers: { authorization: 'Bearer server-secret' },
    });
    expect(sessionRes.status).toBe(201);
    const body = sessionRes.body as { sessionId: string; token: string };

    const res = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/webui/mcps',
      headers: {
        authorization: `Bearer ${body.token}`,
        'x-papert-session-id': body.sessionId,
      },
      body: { name: 'broken-mcp', config: 'nope' },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'config must be an object.' });
  });

  it('POST /api/v1/webui/schedules rejects unknown fields', async () => {
    const sessionRes = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/sessions',
      headers: { authorization: 'Bearer server-secret' },
    });
    expect(sessionRes.status).toBe(201);
    const body = sessionRes.body as { sessionId: string; token: string };

    const res = await requestApp(app, {
      method: 'POST',
      path: '/api/v1/webui/schedules',
      headers: {
        authorization: `Bearer ${body.token}`,
        'x-papert-session-id': body.sessionId,
      },
      body: {
        name: 'Daily',
        schedule: { kind: 'every', everyMs: 60000 },
        payload: {},
        extra: true,
      },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Unknown field(s): extra' });
  });
});
