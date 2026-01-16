/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { parseArguments } from './config.js';
import type { Settings } from './settings.js';

describe('parseArguments (subcommands)', () => {
  it('should not exit early for `server` subcommand (yargs should run handler)', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((() => undefined) as any);

    process.argv = ['node', 'dist/index.js', 'server', '--port', '41242', '--token', 'x'];

    await parseArguments({} as Settings);

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should not exit early for `connect` subcommand (yargs should run handler)', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((() => undefined) as any);

    process.argv = ['node', 'dist/index.js', 'connect', 'http://localhost:41242', '--token', 'x'];

    await parseArguments({} as Settings);

    expect(exitSpy).not.toHaveBeenCalled();
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
});
