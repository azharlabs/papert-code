/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { parseArguments } from './config.js';
import type { Settings } from './settings.js';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { __setSpawnForServer, __resetSpawnForServer } from '../commands/server.js';
import { __setSpawnForConnect, __resetSpawnForConnect } from '../commands/connect.js';
import { getBrandConfig } from '@papert-code/papert-code-core';

describe('parseArguments (subcommands)', () => {
  const child = new EventEmitter() as unknown as ChildProcess;

  it('should invoke the `server` subcommand handler', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((() => undefined) as any);
    __setSpawnForServer(vi.fn().mockReturnValue(child as any));

    process.argv = ['node', 'dist/index.js', 'server', '--port', '41242', '--token', 'x'];

    await parseArguments({} as Settings);

    expect(exitSpy).toHaveBeenCalledWith(1);
    __resetSpawnForServer();
  });

  it('should not exit early for `connect` subcommand (yargs should run handler)', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((() => undefined) as any);
    __setSpawnForConnect(vi.fn().mockReturnValue(child as any));

    process.argv = ['node', 'dist/index.js', 'connect', 'http://localhost:41242', '--token', 'x'];

    await parseArguments({} as Settings);

    expect(exitSpy).not.toHaveBeenCalled();
    __resetSpawnForConnect();
  });

  it('should parse hidden --remote-control flag (used by `papert connect` child process)', async () => {
    process.argv = [
      'node',
      'dist/index.js',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--remote-control',
      '--remote-url',
      'http://localhost:41242',
      '--remote-token',
      'x',
    ];

    const argv = await parseArguments({} as Settings);

    expect(argv.remoteControl).toBe(true);
  });

  it('should accept branded cli names in help metadata', async () => {
    process.env['PAPERT_CLI_NAME'] = 'astra';
    process.argv = ['node', 'dist/index.js', '--help'];

    await expect(parseArguments({} as Settings)).rejects.toBeTruthy();

    delete process.env['PAPERT_CLI_NAME'];
    expect(getBrandConfig().cliName).toBe('papert');
  });
});
