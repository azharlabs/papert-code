/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { attachCommand } from './attach.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: vi.fn(),
  };
});

const mockedSpawn = vi.mocked(spawn);

describe('attach command', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockedSpawn.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('spawns CLI with remote session environment variables', async () => {
    const child = new EventEmitter() as unknown as ReturnType<typeof spawn>;
    mockedSpawn.mockReturnValue(child);

    await attachCommand.handler?.({
      url: 'http://remote.example:41242',
      'session-id': 'session-id-1',
      'session-token': 'session-token-1',
    } as any);

    expect(mockedSpawn).toHaveBeenCalledWith(
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
  });
});
