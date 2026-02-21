/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

describe('connect command', () => {
  const originalEnv = process.env;
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.exit = vi.fn() as unknown as typeof process.exit;
  });

  afterEach(() => {
    process.env = originalEnv;
    process.exit = originalExit;
  });

  it('spawns CLI with remote server URL and token', async () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const onSpy = vi.spyOn(child, 'on');
    const spawnMock = vi.fn().mockReturnValue(child as any);

    const connectModule = await import('./connect.js');
    connectModule.__setSpawnForConnect(spawnMock as any);

    await connectModule.connectCommand.handler?.({
      url: 'http://127.0.0.1:41242',
      token: 'server-token-1',
    } as any);

    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      [process.argv[1]!],
      expect.objectContaining({
        env: expect.objectContaining({
          PAPERT_REMOTE_URL: 'http://127.0.0.1:41242/',
          PAPERT_REMOTE_TOKEN: 'server-token-1',
          PAPERT_REMOTE_ALLOW_INSECURE_HTTP: '0',
        }),
      }),
    );
    expect(onSpy).toHaveBeenCalledWith('close', expect.any(Function));

    connectModule.__resetSpawnForConnect();
  });

  it('rejects insecure non-local HTTP unless explicitly allowed', async () => {
    const connectModule = await import('./connect.js');
    await expect(
      connectModule.connectCommand.handler?.({
        url: 'http://remote.example:41242',
        token: 'server-token-1',
      } as any),
    ).rejects.toThrow(
      /Refusing insecure HTTP connect to a non-local host/,
    );
  });

  it('allows insecure non-local HTTP when --allow-insecure-http is set', async () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const spawnMock = vi.fn().mockReturnValue(child as any);

    const connectModule = await import('./connect.js');
    connectModule.__setSpawnForConnect(spawnMock as any);

    await connectModule.connectCommand.handler?.({
      url: 'http://remote.example:41242',
      token: 'server-token-1',
      'allow-insecure-http': true,
    } as any);

    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      [process.argv[1]!],
      expect.objectContaining({
        env: expect.objectContaining({
          PAPERT_REMOTE_URL: 'http://remote.example:41242/',
          PAPERT_REMOTE_TOKEN: 'server-token-1',
          PAPERT_REMOTE_ALLOW_INSECURE_HTTP: '1',
        }),
      }),
    );

    connectModule.__resetSpawnForConnect();
  });
});
