/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  RemoteControlApiClient,
  RemoteControlApiError,
} from '../../src/generated/remoteControlApiClient.js';

function createMockResponse(options: {
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
  contentType?: string;
}): Response {
  const contentType = options.contentType ?? 'application/json';
  return {
    ok: options.ok,
    status: options.status,
    statusText: options.statusText,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? contentType : null,
    } as Headers,
    json: async () => options.body,
    text: async () =>
      typeof options.body === 'string'
        ? options.body
        : options.body === undefined
          ? ''
          : JSON.stringify(options.body),
  } as unknown as Response;
}

describe('RemoteControlApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates remote session with bearer token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        status: 201,
        statusText: 'Created',
        body: {
          sessionId: 'sid-1',
          token: 'session-token',
          expiresAtMs: 123,
          workspaceRoot: '/workspace',
        },
      }),
    );

    const client = new RemoteControlApiClient({ baseUrl: 'http://localhost:41242' });
    const created = await client.createRemoteSession('server-token');

    expect(created.sessionId).toBe('sid-1');
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL('/api/v1/sessions', 'http://localhost:41242'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: 'Bearer server-token',
        },
      }),
    );
  });

  it('sends session headers for catalog endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: { releaseChannel: 'stable', tools: [] },
      }),
    );

    const client = new RemoteControlApiClient({ baseUrl: 'http://localhost:41242' });
    const catalog = await client.getWebUiCatalog({
      sessionId: 'sid-1',
      sessionToken: 'session-token',
    });

    expect(catalog.releaseChannel).toBe('stable');
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL('/api/v1/webui/catalog', 'http://localhost:41242'),
      expect.objectContaining({
        method: 'GET',
        headers: {
          authorization: 'Bearer session-token',
          'x-papert-session-id': 'sid-1',
        },
      }),
    );
  });

  it('throws typed RemoteControlApiError on non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createMockResponse({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        body: { error: 'Workspace is already in use.', code: 'WORKSPACE_LOCKED' },
      }),
    );

    const client = new RemoteControlApiClient({ baseUrl: 'http://localhost:41242' });

    await expect(client.createRemoteSession('token')).rejects.toMatchObject({
      name: 'RemoteControlApiError',
      status: 409,
      statusText: 'Conflict',
      body: { error: 'Workspace is already in use.', code: 'WORKSPACE_LOCKED' },
    } satisfies Partial<RemoteControlApiError>);
  });
});
