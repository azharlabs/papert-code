/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runNonInteractiveStreamJson } from './session.js';
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

  it('creates remote session with server token, then swaps to session token + x-papert-session-id', async () => {
    process.env.PAPERT_REMOTE_URL = 'http://remote.example:41242';
    process.env.PAPERT_REMOTE_TOKEN = 'server-token-xyz';

    // 1) create session
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ sessionId: 'sid-remote', token: 'sess-token-remote' }),
      } as unknown as Response);

    const config = makeFakeConfig();

    // We don't actually run the full Session loop in this test.
    // Instead, we trigger the initialization side-effect by running with empty input.
    // The Session constructor is invoked and will not create an initial prompt.
    // The first control request (initialize) is not sent, so we also need to directly
    // call the private initializer in a full integration test.
    //
    // Minimal smoke: ensure the remote session is created and config is updated
    // by calling runNonInteractiveStreamJson with a non-empty initial prompt.
    // This will cause Session.handleFirstMessage(user) => ensureConfigInitialized.
    await runNonInteractiveStreamJson(config, 'hello');

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
      baseUrl: 'http://remote.example:41242',
      extraHeaders: {
        'x-papert-session-id': 'sid-remote',
      },
    });

    expect(config.refreshAuth).toHaveBeenCalledWith(AuthType.USE_OPENAI);
  });
});
