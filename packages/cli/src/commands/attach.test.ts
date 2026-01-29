/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

describe('attach command', () => {
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

  it('spawns CLI with remote session environment variables', async () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const onSpy = vi.spyOn(child, 'on');
    const spawnMock = vi.fn().mockReturnValue(child as any);

    const attachModule = await import('./attach.js');
    const { attachCommand } = attachModule;
    attachModule.__setSpawnForAttach(spawnMock as any);
    await attachCommand.handler?.({
      url: 'http://remote.example:41242',
      'session-id': 'session-id-1',
      'session-token': 'session-token-1',
    } as any);

    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      [process.argv[1]!],
      expect.objectContaining({
        env: expect.objectContaining({
          PAPERT_REMOTE_URL: 'http://remote.example:41242',
          PAPERT_REMOTE_SESSION_ID: 'session-id-1',
          PAPERT_REMOTE_SESSION_TOKEN: 'session-token-1',
        }),
      }),
    );
    expect(onSpy).toHaveBeenCalledWith('close', expect.any(Function));
    attachModule.__resetSpawnForAttach();
  });
});
