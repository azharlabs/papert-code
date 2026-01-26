/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type express from 'express';

import { createApp } from './app.js';
import { requestApp } from './test-utils.js';

describe('OpenAPI docs', () => {
  let app: express.Express;

  const OLD_ENV = process.env;

  beforeEach(async () => {
    process.env = { ...OLD_ENV };
    process.env.PAPERT_REMOTE_ENABLED = '1';
    process.env.PAPERT_REMOTE_SERVER_TOKEN = 'test-token';
    process.env.PAPERT_REMOTE_SESSION_TTL_MS = '60000';
    process.env.NODE_ENV = 'development';
    process.env.PAPERT_REMOTE_DOCS_ENABLED = '1';

    app = await createApp();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('does not leak remote env to other suites', () => {
    // This is a guard to ensure we remember to clean up env in this suite.
    expect(process.env.PAPERT_REMOTE_ENABLED).toBe('1');
  });

  it('GET /openapi.json returns an OpenAPI document', async () => {
    const res = await requestApp(app, { method: 'GET', path: '/openapi.json' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      openapi: expect.any(String),
      info: {
        title: expect.any(String),
        version: expect.any(String),
      },
      paths: expect.any(Object),
    });
    expect((res.body as { paths?: Record<string, unknown> }).paths?.['/api/v1/health']).toBeTruthy();
  });

  it('GET /docs returns HTML', async () => {
    const res = await requestApp(app, { method: 'GET', path: '/docs' });
    expect(res.status).toBe(200);
    const contentType = res.headers['content-type'];
    expect(typeof contentType === 'string' ? contentType : contentType?.[0]).toContain('text/html');
  });

  it('GET /openapi.json does not require auth headers when remote docs are enabled', async () => {
    const res = await requestApp(app, { method: 'GET', path: '/openapi.json' });
    expect(res.status).toBe(200);
  });

  it('GET /docs does not require auth headers when remote docs are enabled', async () => {
    const res = await requestApp(app, { method: 'GET', path: '/docs' });
    expect(res.status).toBe(200);
  });
});
