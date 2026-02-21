/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

describe('web command', () => {
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

  it('enables web UI and generates a server token by default', async () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const spawnMock = vi.fn().mockReturnValue(child as any);

    const module = await import('./web.js');
    module.__setSpawnForWeb(spawnMock as any);

    await module.webCommand.handler?.({
      port: 41242,
      'session-ttl-ms': 60_000,
      docs: false,
    } as any);

    const spawnOptions = spawnMock.mock.calls[0]?.[2];
    const env = (spawnOptions?.env || {}) as Record<string, string>;
    expect(env['CODER_AGENT_HOST']).toBe('127.0.0.1');
    expect(env['PAPERT_WEB_UI_ENABLED']).toBe('1');
    expect(env['PAPERT_REMOTE_SERVER_TOKEN']).toBeTruthy();

    module.__resetSpawnForWeb();
  });

  it('supports empty-token mode when explicitly requested', async () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const spawnMock = vi.fn().mockReturnValue(child as any);

    const module = await import('./web.js');
    module.__setSpawnForWeb(spawnMock as any);

    await module.webCommand.handler?.({
      host: '127.0.0.1',
      port: 41242,
      'session-ttl-ms': 60_000,
      docs: false,
      'allow-empty-token': true,
    } as any);

    const spawnOptions = spawnMock.mock.calls[0]?.[2];
    const env = (spawnOptions?.env || {}) as Record<string, string>;
    expect(env['PAPERT_REMOTE_SERVER_TOKEN']).toBe('');

    module.__resetSpawnForWeb();
  });
});
