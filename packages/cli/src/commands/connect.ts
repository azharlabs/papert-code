/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { spawn } from 'node:child_process';

export const connectCommand: CommandModule = {
  command: 'connect <url>',
  describe: 'Connect to a remote Papert Code daemon and run the CLI against it.',
  builder: (yargs) =>
    yargs
      .positional('url', {
        type: 'string',
        describe: 'Base URL of the daemon, e.g. http://host:41242',
        demandOption: true,
      })
      .option('token', {
        type: 'string',
        description: 'Server token required to create a remote session.',
        demandOption: true,
      })
      .version(false),
  handler: async (argv) => {
    const url = String(argv['url']);
    const token = String(argv['token']);

    // For now, reuse the existing CLI process protocol by spawning a local CLI
    // in stream-json mode and letting the SDK transport handle remote driving.
    // This keeps the interactive UI unchanged.
    const child = spawn(
      process.execPath,
      [
        // run the current CLI entrypoint
        process.argv[1]!,
        '--input-format',
        'stream-json',
        '--output-format',
        'stream-json',
        // Ensure the relaunched process does NOT fall through to local interactive UI.
        '--remote-control',
        '--remote-url',
        url,
        '--remote-token',
        token,
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          // Pass remote session parameters via env so the stream-json session
          // initializer can create the remote session and swap auth.
          PAPERT_REMOTE_URL: url,
          PAPERT_REMOTE_TOKEN: token,
        },
      },
    );

    child.on('close', (code) => {
      process.exit(code ?? 0);
    });
  },
};
