/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type express from 'express';

import { createApp } from './app.js';
import { requestApp } from './test-utils.js';

describe('OpenAPI docs (disabled)', () => {
  let app: express.Express;

  const OLD_ENV = process.env;

  beforeEach(async () => {
    process.env = { ...OLD_ENV };
    process.env.PAPERT_REMOTE_ENABLED = '1';
    process.env.PAPERT_REMOTE_SERVER_TOKEN = 'test-token';
    process.env.PAPERT_REMOTE_SESSION_TTL_MS = '60000';
    process.env.NODE_ENV = 'test';
    delete process.env.PAPERT_REMOTE_DOCS_ENABLED;

    app = await createApp();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('GET /openapi.json returns 401 (remote auth enabled, docs not allowlisted)', async () => {
    const res = await requestApp(app, { method: 'GET', path: '/openapi.json' });
    expect(res.status).toBe(401);
  });

  it('GET /docs returns 401 (remote auth enabled, docs not allowlisted)', async () => {
    const res = await requestApp(app, { method: 'GET', path: '/docs' });
    expect(res.status).toBe(401);
  });
});
