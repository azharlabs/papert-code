/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Config } from '@papert-code/papert-code-core';
import { AuthType } from '@papert-code/papert-code-core';

function makeFakeConfig(): Config {
  const cfg: Partial<Config> & {
    _creds?: any;
  } = {};

  cfg.getDebugMode = () => false;
  cfg.getSessionId = () => 'local-session';
  cfg.getEnableHooks = () => false;
  cfg.getMessageBus = () => null as any;
  cfg.getResumedSessionData = () => undefined;
  cfg.getIncludePartialMessages = () => false;

  // Key methods used by stream-json session init
  cfg.updateCredentials = (creds: any) => {
    cfg._creds = creds;
  };
  cfg.refreshAuth = vi.fn(async (_method: AuthType) => undefined) as any;
  cfg.initialize = vi.fn(async () => undefined) as any;

  return cfg as Config;
}

describe('stream-json remote driving init', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it(
    'creates remote session with server token, then swaps to session token + x-papert-session-id',
    async () => {
    process.env['PAPERT_REMOTE_URL'] = 'http://remote.example:41242';
    process.env['PAPERT_REMOTE_TOKEN'] = 'server-token-xyz';
    process.env['PAPERT_REMOTE_ALLOW_INSECURE_HTTP'] = '1';

    // Ensure we never hit the network in this test.
    // Session initialization uses global fetch; we stub it below.

    // 1) create session
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ sessionId: 'sid-remote', token: 'sess-token-remote' }),
      }) as unknown as Response);

    const config = makeFakeConfig();

    // We only want to validate the initialization side-effect (remote session
    // creation + credential swap). Running the full stream-json session loop
    // would block waiting for stdin control messages.
    //
    // Trigger the initializer by calling the private method directly.
    const { Session } = await import('./session.js');
    const manager = new Session(config as any);
    await (manager as any).ensureConfigInitialized();

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL('/api/v1/sessions', 'http://remote.example:41242'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: 'Bearer server-token-xyz',
        },
      }),
    );

    expect((config as any)._creds).toEqual({
      apiKey: 'sess-token-remote',
      baseUrl: 'http://remote.example:41242/',
      extraHeaders: {
        'x-papert-session-id': 'sid-remote',
      },
    });

    expect(config.refreshAuth).toHaveBeenCalledWith(AuthType.USE_OPENAI);
  }, 15_000);

  it(
    'uses existing remote session credentials when provided (skips session creation)',
    async () => {
      process.env['PAPERT_REMOTE_URL'] = 'http://remote.example:41242';
      process.env['PAPERT_REMOTE_SESSION_ID'] = 'sid-existing';
      process.env['PAPERT_REMOTE_SESSION_TOKEN'] = 'sess-token-existing';

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async () => {
          throw new Error('fetch should not be called');
        });

      const config = makeFakeConfig();
      const { Session } = await import('./session.js');
      const manager = new Session(config as any);
      await (manager as any).ensureConfigInitialized();

      expect(fetchSpy).not.toHaveBeenCalled();

      expect((config as any)._creds).toEqual({
        apiKey: 'sess-token-existing',
        baseUrl: 'http://remote.example:41242',
        extraHeaders: {
          'x-papert-session-id': 'sid-existing',
        },
      });

      expect(config.refreshAuth).toHaveBeenCalledWith(AuthType.USE_OPENAI);
    },
    15_000,
  );
});
