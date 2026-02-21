/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

describe('server command', () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetModules();
    process.exit = vi.fn() as unknown as typeof process.exit;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  it('uses secure defaults (loopback host + generated token)', async () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const spawnMock = vi.fn().mockReturnValue(child as any);

    const module = await import('./server.js');
    module.__setSpawnForServer(spawnMock as any);

    await module.serverCommand.handler?.({
      port: 41242,
      'session-ttl-ms': 60_000,
      docs: false,
    } as any);

    const spawnOptions = spawnMock.mock.calls[0]?.[2];
    const env = (spawnOptions?.env || {}) as Record<string, string>;
    const token = env['PAPERT_REMOTE_SERVER_TOKEN'] ?? '';

    expect(env['CODER_AGENT_HOST']).toBe('127.0.0.1');
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(10);

    module.__resetSpawnForServer();
  });

  it('honors --allow-empty-token for local insecure setups', async () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const spawnMock = vi.fn().mockReturnValue(child as any);

    const module = await import('./server.js');
    module.__setSpawnForServer(spawnMock as any);

    await module.serverCommand.handler?.({
      host: '127.0.0.1',
      port: 41242,
      'session-ttl-ms': 60_000,
      docs: false,
      'allow-empty-token': true,
    } as any);

    const spawnOptions = spawnMock.mock.calls[0]?.[2];
    const env = (spawnOptions?.env || {}) as Record<string, string>;
    expect(env['PAPERT_REMOTE_SERVER_TOKEN']).toBe('');

    module.__resetSpawnForServer();
  });
});
