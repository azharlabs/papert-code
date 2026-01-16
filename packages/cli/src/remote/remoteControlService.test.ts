/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRemoteControlService } from './remoteControlService.js';

describe('createRemoteControlService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs /api/v1/sessions with server token and returns remote session info', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ sessionId: 'sid-1', token: 'sess-token-1' }),
      } as unknown as Response);

    const control = await createRemoteControlService({
      baseUrl: 'http://localhost:41242',
      serverToken: 'server-token-abc',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL('/api/v1/sessions', 'http://localhost:41242'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: 'Bearer server-token-abc',
        },
      }),
    );

    expect((control as unknown as any).remote).toEqual({
      baseUrl: 'http://localhost:41242',
      sessionId: 'sid-1',
      token: 'sess-token-1',
    });
  });

  it('throws on non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as unknown as Response);

    await expect(
      createRemoteControlService({
        baseUrl: 'http://localhost:41242',
        serverToken: 'bad-token',
      }),
    ).rejects.toThrow(/Failed to create remote session/);
  });
});
