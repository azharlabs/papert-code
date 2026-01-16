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

    // Launch the local Interactive TUI, but route all model/tool calls to the
    // remote daemon by passing remote session parameters via env.
    const child = spawn(
      process.execPath,
      [
        // run the current CLI entrypoint
        process.argv[1]!,
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
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
